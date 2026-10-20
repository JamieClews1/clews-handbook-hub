import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import { parsePlSheet, type PlYear } from "@/lib/company-pl-analysis";
import { plSheetLabel, type PlSheetName, type PlSheets } from "@/lib/company-pl";
import type { TradingEvidence } from "@/lib/company-pl-trading";
import { completeSalesTotal, salesMonths } from "@/lib/company-pl-sales";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
const money = (v: number | null) => v === null ? "—" : v.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

export default function CompanyPlSales({ source, trading, tradingError, retry }: { source: PlSheetName; trading: TradingEvidence | null; tradingError: boolean; retry: () => void }) {
  const [selected, setSelected] = useState<string>("");
  const query = useQuery({ queryKey: ["company-pl-sales-workbooks"], queryFn: async () => {
    const { data, error } = await withTimeout(supabase.from("company_pl_workbooks").select("imported_at,sheets").order("imported_at"), 20000, "Sales worksheets");
    if (error) throw error;
    return (data ?? []) as unknown as { imported_at: string; sheets: PlSheets }[];
  } });
  const years = useMemo(() => {
    const map = new Map<number, PlYear>();
    for (const record of query.data ?? []) { const rows = record.sheets[source]; const parsed = rows ? parsePlSheet(rows) : null; if (parsed) map.set(parsed.year, parsed); }
    return [...map.values()].sort((a, b) => b.year - a.year);
  }, [query.data, source]);
  useEffect(() => { setSelected(""); }, [source]);
  const year = years.find(y => String(y.year) === selected) ?? years[0];
  if (query.isError) return <section><p role="alert">Sales worksheets could not load.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></section>;
  if (query.isPending) return <p className="text-muted-foreground">Loading sales…</p>;
  if (!year) return <p>No {plSheetLabel(source)} sales worksheet available.</p>;
  const allocated = source === "Full set";
  const rows = salesMonths(year, trading, allocated);
  const reported = rows.slice(0, year.reportedMonths);
  const total = (key: "portal" | "other" | "accounting" | "combined") => completeSalesTotal(reported.map(r => r[key]));
  const columns = ["skip", "mid", "portal", "waste", "other", "combined", "accounting", "gap"] as const;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Sales — {plSheetLabel(source)}</h2><Select value={String(year.year)} onValueChange={setSelected}><SelectTrigger className="w-32" aria-label="Sales year"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y.year} value={String(y.year)}>{y.year}</SelectItem>)}</SelectContent></Select></div>
    <p className="text-sm text-muted-foreground">Portal waste values through {trading?.cutoff ?? "pending upload evidence"}; P&amp;L actuals through {year.monthLabels[year.reportedMonths - 1]}. Completed Skiptrak jobs and unlinked Midweigh direct intake only; voids excluded. Recorded job value is not invoiced revenue or cash.</p>
    {!allocated && <p role="alert" className="text-sm text-muted-foreground">Portal waste values cover the whole company, not {plSheetLabel(source)}. The combined view is available only for Full set; no division allocation is assumed.</p>}
    {tradingError && <div role="alert"><p>Portal sales could not load; accounting figures remain available.</p><Button variant="outline" onClick={retry}>Try again</Button></div>}
    {!trading && !tradingError && <p className="text-muted-foreground">Loading portal sales…</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([["Portal waste value", total("portal")], ["Other P&L revenue", total("other")], ["Combined sales view", total("combined")], ["Accounting sales", total("accounting")]] as const).map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label} · Jan–{year.monthLabels[year.reportedMonths - 1]?.slice(0, 3)}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(value)}</p></CardContent></Card>)}</div>
    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Month</TableHead>{["Skiptrak value", "Midweigh value", "Portal waste total", "P&L Waste Income", "Other P&L revenue", "Combined view", "P&L Sales", "Portal − P&L waste"].map(label => <TableHead key={label} className="text-right">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.label}><TableCell className="whitespace-nowrap font-medium">{row.label}{row.partialLabel ? ` (${row.partialLabel})` : ""}</TableCell>{columns.map(key => <TableCell key={key} className="text-right tabular-nums whitespace-nowrap">{money(row[key])}</TableCell>)}</TableRow>)}<TableRow className="font-semibold"><TableCell>Accounting YTD total</TableCell>{columns.map(key => <TableCell key={key} className="text-right whitespace-nowrap tabular-nums">{money(completeSalesTotal(reported.map(r => r[key])))}</TableCell>)}</TableRow></TableBody></Table></div>
    <h3 className="text-lg font-semibold">Other sales revenue — uploaded actuals</h3>
    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Recyclables</TableHead><TableHead className="text-right">RFS Till Sales</TableHead><TableHead className="text-right">Other Sales</TableHead><TableHead className="text-right">Total other revenue</TableHead></TableRow></TableHeader><TableBody>{reported.map(row => <TableRow key={row.label}><TableCell>{row.label}</TableCell>{row.categories.map(c => <TableCell key={c.key} className="text-right tabular-nums">{money(c.value)}</TableCell>)}<TableCell className="text-right tabular-nums">{money(row.other)}</TableCell></TableRow>)}</TableBody></Table></div>
    <p className="text-sm text-muted-foreground">Combined view replaces P&amp;L Waste Income with portal waste value, then adds Recyclables, RFS Till Sales and Other Sales — it does not add waste income twice or change the uploaded accounts. Months labelled with their latest recorded date (for example “October (to 20 Oct)”) only cover the days uploaded so far — missing portal source records and unreported accounting months show — rather than a guessed total. Blank other-revenue cells are treated as no recorded revenue.</p>
    {rows.some(r => r.portal === null) && <p role="alert" className="text-sm text-destructive">Some months have no eligible evidence for both portal sources. Their waste totals and the complete-period combined total remain unavailable.</p>}
    {rows.some(r => r.unpriced > 0) && <p className="text-sm text-muted-foreground">{rows.reduce((sum, r) => sum + r.unpriced, 0)} eligible portal records have zero or missing prices. Upload timing, missing prices, revenue recognition and customer naming can explain differences from P&amp;L Waste Income.</p>}
    {reported.some(r => r.reconciliation !== null && Math.abs(r.reconciliation) > 5) && <p role="alert" className="text-sm text-destructive">Uploaded revenue categories do not fully reconcile to the Sales summary in some months; confirm the worksheet breakdown with finance.</p>}
  </section>;
}