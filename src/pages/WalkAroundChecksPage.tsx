import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, ListTodo, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_WALK_AROUND_SITE, WALK_AROUND_TEMPLATE, actionBucket, addCalendarDays, daysUntil, formatUkDate, londonToday,
} from "@/lib/walk-around-checks";

interface CheckRow {
  id: string;
  site_name: string;
  inspection_date: string;
  manager_name: string | null;
  supervisor_name: string | null;
  created_by_name: string | null;
  status: string;
  walk_around_check_items: { state: string | null }[];
  walk_around_actions: { status: string; due_date: string }[];
}

const WalkAroundChecksPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const today = londonToday();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("walk_around_checks")
        .select("id, site_name, inspection_date, manager_name, supervisor_name, created_by_name, status, walk_around_check_items(state), walk_around_actions(status, due_date)")
        .order("inspection_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) toast.error(error.message);
      setRows((data as unknown as CheckRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const startCheck = async () => {
    if (!user) return;
    setStarting(true);
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const { data: check, error } = await supabase
      .from("walk_around_checks")
      .insert({ site_name: DEFAULT_WALK_AROUND_SITE, inspection_date: today, created_by_name: profile?.full_name || user.email || null })
      .select("id")
      .single();
    if (error || !check) { setStarting(false); toast.error(error?.message || "Could not start check"); return; }
    let position = 0;
    const items = WALK_AROUND_TEMPLATE.flatMap(s => s.items.map(i => ({
      check_id: check.id, section_key: s.key, section_title: s.title, item_key: i.key, label: i.label, position: position++,
    })));
    const { error: itemsError } = await supabase.from("walk_around_check_items").insert(items);
    setStarting(false);
    if (itemsError) { toast.error(itemsError.message); return; }
    navigate(`/walk-around-checks/${check.id}`);
  };

  const submitted = rows.filter(r => r.status === "submitted");
  const lastDone = submitted[0]?.inspection_date;
  const nextDue = lastDone ? addCalendarDays(lastDone, 30) : null;
  const allActions = rows.flatMap(r => r.walk_around_actions);
  const openJobs = allActions.filter(a => a.status !== "done").length;
  const overdue = allActions.filter(a => actionBucket(a as any, today) === "overdue").length;
  const nextDueOverdue = nextDue ? daysUntil(nextDue, today) < 0 : true;

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-4 md:p-6">
      <PageHeading
        title="Walk Around Checks"
        description="Monthly operations inspection · Unit 17, Hunters Lane"
        actions={
          <Button onClick={startCheck} disabled={starting} size="lg">
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Start new check
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className={nextDueOverdue ? "border-warning/60 bg-warning-subtle" : ""}>
          <CardContent className="space-y-1 py-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Next check due</p>
            <p className="text-2xl font-bold tabular-nums">{nextDue ? formatUkDate(nextDue) : "Now"}</p>
            <p className="text-xs text-muted-foreground">{lastDone ? `Last completed ${formatUkDate(lastDone)}` : "No completed check yet"}</p>
          </CardContent>
        </Card>
        <Link to="/walk-around-checks/jobs">
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardContent className="space-y-1 py-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ListTodo className="h-3.5 w-3.5" /> Open jobs</p>
              <p className="text-2xl font-bold tabular-nums">{openJobs}</p>
              <p className="text-xs text-muted-foreground">From inspection findings</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/walk-around-checks/jobs">
          <Card className={`h-full transition-colors hover:bg-muted/40 ${overdue > 0 ? "border-destructive/50 bg-destructive/5" : ""}`}>
            <CardContent className="space-y-1 py-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Overdue jobs</p>
              <p className="text-2xl font-bold tabular-nums">{overdue}</p>
              <p className="text-xs text-muted-foreground">Past their completion date</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Inspections</h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <ClipboardCheck className="mx-auto mb-2 h-8 w-8" />
            No walk around checks yet. Press <strong>Start new check</strong> to begin one on your phone.
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {rows.map(r => {
              const items = r.walk_around_check_items;
              const answered = items.filter(i => i.state).length;
              const attention = items.filter(i => i.state === "attention").length;
              const open = r.walk_around_actions.filter(a => a.status !== "done").length;
              return (
                <Link key={r.id} to={`/walk-around-checks/${r.id}`} className="block min-w-0">
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardContent className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold tabular-nums">{formatUkDate(r.inspection_date)}</span>
                          {r.status === "draft"
                            ? <Badge variant="outline" className="border-warning/60 text-warning-text">In progress · {answered}/{items.length}</Badge>
                            : <Badge variant="outline" className="border-success/50 text-success"><CheckCircle2 className="mr-1 h-3 w-3" />Submitted</Badge>}
                          {attention > 0 && <Badge variant="destructive">{attention} need attention</Badge>}
                          {r.status === "submitted" && open > 0 && <Badge variant="secondary">{open} open job{open === 1 ? "" : "s"}</Badge>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.site_name}
                          {r.manager_name ? ` · Manager: ${r.manager_name}` : ""}
                          {r.supervisor_name ? ` · Supervisor: ${r.supervisor_name}` : ""}
                          {!r.manager_name && r.created_by_name ? ` · Started by ${r.created_by_name}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalkAroundChecksPage;
