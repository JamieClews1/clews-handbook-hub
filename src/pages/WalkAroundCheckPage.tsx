import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, CheckCheck, Circle, Cloud, Loader2, Printer, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WalkAroundPhoto, PhotoThumb } from "@/components/walk-around/WalkAroundPhoto";
import {
  PRIORITY_DAYS, STATE_LABEL, checkProgress, dueDateFor, formatUkDate, submissionProblems,
  type WalkAroundPriority, type WalkAroundState,
} from "@/lib/walk-around-checks";

interface CheckRecord {
  id: string; site_name: string; inspection_date: string; manager_name: string | null; supervisor_name: string | null;
  notes: string | null; status: string; created_by_name: string | null; submitted_at: string | null;
}
interface ItemRecord {
  id: string; section_key: string; section_title: string; item_key: string; label: string; position: number;
  state: WalkAroundState | null; action_required: string | null; priority: WalkAroundPriority; due_date: string | null; photo_path: string | null;
}
interface ActionRecord { id: string; item_id: string | null; status: string; due_date: string; assigned_name: string | null }

const STATE_BUTTONS: { state: WalkAroundState; icon: typeof Check; short: string; on: string }[] = [
  { state: "acceptable", icon: Check, short: "OK", on: "border-success bg-success text-success-foreground" },
  { state: "attention", icon: X, short: "Attention", on: "border-destructive bg-destructive text-destructive-foreground" },
  { state: "na", icon: Circle, short: "N/A", on: "border-foreground/40 bg-muted text-foreground" },
];
const PRIORITIES: WalkAroundPriority[] = ["high", "medium", "low"];

const WalkAroundCheckPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [check, setCheck] = useState<CheckRecord | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, Record<string, unknown>>>({});

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: c, error }, { data: it }, { data: ac }] = await Promise.all([
      supabase.from("walk_around_checks").select("*").eq("id", id).maybeSingle(),
      supabase.from("walk_around_check_items").select("*").eq("check_id", id).order("position"),
      supabase.from("walk_around_actions").select("id, item_id, status, due_date, assigned_name").eq("check_id", id),
    ]);
    if (error) toast.error(error.message);
    setCheck(c as CheckRecord | null);
    setItems((it as ItemRecord[]) || []);
    setActions((ac as ActionRecord[]) || []);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Debounced, merged writes so nothing typed on a phone is lost if the page closes mid-check.
  const persist = useCallback((table: "walk_around_check_items" | "walk_around_checks", rowId: string, patch: Record<string, unknown>, delay = 0) => {
    const key = `${table}:${rowId}`;
    pending.current[key] = { ...(pending.current[key] || {}), ...patch };
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      const body = pending.current[key];
      delete pending.current[key];
      setSaving(s => s + 1);
      const { error } = await supabase.from(table).update(body as never).eq("id", rowId);
      setSaving(s => s - 1);
      if (error) toast.error(`Not saved: ${error.message}`);
    }, delay);
  }, []);
  const flush = useCallback(async () => {
    const keys = Object.keys(pending.current);
    await Promise.all(keys.map(async key => {
      clearTimeout(timers.current[key]);
      const [table, rowId] = key.split(":") as ["walk_around_check_items" | "walk_around_checks", string];
      const body = pending.current[key];
      delete pending.current[key];
      const { error } = await supabase.from(table).update(body as never).eq("id", rowId);
      if (error) throw error;
    }));
  }, []);
  useEffect(() => () => { flush().catch(() => undefined); }, [flush]);

  const updateItem = (item: ItemRecord, patch: Partial<ItemRecord>, delay = 0) => {
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, ...patch } : i)));
    persist("walk_around_check_items", item.id, patch, delay);
  };
  const setState = (item: ItemRecord, state: WalkAroundState) => {
    const patch: Partial<ItemRecord> = { state };
    if (state === "attention" && !item.due_date && check) patch.due_date = dueDateFor(check.inspection_date, item.priority);
    updateItem(item, patch);
  };
  const setPriority = (item: ItemRecord, priority: WalkAroundPriority) => {
    if (!check) return;
    updateItem(item, { priority, due_date: dueDateFor(check.inspection_date, priority) });
  };
  const updateCheck = (patch: Partial<CheckRecord>, delay = 600) => {
    setCheck(prev => (prev ? { ...prev, ...patch } : prev));
    if (check) persist("walk_around_checks", check.id, patch, delay);
  };
  const markRemainingAcceptable = (sectionKey: string) => {
    items.filter(i => i.section_key === sectionKey && !i.state).forEach(i => updateItem(i, { state: "acceptable" }));
  };

  const progress = checkProgress(items);
  const problems = submissionProblems(items);
  const sections = useMemo(() => {
    const map = new Map<string, { key: string; title: string; items: ItemRecord[] }>();
    items.forEach(i => {
      if (!map.has(i.section_key)) map.set(i.section_key, { key: i.section_key, title: i.section_title, items: [] });
      map.get(i.section_key)!.items.push(i);
    });
    return [...map.values()];
  }, [items]);

  const submit = async () => {
    if (!check) return;
    if (problems.length) { setShowProblems(true); toast.error(problems[0]); return; }
    setSubmitting(true);
    try {
      await flush();
      const { data, error } = await supabase.rpc("submit_walk_around_check", { _check_id: check.id });
      if (error) throw error;
      toast.success(data ? `Check submitted · ${data} job${data === 1 ? "" : "s"} added to the job list` : "Check submitted · no jobs needed");
      await load();
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      toast.error(e.message || "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCheck = async () => {
    if (!check) return;
    const { error } = await supabase.from("walk_around_checks").delete().eq("id", check.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Check deleted");
    navigate("/walk-around-checks");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!check) return <div className="p-6 text-sm text-muted-foreground">Check not found. <Link className="underline" to="/walk-around-checks">Back</Link></div>;

  const draft = check.status === "draft";
  const pct = progress.total ? Math.round((progress.answered / progress.total) * 100) : 0;

  return (
    <div className={cn("mx-auto max-w-3xl print:max-w-none", check.status === "draft" && "pb-24 md:pb-0")}>
      {/* Sticky header with progress */}
      <div className="border-b px-4 py-3 print:border-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="print:hidden"><Link to="/walk-around-checks" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">Walk Around Check</h1>
            <p className="truncate text-xs text-muted-foreground">{formatUkDate(check.inspection_date)} · {check.site_name}</p>
          </div>
          {draft ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground print:hidden">
              {saving > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
              {saving > 0 ? "Saving" : "Saved"}
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden"><Printer className="mr-1.5 h-4 w-4" />Print</Button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs font-medium tabular-nums">{progress.answered}/{progress.total}</span>
          {progress.attention > 0 && <Badge variant="destructive" className="tabular-nums">{progress.attention} ✗</Badge>}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {!draft && (
          <Card className="border-success/40 bg-success/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-semibold">Submitted{check.submitted_at ? ` ${new Date(check.submitted_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}` : ""}</p>
                <p className="text-sm text-muted-foreground">
                  {progress.acceptable} acceptable · {progress.attention} need attention · {progress.na} not applicable
                </p>
              </div>
              {actions.length > 0 && (
                <Button asChild variant="outline" className="print:hidden"><Link to="/walk-around-checks/jobs">View {actions.length} job{actions.length === 1 ? "" : "s"}</Link></Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Inspection details</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wac-date">Date of inspection</Label>
              <Input id="wac-date" type="date" value={check.inspection_date} disabled={!draft}
                onChange={e => e.target.value && updateCheck({ inspection_date: e.target.value }, 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wac-site">Site</Label>
              <Input id="wac-site" value={check.site_name} disabled={!draft} onChange={e => updateCheck({ site_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wac-manager">Manager</Label>
              <Input id="wac-manager" value={check.manager_name ?? ""} disabled={!draft} placeholder="Name" onChange={e => updateCheck({ manager_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wac-supervisor">Supervisor</Label>
              <Input id="wac-supervisor" value={check.supervisor_name ?? ""} disabled={!draft} placeholder="Name" onChange={e => updateCheck({ supervisor_name: e.target.value })} />
            </div>
            {draft && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Mark each line <strong>✓ OK</strong>, <strong>✗ Attention</strong> or <strong>O N/A</strong>. Anything needing attention becomes a job with a completion date when you submit.
              </p>
            )}
          </CardContent>
        </Card>

        {sections.map(section => {
          const remaining = section.items.filter(i => !i.state).length;
          return (
            <Card key={section.key} className="break-inside-avoid-page">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-base">{section.title}</CardTitle>
                {draft && remaining > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => markRemainingAcceptable(section.key)} className="print:hidden">
                    <CheckCheck className="mr-1.5 h-4 w-4" /> Rest OK ({remaining})
                  </Button>
                )}
              </CardHeader>
              <CardContent className="divide-y p-0">
                {section.items.map(item => {
                  const missing = showProblems && draft && (!item.state || (item.state === "attention" && !(item.action_required ?? "").trim()));
                  const job = actions.find(a => a.item_id === item.id);
                  return (
                    <div key={item.id} className={cn("space-y-3 px-4 py-3", item.state === "attention" && "bg-destructive/5", missing && "ring-2 ring-inset ring-destructive/60")}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium leading-snug">{item.label}</p>
                        {draft ? (
                          <div className="grid shrink-0 grid-cols-3 gap-1.5 sm:w-64" role="radiogroup" aria-label={item.label}>
                            {STATE_BUTTONS.map(b => {
                              const active = item.state === b.state;
                              return (
                                <button
                                  key={b.state}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  aria-label={STATE_LABEL[b.state]}
                                  onClick={() => setState(item, b.state)}
                                  className={cn(
                                    "flex h-11 items-center justify-center gap-1 rounded-md border text-xs font-semibold transition-colors",
                                    active ? b.on : "border-border bg-background text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  <b.icon className="h-4 w-4" />{b.short}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <Badge variant="outline" className={cn("w-fit shrink-0",
                            item.state === "acceptable" && "border-success/50 text-success",
                            item.state === "attention" && "border-destructive/50 text-destructive")}>
                            {item.state ? STATE_LABEL[item.state] : "Not marked"}
                          </Badge>
                        )}
                      </div>

                      {item.state === "attention" && (draft ? (
                        <div className="space-y-3 rounded-md border border-destructive/30 bg-background p-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`act-${item.id}`}>Action required</Label>
                            <Textarea id={`act-${item.id}`} rows={2} value={item.action_required ?? ""} placeholder="What needs doing?"
                              onChange={e => updateItem(item, { action_required: e.target.value }, 700)} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label>Priority</Label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {PRIORITIES.map(p => (
                                  <button key={p} type="button" onClick={() => setPriority(item, p)}
                                    className={cn("h-10 rounded-md border text-xs font-semibold capitalize",
                                      item.priority === p ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}>
                                    {p}<span className="block text-[10px] font-normal opacity-80">{PRIORITY_DAYS[p]} days</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`due-${item.id}`}>Complete by</Label>
                              <Input id={`due-${item.id}`} type="date" value={item.due_date ?? ""} className="h-10"
                                onChange={e => updateItem(item, { due_date: e.target.value || null })} />
                            </div>
                          </div>
                          <WalkAroundPhoto folder={check.id} path={item.photo_path} onChange={photo_path => updateItem(item, { photo_path })} />
                        </div>
                      ) : (
                        <div className="flex gap-3 text-sm">
                          <PhotoThumb path={item.photo_path} className="h-16 w-16" />
                          <div className="space-y-1">
                            <p>{item.action_required}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className="capitalize">{item.priority}</span> priority · complete by {formatUkDate(job?.due_date ?? item.due_date)}
                              {job ? ` · ${job.status === "done" ? "Completed" : job.status === "in_progress" ? "In progress" : "Open"}` : ""}
                              {job?.assigned_name ? ` · ${job.assigned_name}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Other notes</CardTitle></CardHeader>
          <CardContent>
            {draft ? (
              <Textarea rows={3} value={check.notes ?? ""} placeholder="Anything else seen on the walk around" onChange={e => updateCheck({ notes: e.target.value })} />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{check.notes || "None"}</p>
            )}
          </CardContent>
        </Card>

        {(draft || isAdmin) && (
          <div className="flex justify-center print:hidden">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="mr-1.5 h-4 w-4" />Delete this check</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this walk around check?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {draft ? "Everything marked so far will be lost." : "This removes the submitted report and every job created from it."} This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteCheck} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {draft && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pr-20 backdrop-blur md:static md:mx-4 md:mb-6 md:rounded-lg md:border md:pr-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Progress value={pct} className="h-2 flex-1" />
                <span className="text-xs font-medium tabular-nums">{progress.answered}/{progress.total}</span>
                {progress.attention > 0 && <span className="text-xs font-semibold text-destructive tabular-nums">{progress.attention} ✗</span>}
              </div>
            <p className="truncate text-xs text-muted-foreground">
              {problems.length ? problems[0] : progress.attention ? `${progress.attention} job${progress.attention === 1 ? "" : "s"} will be created` : "All lines marked"}
            </p>
            </div>
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalkAroundCheckPage;
