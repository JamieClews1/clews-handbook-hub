import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import { plSheetLabel, type PlSheetName, type PlSheets } from "@/lib/company-pl";
import { comparePlStream, plStreams, workbookYears, type PlStreamKind } from "@/lib/company-pl-yoy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const colours = ["hsl(var(--muted-foreground))", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--primary))"];
const money = (value: number | null) => value === null ? "—" : value.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

export default function CompanyPlYearOnYear({ source }: { source: PlSheetName }) {
  const [kind, setKind] = useState<PlStreamKind>("revenue");
  const [selectedStream, setSelectedStream] = useState("waste income");
  const [selectedYears, setSelectedYears] = useState<number[] | null>(null);
  const [start, setStart] = useState(1);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null);
  const query = useQuery({ queryKey: ["company-pl-yoy-workbooks"], queryFn: async () => {
    const { data, error } = await withTimeout(supabase.from("company_pl_workbooks").select("imported_at,sheets"), 20000, "Year-on-year worksheets");
    if (error) throw error;
    return (data ?? []) as unknown as { imported_at: string; sheets: PlSheets }[];
  } });
  const years = useMemo(() => workbookYears(query.data ?? [], source), [query.data, source]);
  const streams = useMemo(() => plStreams(years), [years]);
  const options = streams.filter(stream => stream.kind === kind);
  const stream = options.find(option => option.key === selectedStream) ?? options[0];
  const activeYears = years.filter(year => selectedYears === null || selectedYears.includes(year.year));
  const matchedEnd = activeYears.length ? Math.min(...activeYears.map(year => year.reportedMonths)) : 12;
  const end = Math.max(start, selectedEnd ?? Math.max(1, matchedEnd));
  const comparison = comparePlStream(activeYears, stream?.key ?? "", start, end);
  const period = `${months[start - 1]}${end === start ? "" : `–${months[end - 1]}`}`;

  if (query.isPending) return <p className="text-muted-foreground">Loading year-on-year tracker…</p>;
  if (query.isError) return <div role="alert" className="space-y-2"><p>Year-on-year worksheets could not load.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;
  if (!years.length) return <p className="text-muted-foreground">No {plSheetLabel(source)} worksheets available.</p>;

  return <section className="space-y-6">
    <header className="space-y-1"><h2 className="text-xl font-semibold">Year-on-Year tracker — {plSheetLabel(source)}</h2><p className="text-sm text-muted-foreground">Uploaded P&amp;L actuals · {period} in each selected year · no forecasts or portal job values.</p></header>
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2"><Label>Stream type</Label><Tabs value={kind} onValueChange={value => setKind(value as PlStreamKind)}><TabsList><TabsTrigger value="revenue">Revenue</TabsTrigger><TabsTrigger value="cost">Costs</TabsTrigger><TabsTrigger value="summary">P&amp;L totals</TabsTrigger></TabsList></Tabs></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="yoy-stream">Revenue / cost stream</Label><Select value={stream?.key ?? ""} onValueChange={setSelectedStream}><SelectTrigger id="yoy-stream" className="w-64 max-w-full" aria-label="Revenue or cost stream"><SelectValue placeholder="Select stream" /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="yoy-start">From month</Label><Select value={String(start)} onValueChange={value => { const month = Number(value); setStart(month); if (month > end) setSelectedEnd(month); }}><SelectTrigger id="yoy-start" className="w-28" aria-label="From month"><SelectValue /></SelectTrigger><SelectContent>{months.map((month, i) => <SelectItem key={month} value={String(i + 1)}>{month}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="yoy-end">To month</Label><Select value={String(end)} onValueChange={value => { const month = Number(value); setSelectedEnd(month); if (month < start) setStart(month); }}><SelectTrigger id="yoy-end" className="w-28" aria-label="To month"><SelectValue /></SelectTrigger><SelectContent>{months.map((month, i) => <SelectItem key={month} value={String(i + 1)}>{month}</SelectItem>)}</SelectContent></Select></div>
      <Button variant="outline" onClick={() => { setStart(1); setSelectedEnd(null); }}>Matched YTD</Button>
      <Button variant="outline" onClick={() => { setSelectedYears(years.filter(year => year.reportedMonths === 12).map(year => year.year)); setStart(1); setSelectedEnd(12); }}>Complete years</Button>
    </div>
    <fieldset className="flex flex-wrap gap-x-6 gap-y-3"><legend className="mb-2 text-sm font-medium">Years</legend>{years.map(year => <Label key={year.year} className="flex items-center gap-2"><Checkbox aria-label={`Include ${year.year}`} checked={activeYears.some(active => active.year === year.year)} onCheckedChange={checked => setSelectedYears(checked ? [...activeYears.map(active => active.year), year.year] : activeYears.filter(active => active.year !== year.year).map(active => active.year))} />{year.year}<span className="text-xs text-muted-foreground">to {months[year.reportedMonths - 1] ?? "no reported months"}</span></Label>)}</fieldset>
    {!stream ? <p className="text-muted-foreground">No streams of this type in the selected worksheets.</p> : !activeYears.length ? <p className="text-muted-foreground">No years selected.</p> : <>
      {comparison.totals.some(row => row.total === null) && <p role="status" className="text-sm text-muted-foreground">Some selected months are unreported, blank or contain spreadsheet errors. Those values and incomplete period totals show —, not zero.</p>}
      <div className="grid min-w-0 gap-8 xl:grid-cols-2">
        <section className="min-w-0 space-y-3"><h3 className="text-base font-semibold">{stream.label} — {period} total</h3><div className="h-80 w-full" role="img" aria-label={`${stream.label} period totals by year`}><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison.totals.map(row => ({ year: String(row.year), [stream.label]: row.total }))} margin={{ top: 12, right: 12, bottom: 8, left: 12 }}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" /><YAxis tickFormatter={value => `£${Math.round(value / 1000)}k`} stroke="hsl(var(--muted-foreground))" /><Tooltip formatter={(value: number) => money(value)} contentStyle={{ background: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--popover-foreground))" }} /><Bar dataKey={stream.label} fill="hsl(var(--primary))" maxBarSize={72} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></section>
        <section className="min-w-0 space-y-3"><h3 className="text-base font-semibold">{stream.label} — monthly comparison</h3><div className="h-80 w-full" role="img" aria-label={`${stream.label} monthly comparison by year`}><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison.monthly} margin={{ top: 12, right: 12, bottom: 8, left: 12 }}><CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" /><YAxis tickFormatter={value => `£${Math.round(value / 1000)}k`} stroke="hsl(var(--muted-foreground))" /><Tooltip formatter={(value: number) => money(value)} contentStyle={{ background: "hsl(var(--popover))", borderColor: "hsl(var(--border))", color: "hsl(var(--popover-foreground))" }} /><Legend />{activeYears.map(year => <Bar key={year.year} dataKey={String(year.year)} fill={colours[years.findIndex(item => item.year === year.year) % colours.length]} maxBarSize={32} isAnimationActive={false} />)}</BarChart></ResponsiveContainer></div></section>
      </div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>{stream.label} · {period}</TableHead><TableHead className="text-right">Actual total</TableHead><TableHead className="text-right">Change vs previous year</TableHead><TableHead className="text-right">% change</TableHead></TableRow></TableHeader><TableBody>{comparison.totals.map(row => <TableRow key={row.year}><TableCell className="font-medium">{row.year}</TableCell><TableCell className="text-right tabular-nums">{money(row.total)}</TableCell><TableCell className="text-right tabular-nums">{row.delta !== null && row.delta > 0 ? "+" : ""}{money(row.delta)}</TableCell><TableCell className="text-right tabular-nums">{row.percent === null ? "—" : `${row.percent > 0 ? "+" : ""}${(row.percent * 100).toFixed(1)}%`}</TableCell></TableRow>)}</TableBody></Table></div>
    </>}
  </section>;
}