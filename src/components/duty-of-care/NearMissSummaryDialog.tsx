import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Printer, Sparkles, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { groupActions, periodLabel, reportsSinceLast, summaryPrintHtml, type SavedNearMissSummary } from "@/lib/near-miss-summary";

interface ReportLite { id: string; created_at: string; report_date: string; location: string; description: string }

interface Props { open: boolean; onOpenChange: (open: boolean) => void; reports: ReportLite[] }

const riskVariant = { high: "destructive", medium: "default", low: "secondary" } as const;

export default function NearMissSummaryDialog({ open, onOpenChange, reports }: Props) {
  const { toast } = useToast();
  const [history, setHistory] = useState<SavedNearMissSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("near_miss_summaries")
      .select("id,created_at,period_from,period_to,report_count,report_ids,summary")
      .order("period_to", { ascending: false }).limit(50);
    setLoading(false);
    if (error) { toast({ title: "Could not load summaries", description: error.message, variant: "destructive" }); return; }
    const rows = (data ?? []) as unknown as SavedNearMissSummary[];
    setHistory(rows);
    setSelectedId(id => id && rows.some(r => r.id === id) ? id : rows[0]?.id ?? null);
  };

  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = history[0] ?? null;
  const pending = useMemo(() => reportsSinceLast(reports, latest?.period_to ?? null), [reports, latest]);
  const selected = history.find(h => h.id === selectedId) ?? null;
  const byId = useMemo(() => new Map(reports.map(r => [r.id, r])), [reports]);
  const included = (selected?.report_ids ?? []).map((id, i) => ({ ref: `NM${i + 1}`, report: byId.get(id) }));

  const generate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("near-miss-summary", { body: {} });
      if (error) {
        let msg = error.message;
        try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* keep message */ }
        throw new Error(msg);
      }
      if (data?.empty) { toast({ title: "No new near misses", description: "Nothing has been reported since the last summary." }); return; }
      if (data?.error) throw new Error(data.error);
      await load();
      if (data?.summary?.id) setSelectedId(data.summary.id);
      toast({ title: "Summary ready" });
    } catch (e) {
      toast({ title: "Summary not created", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const print = () => {
    if (!selected) return;
    const html = summaryPrintHtml(selected, included.map(({ ref, report }) => ({
      ref, date: report ? format(new Date(report.report_date), "dd MMM yyyy") : "-",
      location: report?.location ?? "(report deleted)", description: report?.description ?? "",
    })));
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "Pop-up blocked", description: "Allow pop-ups to print the summary.", variant: "destructive" }); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  const c = selected?.summary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Near miss review summary</DialogTitle>
          <DialogDescription>
            Claude summarises near misses reported since the previous summary, with suggested actions to discuss with the Transport and Yard Managers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {pending.length} new report{pending.length === 1 ? "" : "s"} since {latest ? format(new Date(latest.period_to), "dd MMM yyyy HH:mm") : "records began"}
            </p>
            <p className="text-sm text-muted-foreground">A new summary covers everything submitted after the last one.</p>
          </div>
          <Button onClick={generate} disabled={generating || pending.length === 0} className="gap-2 shrink-0">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Claude is reviewing…" : "Create summary"}
          </Button>
        </div>

        {history.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
              <SelectTrigger className="sm:w-[420px]"><SelectValue placeholder="Choose a summary" /></SelectTrigger>
              <SelectContent>
                {history.map(h => (
                  <SelectItem key={h.id} value={h.id}>
                    {format(new Date(h.created_at), "dd MMM yyyy")} · {h.report_count} report{h.report_count === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={print} disabled={!selected} className="gap-2"><Printer className="h-4 w-4" />Print / save PDF</Button>
          </div>
        )}

        {loading && !selected ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : !selected || !c ? (
          <div className="py-10 text-center text-muted-foreground">No summaries yet. Press Create summary to make the first one.</div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{periodLabel(selected)}</span><span>·</span>
                <span>{selected.report_count} report{selected.report_count === 1 ? "" : "s"}</span>
                <Badge variant={riskVariant[c.risk_level]}>Risk: {c.risk_level}</Badge>
              </div>
              <h3 className="text-lg font-semibold">{c.headline}</h3>
              <p className="whitespace-pre-wrap">{c.overview}</p>
            </section>

            {c.themes.length > 0 && (
              <section className="space-y-2">
                <h4 className="font-semibold">What keeps coming up</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {c.themes.map((t, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="font-medium">{t.title} {t.reports.length > 0 && <span className="text-sm text-muted-foreground">({t.reports.join(", ")})</span>}</p>
                      <p className="text-sm text-muted-foreground">{t.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h4 className="font-semibold">Suggested actions</h4>
              {groupActions(c.actions).map(g => (
                <div key={g.key} className="rounded-lg border">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                    <span className="font-medium">{g.label}</span>
                    <span className="text-sm text-muted-foreground">{g.actions.length || "None"}</span>
                  </div>
                  {g.key === "disciplinary" && g.actions.length > 0 && (
                    <p className="flex items-start gap-2 px-3 pt-2 text-sm text-muted-foreground">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      Suggestions only. Any disciplinary step must follow the company procedure after a fair investigation.
                    </p>
                  )}
                  {g.actions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No action suggested.</p>
                  ) : (
                    <ul className="divide-y">
                      {g.actions.map((a, i) => (
                        <li key={i} className="space-y-1 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{a.action}</span>
                            <Badge variant={a.priority === "high" ? "destructive" : a.priority === "medium" ? "default" : "secondary"}>{a.priority}</Badge>
                            <Badge variant="outline">{a.owner}</Badge>
                            {a.reports.length > 0 && <span className="text-sm text-muted-foreground">{a.reports.join(", ")}</span>}
                          </div>
                          <p className="text-sm text-muted-foreground">{a.reason}</p>
                          {a.existing_document && <p className="text-sm">Use existing: <span className="font-medium">{a.existing_document}</span></p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>

            {c.discussion_points.length > 0 && (
              <section className="space-y-2">
                <h4 className="font-semibold">Points to discuss with Transport and Yard Managers</h4>
                <ul className="list-disc space-y-1 pl-5">{c.discussion_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </section>
            )}

            {c.data_gaps.length > 0 && (
              <section className="space-y-2">
                <h4 className="font-semibold">Missing information</h4>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{c.data_gaps.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </section>
            )}

            <section className="space-y-2">
              <h4 className="font-semibold">Reports included</h4>
              <ul className="space-y-1 text-sm">
                {included.map(({ ref, report }) => (
                  <li key={ref} className="flex gap-2">
                    <span className="w-10 shrink-0 font-medium">{ref}</span>
                    <span className="text-muted-foreground">{report ? `${format(new Date(report.report_date), "dd MMM yyyy")} · ${report.location} · ${report.description}` : "Report no longer on record"}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
