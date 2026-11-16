import { useMemo, useState } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { OrderFileViewer, type OrderFileToView } from "@/components/orders/OrderFileViewer";
import { PROVIDER_LABELS } from "@/lib/colas-report";
import { fmtT, useInvalidateColas, type ColasYearData } from "./useColasData";
import { Chip, ukDate } from "./ColasShared";

export function ColasHazardous({ data }: { data: ColasYearData }) {
  const invalidate = useInvalidateColas();
  const [missingOnly, setMissingOnly] = useState(false);
  const [view, setView] = useState<OrderFileToView | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const jobByNumber = useMemo(() => new Map(data.jobs.map(j => [j.job_number, j])), [data.jobs]);
  const rows = useMemo(() => data.months.flatMap(m => m.lines.filter(l => l.hazardous && l.id.startsWith("skiptrak:"))).filter(l => !missingOnly || !l.consignmentRef || l.needsWeight), [data.months, missingOnly]);
  const withScan = rows.filter(r => data.hazDocs.has(r.reference)).length;

  const save = async (job: string) => {
    const value = (drafts[job] ?? "").trim();
    if (value === (data.consignments.get(job) ?? "")) return;
    setSaving(job);
    const { error } = await supabase.from("colas_consignments").upsert({ job_number: job, source: "skiptrak", consignment_ref: value || null }, { onConflict: "job_number,source" });
    setSaving(null);
    if (error) toast.error(error.message); else { toast.success(`Consignment reference saved for job ${job}`); invalidate(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Robert Hopkins hazardous collections</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Weights come from Skiptrak, which records the Robert Hopkins weighbridge figure. The QuickConsign consignment note is scanned into each job's Skiptrak paperwork — open it to read the note number. Estimated quantities on the note are not used.</p>
          </div>
          <div className="flex items-center gap-2"><Switch id="haz-missing" checked={missingOnly} onCheckedChange={setMissingOnly} /><Label htmlFor="haz-missing">Needs attention only</Label></div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{rows.length} hazardous collection{rows.length === 1 ? "" : "s"} · scanned paperwork found for {withScan}.</p>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Job</TableHead><TableHead>Waste</TableHead><TableHead>EWC</TableHead><TableHead>Taken to</TableHead><TableHead className="text-right">Tonnes</TableHead><TableHead>Weighbridge ticket</TableHead><TableHead>Consignment reference</TableHead><TableHead>Paperwork</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(l => {
                const job = jobByNumber.get(l.reference);
                const doc = data.hazDocs.get(l.reference);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{ukDate(l.date)}</TableCell>
                    <TableCell className="font-medium">{l.reference}</TableCell>
                    <TableCell className="min-w-[16rem]">{l.description}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.ewc}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.provider === "robert_hopkins" ? "Robert Hopkins" : job?.tipping_location ?? PROVIDER_LABELS[l.provider]}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.weight_t == null ? <Chip tone="bad">No weight</Chip> : fmtT(l.weight_t)}</TableCell>
                    <TableCell className="tabular-nums">{job?.weighbridge_ref ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input className="h-9 w-44" placeholder="e.g. COLASR/00154" aria-label={`Consignment reference for job ${l.reference}`}
                          value={drafts[l.reference] ?? l.consignmentRef ?? ""}
                          onChange={(e) => setDrafts(d => ({ ...d, [l.reference]: e.target.value }))}
                          onBlur={() => drafts[l.reference] != null && save(l.reference)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(l.reference); } }} />
                        {saving === l.reference && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc ? <Button size="sm" variant="outline" onClick={() => setView({ name: doc.file_name, load: async () => { const { data: b, error } = await supabase.storage.from("wtn-documents").download(doc.storage_path); if (error || !b) throw error ?? new Error("File not found"); return b; } })}><FileSearch className="mr-1 h-4 w-4" />View scan</Button>
                        : <Chip tone="warn">Not uploaded</Chip>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nothing to show.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <OrderFileViewer file={view} onClose={() => setView(null)} />
    </div>
  );
}
