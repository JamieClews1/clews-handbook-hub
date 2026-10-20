import { useCallback, useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, LockKeyhole, RefreshCw, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { PL_SHEET_NAMES, plSheetLabel, readPlWorkbook, type PlSheets } from "@/lib/company-pl";
import { withTimeout } from "@/lib/with-timeout";
import { useToast } from "@/hooks/use-toast";

type ImportRecord = { id: string; file_name: string; imported_at: string };
type Preview = { fileName: string; sheets: PlSheets; ignored: string[] };

export default function CompanyProfitLossTab() {
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [selected, setSelected] = useState("");
  const [sheets, setSheets] = useState<PlSheets>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await withTimeout(supabase.from("company_pl_workbooks").select("id, file_name, imported_at").order("imported_at", { ascending: false }), 12000, "P&L history");
      if (result.error) throw result.error;
      setImports(result.data ?? []);
      setSelected(result.data?.[0]?.id ?? "");
    } catch { setError("P&L could not load. Please try again."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let cancelled = false;
    setSheets({});
    if (!selected) return;
    setLoading(true);
    withTimeout(supabase.from("company_pl_workbooks").select("sheets").eq("id", selected).single(), 12000, "P&L data")
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) setError("This P&L import could not load. Please try again.");
        else { setSheets(data.sheets as PlSheets); setError(""); }
      })
      .catch(() => { if (!cancelled) setError("This P&L import could not load. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setPreview(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Please use a workbook smaller than 20 MB.");
      const result = readPlWorkbook(await file.arrayBuffer());
      setPreview({ fileName: file.name, ...result });
    } catch (err) {
      toast({ title: "Workbook not imported", description: err instanceof Error ? err.message : "Please check the Excel file.", variant: "destructive" });
    } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  const save = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const { error: saveError } = await withTimeout(supabase.from("company_pl_workbooks").insert({ file_name: preview.fileName, sheets: preview.sheets }), 20000, "P&L import");
      if (saveError) throw saveError;
      setPreview(null);
      await load();
      toast({ title: "P&L imported" });
    } catch { toast({ title: "Import could not be confirmed", description: "Refresh the import list before trying again.", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const displayed = preview?.sheets ?? sheets;
  const names = PL_SHEET_NAMES.filter((name) => displayed[name]);
  const sourceErrorCount = Object.values(displayed).reduce((total, rows) => total + (rows?.flat().filter((cell) => /^#(DIV\/0!|REF!|VALUE!|N\/A|NAME\?|NUM!|NULL!|ERROR!)/.test(cell)).length ?? 0), 0);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><LockKeyhole className="h-4 w-4 text-primary" /> Company P&amp;L</h2>
          <p className="text-sm text-muted-foreground">Private · Jamie only</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {imports.length > 0 && <Select value={selected} onValueChange={(value) => { setPreview(null); setSelected(value); }} disabled={busy}>
            <SelectTrigger className="w-72 max-w-full" aria-label="P&L import"><SelectValue /></SelectTrigger>
            <SelectContent>{imports.map((record) => <SelectItem key={record.id} value={record.id}>{record.file_name} · {new Date(record.imported_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}</SelectItem>)}</SelectContent>
          </Select>}
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={busy || loading} aria-label="Refresh P&L" title="Refresh P&L"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => input.current?.click()} disabled={busy}><Upload className="mr-2 h-4 w-4" />Import workbook</Button>
          <input ref={input} type="file" accept=".xlsx,.xls,.xlsm" className="hidden" aria-label="P&L workbook" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </div>
      </div>
      {preview && <div className="space-y-3 border-y border-border bg-muted/40 p-4">
        <p className="font-medium break-words">Pending import: {preview.fileName}</p>
        <p className="text-sm">{names.map(plSheetLabel).join(" · ")}</p>
        {preview.ignored.length > 0 && <p className="text-sm text-muted-foreground">{preview.ignored.length} other {preview.ignored.length === 1 ? "tab" : "tabs"} excluded.</p>}
        {PL_SHEET_NAMES.some((name) => !preview.sheets[name]) && <p className="text-sm text-destructive">Missing or empty: {PL_SHEET_NAMES.filter((name) => !preview.sheets[name]).map(plSheetLabel).join(", ")}</p>}
        <div className="flex gap-2"><Button onClick={() => void save()} disabled={busy}><Upload className="mr-2 h-4 w-4" />Save import</Button><Button variant="outline" onClick={() => setPreview(null)} disabled={busy}><X className="mr-2 h-4 w-4" />Cancel</Button></div>
      </div>}
      {error && <div role="alert" className="flex items-center gap-3 text-destructive">{error}<Button variant="outline" onClick={() => void load()}>Try again</Button></div>}
      {sourceErrorCount > 0 && <p role="alert" className="border-l-2 border-destructive pl-3 text-sm text-destructive">Source workbook contains {sourceErrorCount} calculation errors. These are shown as supplied, not treated as zero.</p>}
      {(loading || busy) && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{busy ? "Reading workbook…" : "Loading P&L…"}</p>}
      {!loading && !busy && !error && names.length === 0 && <div className="py-12 text-center"><FileSpreadsheet className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">No company P&amp;L imported yet</p></div>}
      {names.length > 0 && <Tabs key={preview?.fileName ?? selected} defaultValue={names[0]}>
        <TabsList className="h-auto flex-wrap">{names.map((name) => <TabsTrigger key={name} value={name}>{plSheetLabel(name)}</TabsTrigger>)}</TabsList>
        {names.map((name) => {
          const rows = displayed[name] ?? [];
          const columns = Math.max(0, ...rows.map((row) => row.length));
          return <TabsContent key={name} value={name} className="mt-4">
            <Table><TableBody>{rows.map((row, rowIndex) => <TableRow key={rowIndex}>
              {Array.from({ length: columns }, (_, column) => <TableCell key={column} className={column === 0 ? "sticky left-0 z-10 min-w-52 bg-background font-medium" : "min-w-28 whitespace-nowrap text-right tabular-nums"}>{row[column] ?? ""}</TableCell>)}
            </TableRow>)}</TableBody></Table>
          </TabsContent>;
        })}
      </Tabs>}
    </section>
  );
}