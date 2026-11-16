import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES, PROVIDER_LABELS } from "@/lib/colas-report";
import { useInvalidateColas, type ColasSettingsRow, type ColasYearData } from "./useColasData";
import { Chip, ukDateTime, useColasAuthorised, useProfileNames } from "./ColasShared";

const TABLE_LABELS: Record<string, string> = { colas_manual_entries: "Collection entry", colas_consignments: "Consignment reference", colas_costs: "Cost line", colas_report_periods: "Monthly report", colas_opening_balances: "Opening balance", colas_report_settings: "Settings" };
const ACTION_LABELS: Record<string, string> = { insert: "Added", update: "Changed", void: "Voided", approve: "Approved", reopen: "Reopened", delete: "Deleted" };

export function ColasSettings({ data, settings }: { data: ColasYearData; settings: ColasSettingsRow }) {
  const authorised = useColasAuthorised();
  const invalidate = useInvalidateColas();
  const integ = useQuery({
    queryKey: ["colas", "integrations"],
    queryFn: async () => {
      const [up, imports] = await Promise.all([
        supabase.from("data_upload_log").select("source, uploaded_at, row_count, file_name").in("source", ["skiptrak", "midweigh"]).order("uploaded_at", { ascending: false }).limit(20),
        supabase.from("colas_import_log").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      return { uploads: up.data ?? [], imports: imports.data ?? [] };
    },
  });
  const audit = useQuery({
    queryKey: ["colas", "audit"],
    queryFn: async () => (await supabase.from("colas_audit_log").select("id, table_name, record_id, action, changed_by, changed_at, new_row, old_row").order("changed_at", { ascending: false }).limit(200)).data ?? [],
  });
  const names = useProfileNames([...(audit.data ?? []).map(a => a.changed_by), ...(integ.data?.imports ?? []).map(i => i.created_by)]);

  const lastUpload = (src: string) => integ.data?.uploads.find(u => u.source === src);
  const lastImport = (src: string) => integ.data?.imports.find(i => i.source === src);
  const lines = data.months.flatMap(m => m.lines);
  const hazJobs = lines.filter(l => l.hazardous && l.id.startsWith("skiptrak:"));
  const sources = [
    { name: "Skiptrak", how: "Uploaded through Data Uploads (export file)", last: lastUpload("skiptrak")?.uploaded_at, records: lines.filter(l => l.provider === "clews" || l.provider === "robert_hopkins").length, attention: lines.filter(l => (l.provider === "clews" || l.provider === "robert_hopkins") && l.needsWeight).length, attentionLabel: "without a weight" },
    { name: "Midweigh (Clews weighbridge)", how: "Uploaded through Data Uploads; fills missing Skiptrak weights from linked tickets", last: lastUpload("midweigh")?.uploaded_at, records: lines.filter(l => l.weightSource === "midweigh").length, attention: 0, attentionLabel: "" },
    { name: "QuickConsign paperwork (scanned into Skiptrak)", how: "Read from the job paperwork files already in the portal; consignment numbers entered by staff", last: null, records: hazJobs.filter(l => data.hazDocs.has(l.reference)).length, attention: hazJobs.filter(l => !l.consignmentRef).length, attentionLabel: "without a consignment reference" },
    { name: "Sage", how: "Not connected — Excel/CSV import", last: lastImport("sage")?.created_at, records: data.costs.filter(c => c.entry_type === "sage_import" && !c.voided_at).length, attention: data.months.filter(m => !m.inProgress && m.costs.source !== "sage").length, attentionLabel: "completed months without Sage figures", failed: lastImport("sage")?.rows_failed },
    ...(["enva", "bm", "fortress"] as const).map(p => ({ name: PROVIDER_LABELS[p], how: p === "enva" ? "Manual entry" : "Manual entry or Excel/CSV import", last: lastImport(p)?.created_at ?? data.manual.filter(e => e.provider === p).map(e => e.created_at).sort().pop(), records: data.manual.filter(e => e.provider === p && !e.voided_at).length, attention: data.manual.filter(e => e.provider === p && !e.voided_at && (e.status !== "confirmed" || e.weight_kg == null)).length, attentionLabel: "awaiting paperwork or weight", failed: lastImport(p)?.rows_failed })),
  ];

  const [startMonth, setStartMonth] = useState(String(settings.year_start_month));
  const [op, setOp] = useState({ hazardous_t: "", non_hazardous_t: "", hazardous_cost: "", non_hazardous_cost: "", note: "" });
  useEffect(() => {
    setOp({ hazardous_t: String(data.opening?.hazardous_t ?? 0), non_hazardous_t: String(data.opening?.non_hazardous_t ?? 0), hazardous_cost: String(data.opening?.hazardous_cost ?? 0), non_hazardous_cost: String(data.opening?.non_hazardous_cost ?? 0), note: "" });
  }, [data.year, data.opening]);
  const [saving, setSaving] = useState(false);

  const saveStart = async () => {
    const { error } = await supabase.from("colas_report_settings").update({ year_start_month: Number(startMonth) }).eq("id", 1);
    if (error) toast.error(error.message); else { toast.success("Reporting year updated"); invalidate(); }
  };
  const saveOpening = async () => {
    const vals = { hazardous_t: Number(op.hazardous_t), non_hazardous_t: Number(op.non_hazardous_t), hazardous_cost: Number(op.hazardous_cost), non_hazardous_cost: Number(op.non_hazardous_cost) };
    if (Object.values(vals).some(v => !Number.isFinite(v))) { toast.error("Opening balances must be numbers"); return; }
    setSaving(true);
    const { error } = await supabase.from("colas_opening_balances").upsert({ year: data.year, ...vals, note: op.note.trim() || null });
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Opening balance saved"); invalidate(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Data sources</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>How it arrives</TableHead><TableHead>Last import</TableHead><TableHead className="text-right">Records ({data.year})</TableHead><TableHead>Needs attention</TableHead></TableRow></TableHeader>
            <TableBody>
              {sources.map(s => (
                <TableRow key={s.name}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm">{s.how}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{s.last ? ukDateTime(s.last) : "—"}{(s as any).failed ? <div className="text-destructive">{(s as any).failed} failed rows</div> : null}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.records}</TableCell>
                  <TableCell>{s.attention ? <Chip tone="warn">{s.attention} {s.attentionLabel}</Chip> : <span className="text-sm text-muted-foreground">None</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-sm text-muted-foreground">No live connection to Skiptrak or Sage exists yet; neither has an API available to the portal. Figures update when files are uploaded.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Reporting year</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Year starts in</Label>
              <Select value={startMonth} onValueChange={setStartMonth} disabled={!authorised}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTH_NAMES.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent>
              </Select></div>
            {authorised && <Button variant="outline" onClick={saveStart} disabled={startMonth === String(settings.year_start_month)}>Save</Button>}
            <div className="border-t pt-3">
              <div className="font-medium">Colas Rail customer login</div>
              <p className="text-sm text-muted-foreground">{settings.customer_access_enabled ? "On" : "Off"} — Colas Rail cannot see any of this. Customer access stays off until a Clews administrator authorises it.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Opening balance – {data.year}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Figures carried in from before the portal's records start (for example from the old spreadsheet). Added once to the year-to-date totals.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["hazardous_t", "Hazardous (t)"], ["non_hazardous_t", "Non-hazardous (t)"], ["hazardous_cost", "Hazardous cost (£)"], ["non_hazardous_cost", "Non-hazardous cost (£)"]] as const).map(([k, l]) => (
                <div key={k} className="space-y-1"><Label htmlFor={`op-${k}`}>{l}</Label><Input id={`op-${k}`} inputMode="decimal" value={op[k]} onChange={(e) => setOp(o => ({ ...o, [k]: e.target.value }))} disabled={!authorised} /></div>
              ))}
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="op-note">Note</Label><Input id="op-note" value={op.note} onChange={(e) => setOp(o => ({ ...o, note: e.target.value }))} disabled={!authorised} /></div>
            </div>
            {authorised && <Button variant="outline" onClick={saveOpening} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save opening balance</Button>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Audit log</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>What</TableHead><TableHead>Action</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
            <TableBody>
              {(audit.data ?? []).map(a => {
                const r = (a.new_row ?? a.old_row ?? {}) as Record<string, any>;
                const detail = a.table_name === "colas_report_periods" ? `${MONTH_NAMES[(r.month ?? 1) - 1]} ${r.year}` : a.table_name === "colas_manual_entries" ? `${PROVIDER_LABELS[r.provider as keyof typeof PROVIDER_LABELS] ?? r.provider} ${r.collection_date} · ${r.weight_kg ?? "—"} kg` : a.table_name === "colas_costs" ? `${MONTH_NAMES[(r.month ?? 1) - 1]} ${r.year} · £${r.amount_ex_vat}` : a.table_name === "colas_consignments" ? `Job ${r.job_number} → ${r.consignment_ref ?? "—"}` : a.table_name === "colas_opening_balances" ? String(r.year) : "";
                return (
                  <TableRow key={a.id}><TableCell className="whitespace-nowrap text-sm">{ukDateTime(a.changed_at)}</TableCell><TableCell className="text-sm">{names.get(a.changed_by) ?? "System"}</TableCell><TableCell className="text-sm">{TABLE_LABELS[a.table_name] ?? a.table_name}</TableCell><TableCell className="text-sm">{ACTION_LABELS[a.action] ?? a.action}</TableCell><TableCell className="text-sm">{detail}</TableCell></TableRow>
                );
              })}
              {(audit.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nothing recorded yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
