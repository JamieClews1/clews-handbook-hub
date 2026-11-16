import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, Plus, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES, parseDateCell, parseMoney } from "@/lib/colas-report";
import { fmtGBP, useInvalidateColas, type ColasYearData } from "./useColasData";
import { Chip, ukDateTime, useColasAuthorised, useProfileNames } from "./ColasShared";

const catLabel = (c: string) => c === "hazardous" ? "Hazardous" : "Non-hazardous";

export function ColasCosts({ data }: { data: ColasYearData }) {
  const authorised = useColasAuthorised();
  const invalidate = useInvalidateColas();
  const [importOpen, setImportOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [voiding, setVoiding] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const names = useProfileNames(data.costs.map(c => c.created_by));
  const entries = data.costs.filter(c => data.months.some(m => m.year === c.year && m.month === c.month));

  const doVoid = async () => {
    const { error } = await supabase.from("colas_costs").update({ voided_at: new Date().toISOString(), void_reason: voidReason.trim() }).eq("id", voiding.id);
    if (error) toast.error(error.message); else { toast.success("Cost line voided"); setVoiding(null); setVoidReason(""); invalidate(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="max-w-3xl">
            <CardTitle className="text-lg">Monthly costs charged to Colas Rail (excluding VAT)</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">There is no Sage connection yet, so costs come from a Sage export (Excel/CSV). Until a month's Sage figures are imported, reports use the charges recorded on the Skiptrak jobs and mark them provisional. The correct Sage report still needs confirming with Sharon — some Sage reports include VAT.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />Import Sage export</Button>
            {authorised && <Button variant="outline" onClick={() => setAdjOpen(true)}><Plus className="mr-1 h-4 w-4" />Adjustment</Button>}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Sage hazardous</TableHead><TableHead className="text-right">Sage non-hazardous</TableHead><TableHead className="text-right">Adjustments</TableHead><TableHead className="text-right">Used in report</TableHead><TableHead className="text-right">Skiptrak charges (check)</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.months.map(m => (
                <TableRow key={m.label}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.costs.source === "sage" ? fmtGBP(m.costs.sageHazardous) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.costs.source === "sage" ? fmtGBP(m.costs.sageNonHazardous) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.costs.adjustmentsHazardous || m.costs.adjustmentsNonHazardous ? fmtGBP(m.costs.adjustmentsHazardous + m.costs.adjustmentsNonHazardous) : "—"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmtGBP(m.costs.total)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{fmtGBP(m.costs.skiptrakHazardous + m.costs.skiptrakNonHazardous)}</TableCell>
                  <TableCell>{m.costs.source === "sage" ? <Chip tone="good">Sage</Chip> : m.costs.source === "skiptrak" ? <Chip tone="warn">Provisional</Chip> : <Chip tone="neutral">None</Chip>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Imported and adjusted cost lines</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount (ex VAT)</TableHead><TableHead>Source / reason</TableHead><TableHead>Added</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {entries.map(c => (
                <TableRow key={c.id} className={c.voided_at ? "opacity-50" : ""}>
                  <TableCell>{MONTH_NAMES[c.month - 1]} {c.year}</TableCell>
                  <TableCell>{catLabel(c.category)}</TableCell>
                  <TableCell>{c.entry_type === "adjustment" ? <Chip tone="info">Adjustment</Chip> : <Chip tone="good">Sage import</Chip>}{c.voided_at && <span className="ml-1"><Chip tone="neutral">Voided</Chip></span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtGBP(Number(c.amount_ex_vat))}</TableCell>
                  <TableCell className="max-w-xs text-sm">{c.entry_type === "adjustment" ? c.reason : c.source_file}{c.void_reason && <div className="text-xs text-muted-foreground">Voided: {c.void_reason}</div>}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{ukDateTime(c.created_at)}<div>{names.get(c.created_by) ?? ""}</div></TableCell>
                  <TableCell>{authorised && !c.voided_at && <Button size="icon" variant="ghost" aria-label="Void" onClick={() => setVoiding(c)}><XCircle className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No Sage figures imported for {data.year} yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {importOpen && <SageImportDialog onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); invalidate(); }} />}
      {adjOpen && <AdjustmentDialog data={data} onClose={() => setAdjOpen(false)} onDone={() => { setAdjOpen(false); invalidate(); }} />}
      <Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void this cost line?</DialogTitle><DialogDescription>It stops counting in reports but stays on record with the reason.</DialogDescription></DialogHeader>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason (required)" />
          <DialogFooter><Button variant="outline" onClick={() => setVoiding(null)}>Cancel</Button><Button variant="destructive" disabled={!voidReason.trim()} onClick={doVoid}>Void</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdjustmentDialog({ data, onClose, onDone }: { data: ColasYearData; onClose: () => void; onDone: () => void }) {
  const [period, setPeriod] = useState(`${data.months[0].year}-${data.months[0].month}`);
  const [category, setCategory] = useState("non_hazardous");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const n = parseMoney(amount);
    if (n == null || n === 0) { toast.error("Enter the adjustment amount (use a minus sign for a reduction)"); return; }
    if (!reason.trim()) { toast.error("Give the reason for the adjustment"); return; }
    const [y, m] = period.split("-").map(Number);
    setSaving(true);
    const { error } = await supabase.from("colas_costs").insert({ year: y, month: m, category, entry_type: "adjustment", amount_ex_vat: n, reason: reason.trim() });
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Adjustment added"); onDone(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cost adjustment</DialogTitle><DialogDescription>Shown separately from the imported Sage figure on every report.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Month</Label><Select value={period} onValueChange={setPeriod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.months.map(m => <SelectItem key={m.label} value={`${m.year}-${m.month}`}>{m.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="non_hazardous">Non-hazardous</SelectItem><SelectItem value="hazardous">Hazardous</SelectItem></SelectContent></Select></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="adj-amt">Amount ex VAT (£)</Label><Input id="adj-amt" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. -62.00" /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="adj-reason">Reason</Label><Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>Add adjustment</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SageImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dateCol, setDateCol] = useState("");
  const [amountCol, setAmountCol] = useState("");
  const [catCol, setCatCol] = useState("");
  const [fixedCat, setFixedCat] = useState<"" | "hazardous" | "non_hazardous">("");
  const [confirmNet, setConfirmNet] = useState(false);
  const [saving, setSaving] = useState(false);

  const onFile = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const hs = Object.keys(json[0] ?? {});
    setFileName(file.name); setRows(json); setHeaders(hs);
    setDateCol(hs.find(h => /date|period|month/i.test(h)) ?? "");
    setAmountCol(hs.find(h => /net/i.test(h)) ?? "");
    setCatCol(hs.find(h => /haz|categ|nominal|desc|product/i.test(h)) ?? "");
  };
  const vatCols = headers.filter(h => /vat|gross|total inc/i.test(h));
  const amountLooksGross = /gross|inc|vat/i.test(amountCol);
  const parsed = useMemo(() => rows.map(r => {
    const date = dateCol ? parseDateCell(r[dateCol]) : null;
    const amount = amountCol ? parseMoney(r[amountCol]) : null;
    const catText = catCol ? String(r[catCol] ?? "") : "";
    const category = fixedCat || (/\bhaz/i.test(catText) && !/non[\s-]?haz/i.test(catText) ? "hazardous" : "non_hazardous");
    return { date, amount, category, catText, raw: r, problem: !date ? "No valid date" : amount == null ? "No amount" : "" };
  }), [rows, dateCol, amountCol, catCol, fixedCat]);
  const good = parsed.filter(p => !p.problem && p.amount !== 0);
  const totals = useMemo(() => {
    const t = new Map<string, { h: number; n: number }>();
    for (const g of good) { const k = g.date!.slice(0, 7); const v = t.get(k) ?? { h: 0, n: 0 }; if (g.category === "hazardous") v.h += g.amount!; else v.n += g.amount!; t.set(k, v); }
    return [...t.entries()].sort();
  }, [good]);

  const doImport = async () => {
    setSaving(true);
    try {
      const years = [...new Set(good.map(g => Number(g.date!.slice(0, 4))))];
      const { data: prior, error: pe } = await supabase.from("colas_costs").select("source_row").eq("entry_type", "sage_import").is("voided_at", null).in("year", years);
      if (pe) throw pe;
      const seen = new Set((prior ?? []).map(p => JSON.stringify(p.source_row)));
      const fresh = good.filter(g => { const k = JSON.stringify(g.raw); if (seen.has(k)) return false; seen.add(k); return true; });
      const dupes = good.length - fresh.length;
      if (!fresh.length) { toast.info("Every line in this file has already been imported"); setSaving(false); return; }
      const { data: log, error: le } = await supabase.from("colas_import_log").insert({ source: "sage", file_name: fileName, rows_imported: fresh.length, rows_flagged: dupes, rows_failed: parsed.filter(p => p.problem).length, details: { dateCol, amountCol, catCol, fixedCat } }).select("id").single();
      if (le) throw le;
      for (let i = 0; i < fresh.length; i += 200) {
        const { error } = await supabase.from("colas_costs").insert(fresh.slice(i, i + 200).map(g => ({
          year: Number(g.date!.slice(0, 4)), month: Number(g.date!.slice(5, 7)), category: g.category, entry_type: "sage_import",
          amount_ex_vat: g.amount!, original_amount: g.amount!, source_file: fileName, source_row: g.raw, import_id: log.id,
        })));
        if (error) throw error;
      }
      toast.success(`${fresh.length} Sage line${fresh.length === 1 ? "" : "s"} imported${dupes ? ` · ${dupes} already imported, skipped` : ""}`);
      onDone();
    } catch (e: any) { toast.error(e.message ?? String(e)); } finally { setSaving(false); }
  };

  const sel = (value: string, set: (v: string) => void, label: string, optional = false) => (
    <div className="space-y-1"><Label>{label}</Label>
      <Select value={value || "__none"} onValueChange={(v) => set(v === "__none" ? "" : v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{optional && <SelectItem value="__none">— none —</SelectItem>}{!optional && !value && <SelectItem value="__none">Choose…</SelectItem>}{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
      </Select></div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Import Sage costs</DialogTitle><DialogDescription>Choose the columns, check the monthly totals against Sage, then import. Original rows are stored with each line.</DialogDescription></DialogHeader>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <Button variant="outline" onClick={() => ref.current?.click()}><Upload className="mr-1 h-4 w-4" />{fileName || "Choose Sage export"}</Button>
        {headers.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sel(dateCol, setDateCol, "Invoice date / period")}
              {sel(amountCol, setAmountCol, "Net amount (ex VAT)")}
              {sel(catCol, setCatCol, "Category column (optional)", true)}
              <div className="space-y-1"><Label>Or treat every row as</Label>
                <Select value={fixedCat || "__auto"} onValueChange={(v) => setFixedCat(v === "__auto" ? "" : v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__auto">Decide from category column</SelectItem><SelectItem value="hazardous">Hazardous</SelectItem><SelectItem value="non_hazardous">Non-hazardous</SelectItem></SelectContent>
                </Select></div>
            </div>
            {(amountLooksGross || vatCols.length > 0) && <p className="rounded-md bg-warning-subtle p-2 text-sm text-warning-text">This file has VAT or gross columns ({vatCols.join(", ") || amountCol}). Make sure the amount column is the net figure.</p>}
            <div className="max-h-60 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Hazardous</TableHead><TableHead className="text-right">Non-hazardous</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>{totals.map(([k, v]) => <TableRow key={k}><TableCell>{MONTH_NAMES[Number(k.slice(5)) - 1]} {k.slice(0, 4)}</TableCell><TableCell className="text-right tabular-nums">{fmtGBP(v.h)}</TableCell><TableCell className="text-right tabular-nums">{fmtGBP(v.n)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{fmtGBP(v.h + v.n)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground">{good.length} lines ready · {parsed.length - good.length} skipped (no date, no amount or zero)</p>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={confirmNet} onCheckedChange={(v) => setConfirmNet(!!v)} />I have checked these totals against Sage and the amounts exclude VAT</label>
          </>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!good.length || !confirmNet || saving} onClick={doImport}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Import</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
