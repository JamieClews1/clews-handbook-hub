import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderFileViewer, type OrderFileToView } from "@/components/orders/OrderFileViewer";
import { CONSIGNMENT_ISSUE_LABELS, type ConsignmentIssue } from "@/lib/colas-report";
import { duplicateConsignmentJob, looksLikeQuickConsign, needsManualConsignment, normaliseConsignmentRef } from "@/lib/colas-manual-consignment";
import { fmtT, useInvalidateColas, type ColasYearData } from "./useColasData";
import { Chip, ukDate } from "./ColasShared";

interface Draft { ref: string; notes: string }

/**
 * Jobs the automatic reader couldn't read: staff type the consignment number and/or their own note.
 * Saving a number clears the reading flag (same rule as the Hazardous tab); a note alone keeps the job flagged.
 */
export function ColasManualConsignments({ data }: { data: ColasYearData }) {
  const invalidate = useInvalidateColas();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [view, setView] = useState<OrderFileToView | null>(null);

  const hazLines = useMemo(() => data.months.flatMap(m => m.lines.filter(l => l.hazardous && l.id.startsWith("skiptrak:") && !l.consignmentRef)), [data.months]);
  const jobNumbers = useMemo(() => hazLines.map(l => l.reference), [hazLines]);
  const attempts = useQuery({
    queryKey: ["colas", "auto-reader", "latest", jobNumbers],
    enabled: jobNumbers.length > 0,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("colas_consignment_scan_attempts").select("job_number, result, evidence, created_at").in("job_number", jobNumbers).order("created_at", { ascending: false });
      if (error) throw error;
      const latest = new Map<string, { result: string; evidence: string | null; created_at: string }>();
      for (const r of rows ?? []) if (!latest.has(r.job_number)) latest.set(r.job_number, r);
      return latest;
    },
  });
  const rows = hazLines.filter(l => needsManualConsignment(l, attempts.data?.get(l.reference)?.result));

  const draftFor = (job: string): Draft => drafts[job] ?? { ref: "", notes: data.consignmentNotes.get(job) ?? "" };
  const setDraft = (job: string, patch: Partial<Draft>) => setDrafts(d => ({ ...d, [job]: { ...draftFor(job), ...patch } }));

  const save = async (job: string) => {
    const d = draftFor(job);
    const ref = d.ref ? normaliseConsignmentRef(d.ref) : "";
    const notes = d.notes.trim() || null;
    if (!ref && notes === (data.consignmentNotes.get(job) ?? null)) { toast.info("Nothing new to save"); return; }
    if (ref) {
      const dup = duplicateConsignmentJob(ref, job, data.consignments);
      if (dup) { toast.error(`${ref} is already saved on job ${dup}. Check the number before saving.`); return; }
    }
    setSaving(job);
    const payload = ref
      ? { job_number: job, source: "skiptrak", consignment_ref: ref, read_issue: null, auto_read_at: null, auto_evidence: null, notes }
      : { job_number: job, source: "skiptrak", notes };
    const { error } = await supabase.from("colas_consignments").upsert(payload, { onConflict: "job_number,source" });
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(ref ? `${ref} saved for job ${job}${looksLikeQuickConsign(ref) ? "" : " — it doesn't look like a QuickConsign number, so please double-check it"}` : `Note saved for job ${job}. It stays flagged until a number is added.`);
    setDrafts(x => { const { [job]: _, ...rest } = x; return rest; });
    invalidate();
  };

  const setIssue = async (job: string, issue: ConsignmentIssue | null) => {
    setSaving(job);
    const { error } = await supabase.from("colas_consignments").upsert({ job_number: job, source: "skiptrak", read_issue: issue, auto_read_at: null }, { onConflict: "job_number,source" });
    setSaving(null);
    if (error) toast.error(error.message); else invalidate();
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-base font-semibold">Couldn't read — add your own details ({data.year})</h3>
        <p className="mt-1 text-sm text-muted-foreground">These jobs have no consignment number because the reader couldn't read the scan or the page wasn't there. Type the number from the paperwork or QuickConsign, and add any note you want kept with the job. Saving a number clears the flag on the monthly report; a note on its own keeps the job flagged.</p>
      </div>
      {attempts.isLoading && jobNumbers.length > 0 ? <Loader2 className="h-5 w-5 animate-spin" /> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting — every job the reader checked has a number.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(l => {
            const job = l.reference;
            const doc = data.hazDocs.get(job);
            const latest = attempts.data?.get(job);
            const d = draftFor(job);
            const typed = d.ref ? normaliseConsignmentRef(d.ref) : "";
            return (
              <li key={l.id} className="rounded-md border bg-card p-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-base font-semibold">Job {job}</span>
                  <span>{ukDate(l.date)}</span>
                  <span>{l.description}</span>
                  <span className="tabular-nums text-muted-foreground">{l.weight_t == null ? "No weight" : `${fmtT(l.weight_t)} t`}</span>
                  <Chip tone="bad">{l.consignmentIssue ? CONSIGNMENT_ISSUE_LABELS[l.consignmentIssue] : "Reader found no number"}</Chip>
                  {doc ? (
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => setView({ name: doc.file_name, load: async () => { const { data: b, error } = await supabase.storage.from("wtn-documents").download(doc.storage_path); if (error || !b) throw error ?? new Error("File not found"); return b; } })}>
                      <FileSearch className="mr-1 h-4 w-4" />View scan
                    </Button>
                  ) : <span className="ml-auto"><Chip tone="warn">Scan not uploaded</Chip></span>}
                </div>
                {latest?.evidence && <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Reader saw ({ukDate(latest.created_at.slice(0, 10))}):</span> {latest.evidence}</p>}
                <div className="mt-3 grid gap-3 md:grid-cols-[14rem_12rem_1fr_auto] md:items-end">
                  <div className="space-y-1">
                    <Label htmlFor={`mc-ref-${job}`}>Consignment number</Label>
                    <Input id={`mc-ref-${job}`} placeholder="e.g. COLASR/00154" value={d.ref} onChange={(e) => setDraft(job, { ref: e.target.value })} />
                    {typed && !looksLikeQuickConsign(typed) && <p className="text-sm text-muted-foreground">Doesn't look like COLASR/00000 — check before saving.</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Reading problem</Label>
                    <Select value={l.consignmentIssue ?? "none"} onValueChange={(v) => setIssue(job, v === "none" ? null : v as ConsignmentIssue)}>
                      <SelectTrigger aria-label={`Reading problem for job ${job}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        <SelectItem value="unreadable">Can't read</SelectItem>
                        <SelectItem value="page_missing">Page missing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`mc-notes-${job}`}>Your notes</Label>
                    <Textarea id={`mc-notes-${job}`} rows={2} placeholder="e.g. Number taken from QuickConsign portal; asked Robert Hopkins for a rescan" value={d.notes} onChange={(e) => setDraft(job, { notes: e.target.value })} />
                  </div>
                  <Button onClick={() => save(job)} disabled={saving === job}>
                    {saving === job ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PenLine className="mr-1 h-4 w-4" />}Save
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <OrderFileViewer file={view} onClose={() => setView(null)} />
    </div>
  );
}
