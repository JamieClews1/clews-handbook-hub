import { useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { duplicateConsignmentJob, normaliseConsignmentRef, planConsignmentMove, type RestoreIssue } from "@/lib/colas-manual-consignment";
import { fmtT, useInvalidateColas, type ColasYearData } from "./useColasData";
import { ukDate } from "./ColasShared";

export interface ConsignmentAuditEntry { job: string; oldRow: Record<string, any> | null; newRow: Record<string, any> | null }

/**
 * Corrects a consignment number from the audit log: either fix the details on the same job,
 * or move a number typed on the wrong job to the right one. The log itself is never rewritten —
 * each correction is a normal change, so it appears as a new line in the audit log.
 */
export function ColasConsignmentCorrection({ entry, data, onClose }: { entry: ConsignmentAuditEntry; data: ColasYearData; onClose: () => void }) {
  const invalidate = useInvalidateColas();
  const job = entry.job;
  const currentRef = data.consignments.get(job) ?? null;
  const currentNote = data.consignmentNotes.get(job) ?? "";
  // Reading problem the job had before a number was typed on it, so moving the number off re-opens the issue.
  const previousIssue = (entry.oldRow && !entry.oldRow.consignment_ref ? entry.oldRow.read_issue : null) as RestoreIssue;

  const lines = useMemo(() => data.months.flatMap(m => m.lines.filter(l => l.hazardous && l.id.startsWith("skiptrak:"))), [data.months]);
  const knownJobs = useMemo(() => new Set([...lines.map(l => l.reference), ...data.consignments.keys()]), [lines, data.consignments]);
  const lineFor = (j: string) => lines.find(l => l.reference === j);

  const [mode, setMode] = useState<"move" | "edit">(currentRef ? "move" : "edit");
  const [toJob, setToJob] = useState("");
  const [restore, setRestore] = useState<string>(previousIssue ?? "unreadable");
  const [ref, setRef] = useState(currentRef ?? "");
  const [note, setNote] = useState(currentNote);
  const [saving, setSaving] = useState(false);

  const target = toJob.trim() ? lineFor(toJob.trim()) : undefined;
  const from = lineFor(job);

  const move = async () => {
    const plan = planConsignmentMove({ fromJob: job, toJob, ref: currentRef, restoreIssue: restore === "none" ? null : restore as RestoreIssue, saved: data.consignments, knownJobs });
    if ("error" in plan) { toast.error(plan.error); return; }
    setSaving(true);
    const a = await supabase.from("colas_consignments").upsert(plan.clearFrom, { onConflict: "job_number,source" });
    if (a.error) { setSaving(false); toast.error(a.error.message); return; }
    const b = await supabase.from("colas_consignments").upsert(plan.setTo, { onConflict: "job_number,source" });
    if (b.error) {
      // Put the number back on the original job so nothing is lost.
      await supabase.from("colas_consignments").upsert({ job_number: job, source: "skiptrak", consignment_ref: currentRef, read_issue: null }, { onConflict: "job_number,source" });
      setSaving(false); toast.error(b.error.message); return;
    }
    setSaving(false);
    toast.success(`${plan.setTo.consignment_ref} moved from job ${job} to job ${plan.setTo.job_number}`);
    invalidate(); onClose();
  };

  const saveEdit = async () => {
    const value = ref.trim() ? normaliseConsignmentRef(ref) : null;
    const notes = note.trim() || null;
    if (value === currentRef && notes === (currentNote || null)) { toast.info("Nothing changed"); return; }
    if (value) {
      const dup = duplicateConsignmentJob(value, job, data.consignments);
      if (dup) { toast.error(`${value} is already saved on job ${dup}. Correct that job first.`); return; }
    }
    setSaving(true);
    const payload = value
      ? { job_number: job, source: "skiptrak", consignment_ref: value, read_issue: null, auto_read_at: null, auto_evidence: null, notes }
      : { job_number: job, source: "skiptrak", consignment_ref: null, read_issue: currentRef ? (restore === "none" ? null : restore) : undefined, auto_read_at: null, auto_evidence: null, notes };
    const { error } = await supabase.from("colas_consignments").upsert(payload, { onConflict: "job_number,source" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Job ${job} updated`);
    invalidate(); onClose();
  };

  const JobSummary = ({ j }: { j: string }) => {
    const l = lineFor(j);
    return l ? <span className="text-sm text-muted-foreground">{ukDate(l.date)} · {l.description} · {l.weight_t == null ? "no weight" : `${fmtT(l.weight_t)} t`}</span> : null;
  };

  const restoreSelect = (
    <div className="space-y-1">
      <Label>After the number is removed, job {job} should show</Label>
      <Select value={restore} onValueChange={setRestore}>
        <SelectTrigger aria-label="Reading problem for the original job"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="unreadable">Can't read</SelectItem>
          <SelectItem value="page_missing">Page missing</SelectItem>
          <SelectItem value="none">No problem set</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Correct job {job}</DialogTitle>
          <DialogDescription>The audit log keeps what was entered. Your correction is saved as a new change and shows at the top of the log.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="font-medium">Job {job} now: {currentRef ?? "no consignment number"}</div>
          <JobSummary j={job} />
          {currentNote && <div className="mt-1 text-muted-foreground">Note: {currentNote}</div>}
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "move" | "edit")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="move" disabled={!currentRef}>Move to the right job</TabsTrigger>
            <TabsTrigger value="edit">Change on this job</TabsTrigger>
          </TabsList>
          <TabsContent value="move" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor="cc-to">Job number it should be on</Label>
              <Input id="cc-to" inputMode="numeric" placeholder="e.g. 49134" value={toJob} onChange={(e) => setToJob(e.target.value)} />
              {toJob.trim() && (target ? <JobSummary j={toJob.trim()} /> : <p className="text-sm text-destructive">Not a hazardous Colas Rail job in {data.year}.</p>)}
              {target && data.consignments.get(target.reference) && <p className="text-sm text-destructive">Job {target.reference} already has {data.consignments.get(target.reference)}.</p>}
            </div>
            {restoreSelect}
            {target && currentRef && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                <span className="font-medium">{currentRef}</span>: job {job} <ArrowRight className="h-4 w-4" aria-hidden /> job {target.reference}
              </div>
            )}
            <p className="text-sm text-muted-foreground">Each job keeps its own note. {from ? "" : `Job ${job} isn't in the ${data.year} report, but the move still works.`}</p>
          </TabsContent>
          <TabsContent value="edit" className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor="cc-ref">Consignment number</Label>
              <Input id="cc-ref" placeholder="Leave empty to remove it" value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
            {currentRef && !ref.trim() && restoreSelect}
            <div className="space-y-1">
              <Label htmlFor="cc-note">Note</Label>
              <Textarea id="cc-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {mode === "move"
            ? <Button onClick={move} disabled={saving || !target || !currentRef || (!!data.consignments.get(target.reference) && data.consignments.get(target.reference) !== currentRef)}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Move number</Button>
            : <Button onClick={saveEdit} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
