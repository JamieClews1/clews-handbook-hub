import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PhotoThumb, WalkAroundPhoto } from "@/components/walk-around/WalkAroundPhoto";
import {
  BUCKET_LABEL, actionBucket, daysUntil, formatUkDate, londonToday,
  type ActionBucket, type WalkAroundActionStatus, type WalkAroundPriority,
} from "@/lib/walk-around-checks";

interface Job {
  id: string; check_id: string; section_title: string | null; item_label: string; action_required: string;
  priority: WalkAroundPriority; due_date: string; assigned_to: string | null; assigned_name: string | null;
  status: WalkAroundActionStatus; completed_at: string | null; completed_by?: string | null; completion_notes: string | null; photo_path: string | null;
  created_at: string;
  walk_around_checks: { inspection_date: string } | null;
}
interface Person { id: string; full_name: string | null }

const BUCKET_ORDER: ActionBucket[] = ["overdue", "this_week", "later", "done"];
const BUCKET_STYLE: Record<ActionBucket, { dot: string; card: string; text: string }> = {
  overdue: { dot: "bg-destructive", card: "border-destructive/50 bg-destructive/5", text: "text-destructive" },
  this_week: { dot: "bg-warning", card: "border-warning/60", text: "text-warning-text" },
  later: { dot: "bg-primary", card: "", text: "text-muted-foreground" },
  done: { dot: "bg-success", card: "opacity-75", text: "text-success" },
};
const PRIORITY_BADGE: Record<WalkAroundPriority, string> = {
  high: "border-destructive/50 text-destructive",
  medium: "border-warning/60 text-warning-text",
  low: "border-border text-muted-foreground",
};

function dueText(job: Job, today: string) {
  if (job.status === "done") return job.completed_at ? `Done ${new Date(job.completed_at).toLocaleDateString("en-GB")}` : "Done";
  const d = daysUntil(job.due_date, today);
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `${d} days left`;
}

