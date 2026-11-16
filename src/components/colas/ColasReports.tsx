import { useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PROVIDER_LABELS, monthKey, type SourceKey } from "@/lib/colas-report";
import { buildColasExcel, buildColasPdf, colasReportFileName, downloadBlob, type ColasReportPayload } from "@/lib/colas-report-export";
import { ensurePeriod, fmtGBP, fmtT, useInvalidateColas, type ColasYearData } from "./useColasData";
import { buildPayload, payloadFromSnapshot, snapshotOf } from "./colas-payload";
import { Chip, StatusChip, ukDate, ukDateTime, useColasAuthorised, useProfileNames } from "./ColasShared";

export function ColasReports({ data, selected, onSelect }: { data: ColasYearData; selected: number | null; onSelect: (i: number | null) => void }) {
  if (selected != null) return <ColasMonthDetail data={data} index={selected} onBack={() => onSelect(null)} />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Monthly reports</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Month</TableHead><TableHead className="text-right">Hazardous (t)</TableHead><TableHead className="text-right">Non-hazardous (t)</TableHead>
            <TableHead className="text-right">Total (t)</TableHead><TableHead className="text-right">Costs (ex VAT)</TableHead><TableHead className="text-right">YTD total (t)</TableHead>
            <TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {data.months.map((m, i) => {
              const p = data.periods.get(monthKey(m.year, m.month));
              const future = m.inProgress && m.lines.length === 0 && m.year * 100 + m.month > Number(data.today.slice(0, 4)) * 100 + Number(data.today.slice(5, 7));
              const ok = m.sources.filter(s => s.status === "received" || s.status === "approved").length;
              return (
                <TableRow key={m.label} className={future ? "opacity-60" : "cursor-pointer"} onClick={() => !future && onSelect(i)}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtT(m.hazardous_t)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtT(m.non_hazardous_t)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmtT(m.total_t)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtGBP(m.costs.total)}{m.costs.provisional && m.costs.total ? <span className="ml-1 text-xs text-muted-foreground">(prov.)</span> : null}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtT(data.ytd[i].total_t)}</TableCell>
                  <TableCell>{future ? "—" : <Chip tone={ok === m.sources.length ? "good" : "warn"}>{ok}/{m.sources.length} sources</Chip>}</TableCell>
                  <TableCell>{future ? <Chip tone="neutral">Not started</Chip> : p?.status === "approved" ? <Chip tone="info">Approved</Chip> : m.inProgress ? <Chip tone="neutral">In progress</Chip> : <Chip tone="warn">Awaiting approval</Chip>}</TableCell>
                  <TableCell className="text-right">{!future && <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onSelect(i); }}>Open</Button>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ColasMonthDetail({ data, index, onBack }: { data: ColasYearData; index: number; onBack: () => void }) {
  const m = data.months[index];
  const period = data.periods.get(monthKey(m.year, m.month));
  const authorised = useColasAuthorised();
  const { user } = useAuth();
  const invalidate = useInvalidateColas();
  const [busy, setBusy] = useState<string | null>(null);
  const [comments, setComments] = useState(period?.comments ?? "");
  const [approveOpen, setApproveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sourceDialog, setSourceDialog] = useState<SourceKey | null>(null);
  const [sourceNote, setSourceNote] = useState("");
  const names = useProfileNames([period?.approved_by, period?.last_generated_by]);
  const approved = period?.status === "approved";
  const snapshotPayload = approved ? payloadFromSnapshot(period?.snapshot) : null;
  const changed = snapshotPayload && (Math.abs(snapshotPayload.month.total_t - m.total_t) > 0.0005 || Math.abs(snapshotPayload.month.costs.total - m.costs.total) > 0.005);

  const download = async (kind: "pdf" | "xlsx", useLive = false) => {
    setBusy(kind);
    try {
      const payload: ColasReportPayload = (!useLive && snapshotPayload) || buildPayload(data, index);
      const blob = kind === "pdf" ? await buildColasPdf(payload) : await buildColasExcel(payload);
      downloadBlob(blob, colasReportFileName(payload.month, kind));
      const p = await ensurePeriod(m.year, m.month);
      await supabase.from("colas_report_periods").update({ last_generated_at: new Date().toISOString(), last_generated_by: user?.id ?? null }).eq("id", p.id);
      invalidate();
    } catch (e: any) {
      toast.error(`Could not create the report: ${e.message ?? e}`);
    } finally { setBusy(null); }
  };

  const saveComments = async () => {
    setBusy("comments");
    try {
      const p = await ensurePeriod(m.year, m.month);
      const { error } = await supabase.from("colas_report_periods").update({ comments: comments.trim() || null }).eq("id", p.id);
      if (error) throw error;
      toast.success("Comments saved"); invalidate();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const approve = async () => {
    if (m.outstanding.length && !reason.trim()) { toast.error("Give the reason for approving with information outstanding"); return; }
    setBusy("approve");
    try {
      const p = await ensurePeriod(m.year, m.month);
      const payload = buildPayload(data, index);
      payload.approval = { ...payload.approval, status: "approved", approvedAt: new Date().toISOString(), outstandingReason: m.outstanding.length ? reason.trim() : null, comments: comments.trim() || null };
      const { error } = await supabase.from("colas_report_periods").update({ status: "approved", outstanding_reason: m.outstanding.length ? reason.trim() : null, comments: comments.trim() || null, snapshot: snapshotOf(payload) }).eq("id", p.id);
      if (error) throw error;
      toast.success(`${m.label} approved`); setApproveOpen(false); invalidate();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const reopen = async () => {
    if (!period) return;
    setBusy("reopen");
    const { error } = await supabase.from("colas_report_periods").update({ status: "open", snapshot: null, outstanding_reason: null }).eq("id", period.id);
    setBusy(null);
    if (error) toast.error(error.message); else { toast.success(`${m.label} reopened`); invalidate(); }
  };
  const setSource = async (key: SourceKey, approve: boolean) => {
    setBusy(`src-${key}`);
    try {
      const p = await ensurePeriod(m.year, m.month);
      const next = { ...(p.source_status ?? {}) } as Record<string, any>;
      if (approve) next[key] = { status: "approved", note: sourceNote.trim() || null, by: user?.id ?? null, at: new Date().toISOString() };
      else delete next[key];
      const { error } = await supabase.from("colas_report_periods").update({ source_status: next }).eq("id", p.id);
      if (error) throw error;
      setSourceDialog(null); setSourceNote(""); invalidate();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />All months</Button>
          <h2 className="text-xl font-bold">{m.label}</h2>
          {approved ? <Chip tone="info">Approved {period?.approved_at ? ukDateTime(period.approved_at) : ""}{period?.approved_by ? ` by ${names.get(period.approved_by) ?? ""}` : ""}</Chip> : m.inProgress ? <Chip tone="neutral">In progress</Chip> : <Chip tone="warn">Awaiting approval</Chip>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download("pdf")} disabled={!!busy}>{busy === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}PDF report</Button>
          <Button variant="outline" onClick={() => download("xlsx")} disabled={!!busy}>{busy === "xlsx" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}Excel workbook</Button>
          {authorised && (approved
            ? <Button variant="outline" onClick={reopen} disabled={!!busy}><RotateCcw className="mr-1 h-4 w-4" />Reopen month</Button>
            : <Button onClick={() => setApproveOpen(true)} disabled={!!busy}><CheckCircle2 className="mr-1 h-4 w-4" />Approve figures</Button>)}
        </div>
      </div>
      {period?.last_generated_at && <p className="text-sm text-muted-foreground">Last report generated {ukDateTime(period.last_generated_at)}{period.last_generated_by ? ` by ${names.get(period.last_generated_by) ?? "staff"}` : ""}.</p>}
      {changed && (
        <div className="rounded-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-text">
          Records have changed since this month was approved (approved total {fmtT(snapshotPayload!.month.total_t)} t / {fmtGBP(snapshotPayload!.month.costs.total)}; now {fmtT(m.total_t)} t / {fmtGBP(m.costs.total)}). Downloads reproduce the approved figures — reopen the month to approve the corrected figures.
          <Button variant="link" className="h-auto p-0 pl-2 text-warning-text underline" onClick={() => download("pdf", true)}><Download className="mr-1 h-3.5 w-3.5" />Draft with current figures</Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Hazardous", `${fmtT(m.hazardous_t)} t`], ["Non-hazardous", `${fmtT(m.non_hazardous_t)} t`], ["Total waste", `${fmtT(m.total_t)} t`], ["Costs (ex VAT)", `${fmtGBP(m.costs.total)}${m.costs.provisional ? " (provisional)" : ""}`]].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-card p-4"><div className="text-sm font-semibold text-muted-foreground">{k}</div><div className="text-2xl font-bold tabular-nums">{v}</div></div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Data completeness</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {m.sources.map(s => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{s.label}</div>
                  <div className="text-sm text-muted-foreground">{s.detail}</div>
                  {s.status === "approved" && <div className="text-sm text-info">Approved by staff{s.note ? `: ${s.note}` : ""} (automatic check: {s.autoStatus.replace("_", " ")})</div>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={s.status} />
                  {authorised && !approved && (s.status === "approved"
                    ? <Button size="sm" variant="ghost" onClick={() => setSource(s.key, false)} disabled={!!busy}>Undo</Button>
                    : s.status !== "received" && <Button size="sm" variant="outline" onClick={() => { setSourceDialog(s.key); setSourceNote(""); }}>Approve source</Button>)}
                </div>
              </li>
            ))}
          </ul>
          {approved && period?.outstanding_reason && <p className="mt-3 rounded-md bg-muted p-3 text-sm"><span className="font-semibold">Approved with outstanding information:</span> {period.outstanding_reason}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Comments for this month</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Explain missing information, late paperwork or corrections…" rows={3} disabled={approved} />
          {!approved && <Button size="sm" variant="outline" onClick={saveComments} disabled={!!busy}>Save comments</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Waste breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Waste stream</TableHead><TableHead>Classification</TableHead><TableHead className="text-right">Collections</TableHead><TableHead className="text-right">Tonnes</TableHead><TableHead className="text-right">Recorded charges</TableHead><TableHead>Weights</TableHead></TableRow></TableHeader>
            <TableBody>
              {m.streams.filter(s => s.lines).map(s => (
                <TableRow key={s.key}><TableCell className="font-medium">{s.label}</TableCell><TableCell>{s.hazardous ? <Chip tone="bad">Hazardous</Chip> : <Chip tone="good">Non-hazardous</Chip>}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.lines}</TableCell><TableCell className="text-right tabular-nums">{fmtT(s.tonnes)}</TableCell><TableCell className="text-right tabular-nums">{fmtGBP(s.charges)}</TableCell>
                  <TableCell>{s.missingWeights ? <Chip tone="bad">{s.missingWeights} missing</Chip> : <span className="text-sm text-muted-foreground">Complete</span>}</TableCell></TableRow>
              ))}
              {m.streams.every(s => !s.lines) && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No collections recorded for this month.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Collections ({m.lines.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Waste</TableHead><TableHead>EWC</TableHead><TableHead>Provider</TableHead><TableHead className="text-right">Tonnes</TableHead><TableHead>Weight from</TableHead><TableHead className="text-right">Charge</TableHead><TableHead>Flags</TableHead></TableRow></TableHeader>
            <TableBody>
              {m.lines.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{ukDate(l.date)}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.reference}{l.consignmentRef && l.consignmentRef !== l.reference && <div className="text-xs text-muted-foreground">{l.consignmentRef}</div>}</TableCell>
                  <TableCell>{l.description}</TableCell>
                  <TableCell className="whitespace-nowrap">{l.ewc ?? "—"}</TableCell>
                  <TableCell>{PROVIDER_LABELS[l.provider]}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.weight_t == null ? "—" : fmtT(l.weight_t)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.weightSource === "midweigh" ? "Weighbridge ticket" : l.weightSource === "skiptrak" ? "Skiptrak" : l.weightSource === "manual" ? "Entered" : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.charge == null ? "—" : fmtGBP(l.charge)}</TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">{l.needsWeight && <Chip tone="bad">No weight</Chip>}{l.awaitingPaperwork && <Chip tone="warn">Awaiting paperwork</Chip>}{l.hazardous && l.provider === "robert_hopkins" && !l.consignmentRef && <Chip tone="warn">No consignment ref</Chip>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve {m.label}</DialogTitle>
            <DialogDescription>The figures are frozen so this month's report can be reproduced exactly. Year-to-date totals keep updating from the records.</DialogDescription></DialogHeader>
          {m.outstanding.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-destructive">{m.outstanding.length} item{m.outstanding.length === 1 ? " is" : "s are"} still outstanding:</p>
              <ul className="list-disc pl-5 text-sm">{m.outstanding.map(o => <li key={o}>{o}</li>)}</ul>
              <label className="text-sm font-medium" htmlFor="colas-reason">Reason for approving anyway (required)</label>
              <Textarea id="colas-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
          ) : <p className="text-sm">All sources are received or approved.</p>}
          <DialogFooter><Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button><Button onClick={approve} disabled={busy === "approve"}>{busy === "approve" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Approve</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sourceDialog} onOpenChange={(o) => !o && setSourceDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve this source for {m.label}</DialogTitle><DialogDescription>Use this when the source is correct as it stands, for example no Enva collection took place this month.</DialogDescription></DialogHeader>
          <Input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="Note (e.g. No collection this month)" />
          <DialogFooter><Button variant="outline" onClick={() => setSourceDialog(null)}>Cancel</Button><Button onClick={() => sourceDialog && setSource(sourceDialog, true)} disabled={!sourceNote.trim() || !!busy}>Approve source</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
