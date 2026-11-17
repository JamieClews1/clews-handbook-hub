import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileSearch, History, Loader2, Pencil, Plus, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderFileViewer, type OrderFileToView } from "@/components/orders/OrderFileViewer";
import { COLAS_STREAMS, MANUAL_DEFAULT_STREAM, PROVIDER_LABELS, manualDuplicateKey, parseDateCell, parseWeightKg, streamIsHazardous, streamLabel, type ManualProvider } from "@/lib/colas-report";
import { fmtT, useInvalidateColas, type ColasYearData } from "./useColasData";
import { Chip, ukDate, ukDateTime, useColasAuthorised, useProfileNames } from "./ColasShared";

const PROVIDER_INTRO: Record<ManualProvider, string> = {
  enva: "Enva empties the Mill Road waste oil tank by suction tanker and sends hard-copy consignment notes, often late. Enter each collection, and mark it confirmed once the paperwork arrives.",
  bm: "B&M wheelie bin collection weights — enter them one at a time or upload B&M's spreadsheet.",
  fortress: "Fortress food waste collections — enter them one at a time or upload Fortress's spreadsheet.",
};
const DEFAULT_LOCATION = "Mill Road, Rugby CV21 1BE";

type Entry = Record<string, any>;

export function ColasCollections({ data }: { data: ColasYearData }) {
  const [tab, setTab] = useState<ManualProvider>("enva");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ManualProvider)}>
      <TabsList>
        <TabsTrigger value="enva">Enva – waste oil</TabsTrigger>
        <TabsTrigger value="bm">B&amp;M – wheelie bins</TabsTrigger>
        <TabsTrigger value="fortress">Fortress – food waste</TabsTrigger>
      </TabsList>
      {(["enva", "bm", "fortress"] as ManualProvider[]).map(p => (
        <TabsContent key={p} value={p}><ProviderEntries provider={p} data={data} /></TabsContent>
      ))}
    </Tabs>
  );
}