const WalkAroundJobsPage = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"open" | "all">("open");
  const [who, setWho] = useState<string>("all");
  const [completing, setCompleting] = useState<Job | null>(null);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = londonToday();

  const load = useCallback(async () => {
    const [{ data, error }, { data: ppl }] = await Promise.all([
      supabase.from("walk_around_actions").select("*, walk_around_checks(inspection_date)").order("due_date").limit(1000),
      supabase.from("profiles").select("id, full_name").eq("is_archived", false).not("full_name", "is", null).order("full_name"),
    ]);
    if (error) toast.error(error.message);
    setJobs((data as unknown as Job[]) || []);
    setPeople((ppl as Person[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const patchJob = async (job: Job, patch: Partial<Job>) => {
    setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, ...patch } : j)));
    const { walk_around_checks: _ignored, ...body } = patch as Job;
    const { error } = await supabase.from("walk_around_actions").update(body as never).eq("id", job.id);
    if (error) { toast.error(error.message); load(); }
  };

  const assign = (job: Job, personId: string) => {
    if (personId === "none") return patchJob(job, { assigned_to: null, assigned_name: null });
    const p = people.find(x => x.id === personId);
    patchJob(job, { assigned_to: personId, assigned_name: p?.full_name ?? null });
  };

  const complete = async () => {
    if (!completing) return;
    setBusy(true);
    await patchJob(completing, {
      status: "done", completed_at: new Date().toISOString(), completion_notes: notes.trim() || null,
      completed_by: user?.id ?? null,
      ...(photo ? { photo_path: photo } : {}),
    });
    setBusy(false);
    setCompleting(null);
    toast.success("Job marked complete");
  };

  const filtered = useMemo(() => jobs.filter(j =>
    (view === "all" || j.status !== "done") && (who === "all" || (who === "none" ? !j.assigned_to : j.assigned_to === who)),
  ), [jobs, view, who]);
  const grouped = useMemo(() => {
    const g: Record<ActionBucket, Job[]> = { overdue: [], this_week: [], later: [], done: [] };
    filtered.forEach(j => g[actionBucket(j, today)].push(j));
    g.done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return g;
  }, [filtered, today]);
  const counts = useMemo(() => {
    const c: Record<ActionBucket, number> = { overdue: 0, this_week: 0, later: 0, done: 0 };
    jobs.forEach(j => c[actionBucket(j, today)]++);
    return c;
  }, [jobs, today]);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-4 md:p-6">
      <PageHeading title="Walk Around Job List" description="Jobs raised from walk around checks, by completion date" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {BUCKET_ORDER.map(b => (
          <Card key={b} className={counts[b] > 0 && b === "overdue" ? BUCKET_STYLE.overdue.card : ""}>
            <CardContent className="space-y-1 py-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", BUCKET_STYLE[b].dot)} />{BUCKET_LABEL[b]}
              </p>
              <p className="text-2xl font-bold tabular-nums">{counts[b]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={v => setView(v as "open" | "all")}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="all">All incl. completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Anyone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            <SelectItem value="none">Not assigned</SelectItem>
            {people.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {jobs.length === 0 ? "No jobs yet. Items marked “Needs attention” on a submitted walk around check appear here." : "Nothing matches these filters."}
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {BUCKET_ORDER.filter(b => grouped[b].length).map(b => (
            <section key={b} aria-label={BUCKET_LABEL[b]}>
              <h2 className={cn("mb-2 text-sm font-semibold", BUCKET_STYLE[b].text)}>{BUCKET_LABEL[b]} · {grouped[b].length}</h2>
              {/* Timeline */}
              <ol className="relative ml-2 space-y-3 border-l-2 border-border pl-5">
                {grouped[b].map(job => (
                  <li key={job.id} className="relative">
                    <span className={cn("absolute -left-[27px] top-4 h-3 w-3 rounded-full ring-4 ring-background", BUCKET_STYLE[b].dot)} />
                    <Card className={BUCKET_STYLE[b].card}>
                      <CardContent className="space-y-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-semibold leading-snug">{job.action_required}</p>
                            <p className="text-xs text-muted-foreground">
                              {job.item_label}{job.section_title ? ` · ${job.section_title}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className={cn("text-sm font-semibold tabular-nums", BUCKET_STYLE[b].text)}>{dueText(job, today)}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">Complete by {formatUkDate(job.due_date)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline" className={cn("capitalize", PRIORITY_BADGE[job.priority])}>{job.priority}</Badge>
                          {job.status === "in_progress" && <Badge variant="secondary">In progress</Badge>}
                          <Link to={`/walk-around-checks/${job.check_id}`} className="text-muted-foreground underline-offset-2 hover:underline">
                            From check {formatUkDate(job.walk_around_checks?.inspection_date)}
                          </Link>
                        </div>
                        {(job.photo_path || job.completion_notes) && (
                          <div className="flex gap-3 text-sm">
                            <PhotoThumb path={job.photo_path} className="h-16 w-16" />
                            {job.completion_notes && <p className="text-muted-foreground">{job.completion_notes}</p>}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <Select value={job.assigned_to ?? "none"} onValueChange={v => assign(job, v)} disabled={job.status === "done"}>
                            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Assign to" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not assigned</SelectItem>
                              {people.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {job.status !== "done" && (
                            <Input type="date" className="h-9 w-40" value={job.due_date} aria-label="Complete by"
                              onChange={e => e.target.value && patchJob(job, { due_date: e.target.value })} />
                          )}
                          <div className="ml-auto flex gap-2">
                            {job.status === "open" && (
                              <Button size="sm" variant="outline" onClick={() => patchJob(job, { status: "in_progress" })}><Play className="mr-1.5 h-4 w-4" />Start</Button>
                            )}
                            {job.status !== "done" ? (
                              <Button size="sm" onClick={() => { setCompleting(job); setNotes(""); setPhoto(null); }}><CheckCircle2 className="mr-1.5 h-4 w-4" />Mark done</Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => patchJob(job, { status: "open", completed_at: null })}><RotateCcw className="mr-1.5 h-4 w-4" />Reopen</Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!completing} onOpenChange={o => !o && setCompleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark job done</DialogTitle></DialogHeader>
          <p className="text-sm font-medium">{completing?.action_required}</p>
          <div className="space-y-1.5">
            <Label htmlFor="wac-done-notes">What was done (optional)</Label>
            <Textarea id="wac-done-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {completing && (
            <WalkAroundPhoto folder={`${completing.check_id}/done`} path={photo} onChange={setPhoto} label="Add photo of fix" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleting(null)}>Cancel</Button>
            <Button onClick={complete} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalkAroundJobsPage;