function ProviderEntries({ provider, data }: { provider: ManualProvider; data: ColasYearData }) {
  const authorised = useColasAuthorised();
  const invalidate = useInvalidateColas();
  const [edit, setEdit] = useState<Entry | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<OrderFileToView | null>(null);
  const [history, setHistory] = useState<Entry | null>(null);
  const [voiding, setVoiding] = useState<Entry | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const entries = data.manual.filter(e => e.provider === provider && (showVoided || !e.voided_at));
  const totalKg = entries.filter(e => !e.voided_at).reduce((a, e) => a + Number(e.weight_kg ?? 0), 0);

  const doVoid = async () => {
    if (!voiding || !voidReason.trim()) return;
    const { error } = await supabase.from("colas_manual_entries").update({ voided_at: new Date().toISOString(), void_reason: voidReason.trim() }).eq("id", voiding.id);
    if (error) toast.error(error.message); else { toast.success("Entry voided"); setVoiding(null); setVoidReason(""); invalidate(); }
  };

  return (
    <Card className="mt-3">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="max-w-3xl"><CardTitle className="text-lg">{PROVIDER_LABELS[provider]}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{PROVIDER_INTRO[provider]}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />Upload Excel / CSV</Button>
          <Button onClick={() => setEdit({ provider })}><Plus className="mr-1 h-4 w-4" />Add collection</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{entries.filter(e => !e.voided_at).length} entries in {data.year} · {fmtT(totalKg / 1000)} t</span>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />Show voided entries</label>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Waste</TableHead><TableHead className="text-right">kg</TableHead><TableHead className="text-right">Tonnes</TableHead><TableHead>Reference</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Paperwork</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {entries.map(e => (
              <TableRow key={e.id} className={e.voided_at ? "opacity-50" : ""}>
                <TableCell className="whitespace-nowrap">{ukDate(e.collection_date)}</TableCell>
                <TableCell>{e.waste_type || streamLabel(e.waste_stream)}<div className="text-xs text-muted-foreground">{streamLabel(e.waste_stream)} · {e.hazardous ? "Hazardous" : "Non-hazardous"}</div></TableCell>
                <TableCell className="text-right tabular-nums">{e.weight_kg == null ? <Chip tone="bad">Missing</Chip> : Number(e.weight_kg).toLocaleString("en-GB")}</TableCell>
                <TableCell className="text-right tabular-nums">{e.weight_kg == null ? "—" : fmtT(Number(e.weight_kg) / 1000)}</TableCell>
                <TableCell>{e.consignment_ref || e.collection_reference || "—"}{e.consignment_ref && e.collection_reference && <div className="text-xs text-muted-foreground">{e.collection_reference}</div>}</TableCell>
                <TableCell>{e.location || "—"}</TableCell>
                <TableCell>{e.voided_at ? <Chip tone="neutral">Voided</Chip> : e.status === "confirmed" ? <Chip tone="good">Confirmed</Chip> : <Chip tone="warn">Awaiting paperwork</Chip>}</TableCell>
                <TableCell>{e.document_path ? <Button size="sm" variant="ghost" onClick={() => setView({ name: e.document_name || "document", load: async () => { const { data: b, error } = await supabase.storage.from("colas-documents").download(e.document_path); if (error || !b) throw error ?? new Error("File not found"); return b; } })}><FileSearch className="mr-1 h-4 w-4" />View</Button> : "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="icon" variant="ghost" aria-label="History" onClick={() => setHistory(e)}><History className="h-4 w-4" /></Button>
                  {!e.voided_at && <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(e)}><Pencil className="h-4 w-4" /></Button>}
                  {!e.voided_at && authorised && <Button size="icon" variant="ghost" aria-label="Void" onClick={() => setVoiding(e)}><XCircle className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No {PROVIDER_LABELS[provider]} collections entered for {data.year} yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      {edit && <EntryDialog entry={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); invalidate(); }} />}
      {importOpen && <ImportDialog provider={provider} existing={data.manual} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); invalidate(); }} />}
      {history && <HistoryDialog entry={history} onClose={() => setHistory(null)} />}
      <OrderFileViewer file={view} onClose={() => setView(null)} />
      <Dialog open={!!voiding} onOpenChange={(o) => !o && setVoiding(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void this entry?</DialogTitle><DialogDescription>Voided entries leave every report but stay on record with the reason.</DialogDescription></DialogHeader>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason (required)" />
          <DialogFooter><Button variant="outline" onClick={() => setVoiding(null)}>Cancel</Button><Button variant="destructive" disabled={!voidReason.trim()} onClick={doVoid}>Void entry</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function EntryDialog({ entry, onClose, onSaved }: { entry: Entry; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const provider = entry.provider as ManualProvider;
  const [f, setF] = useState<Entry>({
    collection_date: entry.collection_date ?? "", waste_stream: entry.waste_stream ?? MANUAL_DEFAULT_STREAM[provider], waste_type: entry.waste_type ?? "",
    weight_kg: entry.weight_kg ?? "", consignment_ref: entry.consignment_ref ?? "", collection_reference: entry.collection_reference ?? "",
    location: entry.location ?? DEFAULT_LOCATION, notes: entry.notes ?? "", status: entry.status ?? "awaiting_paperwork",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const kg = f.weight_kg === "" ? null : Number(f.weight_kg);
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }));

  const save = async () => {
    if (!f.collection_date) { toast.error("Enter the collection date"); return; }
    if (kg != null && (!Number.isFinite(kg) || kg < 0)) { toast.error("Weight must be a positive number of kg"); return; }
    setSaving(true);
    try {
      let document_path = entry.document_path ?? null, document_name = entry.document_name ?? null;
      if (file) {
        const path = `${provider}/${f.collection_date}/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("colas-documents").upload(path, file);
        if (error) throw error;
        document_path = path; document_name = file.name;
      }
      const row = {
        provider, collection_date: f.collection_date, waste_stream: f.waste_stream, waste_type: f.waste_type.trim() || null, hazardous: streamIsHazardous(f.waste_stream),
        weight_kg: kg, consignment_ref: f.consignment_ref.trim() || null, collection_reference: f.collection_reference.trim() || null,
        location: f.location.trim() || null, notes: f.notes.trim() || null, status: f.status, document_path, document_name, updated_by: user?.id ?? null,
      };
      const { error } = entry.id ? await supabase.from("colas_manual_entries").update(row).eq("id", entry.id) : await supabase.from("colas_manual_entries").insert(row);
      if (error) throw error;
      toast.success(entry.id ? "Entry updated" : "Collection added");
      onSaved();
    } catch (e: any) { toast.error(e.message ?? String(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{entry.id ? "Edit" : "Add"} {PROVIDER_LABELS[provider]} collection</DialogTitle><DialogDescription>Every change is kept in the record's history.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="ce-date">Collection date</Label><Input id="ce-date" type="date" value={f.collection_date} onChange={(e) => set("collection_date", e.target.value)} /></div>
          <div className="space-y-1"><Label>Waste stream</Label>
            <Select value={f.waste_stream} onValueChange={(v) => set("waste_stream", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COLAS_STREAMS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}{s.hazardous ? " (hazardous)" : ""}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="ce-type">Waste type / description</Label><Input id="ce-type" value={f.waste_type} onChange={(e) => set("waste_type", e.target.value)} placeholder={provider === "enva" ? "e.g. Waste engine oil 13 02 05*" : ""} /></div>
          <div className="space-y-1"><Label htmlFor="ce-kg">Net weight (kg)</Label><Input id="ce-kg" inputMode="decimal" value={f.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} placeholder="Leave blank if not known yet" /></div>
          <div className="space-y-1"><Label>Net weight (tonnes)</Label><div className="flex h-10 items-center rounded-md border bg-muted px-3 tabular-nums">{kg != null && Number.isFinite(kg) ? fmtT(kg / 1000) : "—"}</div></div>
          <div className="space-y-1"><Label htmlFor="ce-cons">Consignment note reference</Label><Input id="ce-cons" value={f.consignment_ref} onChange={(e) => set("consignment_ref", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ce-ref">Collection reference</Label><Input id="ce-ref" value={f.collection_reference} onChange={(e) => set("collection_reference", e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="ce-loc">Collection location</Label><Input id="ce-loc" value={f.location} onChange={(e) => set("location", e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="ce-doc">Supporting document</Label><Input id="ce-doc" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />{entry.document_name && !file && <p className="text-xs text-muted-foreground">Current: {entry.document_name}</p>}</div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="ce-notes">Notes</Label><Textarea id="ce-notes" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Paperwork</Label>
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="awaiting_paperwork">Awaiting confirmation / paperwork</SelectItem><SelectItem value="confirmed">Confirmed – paperwork received</SelectItem></SelectContent>
            </Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const pick = (headers: string[], re: RegExp) => headers.find(h => re.test(h.toLowerCase())) ?? "";

function ImportDialog({ provider, existing, onClose, onDone }: { provider: ManualProvider; existing: Entry[]; onClose: () => void; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState({ date: "", weight: "", ref: "", type: "", location: "", notes: "" });
  const [unit, setUnit] = useState<"kg" | "t">("kg");
  const [saving, setSaving] = useState(false);

  const onFile = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    const hs = Object.keys(json[0] ?? {});
    setFileName(file.name); setRows(json); setHeaders(hs);
    setMap({ date: pick(hs, /date/), weight: pick(hs, /weight|kg|tonn|qty|quantity/), ref: pick(hs, /ref|ticket|consign|job|docket/), type: pick(hs, /waste|type|desc|product/), location: pick(hs, /site|location|address/), notes: pick(hs, /note|comment/) });
    if (hs.some(h => /tonn/i.test(h)) && !hs.some(h => /kg/i.test(h))) setUnit("t");
  };

  const existingKeys = useMemo(() => new Set(existing.filter(e => e.provider === provider && !e.voided_at).map(e => manualDuplicateKey(provider, e.collection_date, e.weight_kg == null ? null : Number(e.weight_kg), e.collection_reference || e.consignment_ref))), [existing, provider]);
  const parsed = useMemo(() => {
    const seen = new Set<string>();
    return rows.map(r => {
      const date = map.date ? parseDateCell(r[map.date]) : null;
      const kg = map.weight ? parseWeightKg(r[map.weight], unit) : null;
      const ref = map.ref ? String(r[map.ref] ?? "").trim() : "";
      const key = date ? manualDuplicateKey(provider, date, kg, ref) : "";
      const problem = !date ? "No valid date" : kg == null ? "No valid weight" : existingKeys.has(key) ? "Already entered" : seen.has(key) ? "Duplicate row in file" : "";
      if (key) seen.add(key);
      return { date, kg, ref, type: map.type ? String(r[map.type] ?? "").trim() : "", location: map.location ? String(r[map.location] ?? "").trim() : "", notes: map.notes ? String(r[map.notes] ?? "").trim() : "", problem };
    });
  }, [rows, map, unit, existingKeys, provider]);
  const good = parsed.filter(p => !p.problem);

  const doImport = async () => {
    setSaving(true);
    try {
      const { data: log, error: le } = await supabase.from("colas_import_log").insert({ source: provider, file_name: fileName, rows_imported: good.length, rows_failed: parsed.filter(p => p.problem && !/Already|Duplicate/.test(p.problem)).length, rows_flagged: parsed.filter(p => /Already|Duplicate/.test(p.problem)).length, details: { skipped: parsed.filter(p => p.problem).slice(0, 200) } }).select("id").single();
      if (le) throw le;
      const stream = MANUAL_DEFAULT_STREAM[provider];
      for (let i = 0; i < good.length; i += 200) {
        const { error } = await supabase.from("colas_manual_entries").insert(good.slice(i, i + 200).map(g => ({
          provider, collection_date: g.date!, waste_stream: stream, hazardous: streamIsHazardous(stream), waste_type: g.type || null, weight_kg: g.kg,
          collection_reference: g.ref || null, location: g.location || DEFAULT_LOCATION, notes: g.notes || null, status: "confirmed", import_id: log.id, document_name: fileName,
        })));
        if (error) throw error;
      }
      toast.success(`${good.length} collection${good.length === 1 ? "" : "s"} imported`);
      onDone();
    } catch (e: any) { toast.error(e.message ?? String(e)); } finally { setSaving(false); }
  };

  const colSelect = (k: keyof typeof map, label: string) => (
    <div className="space-y-1"><Label>{label}</Label>
      <Select value={map[k] || "__none"} onValueChange={(v) => setMap(m => ({ ...m, [k]: v === "__none" ? "" : v }))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="__none">— not in file —</SelectItem>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
      </Select></div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Upload {PROVIDER_LABELS[provider]} weights</DialogTitle><DialogDescription>Excel or CSV. Rows already entered are skipped, so uploading the same file twice adds nothing new.</DialogDescription></DialogHeader>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <Button variant="outline" onClick={() => inputRef.current?.click()}><Upload className="mr-1 h-4 w-4" />{fileName || "Choose file"}</Button>
        {headers.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {colSelect("date", "Collection date")}{colSelect("weight", "Weight")}
              <div className="space-y-1"><Label>Weight unit</Label><Select value={unit} onValueChange={(v) => setUnit(v as "kg" | "t")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kg">Kilograms</SelectItem><SelectItem value="t">Tonnes</SelectItem></SelectContent></Select></div>
              {colSelect("ref", "Collection reference")}{colSelect("type", "Waste type")}{colSelect("location", "Location")}
            </div>
            <div className="max-h-72 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">kg</TableHead><TableHead>Reference</TableHead><TableHead>Waste</TableHead><TableHead>Check</TableHead></TableRow></TableHeader>
                <TableBody>{parsed.slice(0, 300).map((p, i) => (
                  <TableRow key={i}><TableCell>{p.date ? ukDate(p.date) : "—"}</TableCell><TableCell className="text-right tabular-nums">{p.kg ?? "—"}</TableCell><TableCell>{p.ref || "—"}</TableCell><TableCell>{p.type || "—"}</TableCell>
                    <TableCell>{p.problem ? <Chip tone={/Already|Duplicate/.test(p.problem) ? "neutral" : "bad"}>{p.problem}</Chip> : <Chip tone="good">Ready</Chip>}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <p className="text-sm text-muted-foreground">{good.length} ready · {parsed.length - good.length} skipped</p>
          </>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!good.length || saving} onClick={doImport}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Import {good.length || ""}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FIELD_LABELS: Record<string, string> = { collection_date: "Date", waste_stream: "Stream", waste_type: "Waste type", weight_kg: "Weight (kg)", consignment_ref: "Consignment ref", collection_reference: "Collection ref", location: "Location", notes: "Notes", status: "Status", document_name: "Document", void_reason: "Void reason" };

export function HistoryDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [rows, setRows] = useState<Entry[] | null>(null);
  useEffect(() => {
    supabase.from("colas_audit_log").select("*").eq("record_id", entry.id).order("changed_at").then(({ data }) => setRows(data ?? []));
  }, [entry.id]);
  const names = useProfileNames((rows ?? []).map(r => r.changed_by));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Change history</DialogTitle></DialogHeader>
        {!rows ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <ul className="max-h-96 space-y-3 overflow-auto">
            {rows.map(r => {
              const changes = r.action === "insert" ? [] : Object.keys(FIELD_LABELS).filter(k => JSON.stringify(r.old_row?.[k]) !== JSON.stringify(r.new_row?.[k]));
              return (
                <li key={r.id} className="rounded border p-3 text-sm">
                  <div className="font-medium">{r.action === "insert" ? "Added" : r.action === "void" ? "Voided" : "Changed"} · {ukDateTime(r.changed_at)} · {names.get(r.changed_by) ?? "System"}</div>
                  {changes.map(k => <div key={k} className="text-muted-foreground">{FIELD_LABELS[k]}: {String(r.old_row?.[k] ?? "—")} → <span className="text-foreground">{String(r.new_row?.[k] ?? "—")}</span></div>)}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
