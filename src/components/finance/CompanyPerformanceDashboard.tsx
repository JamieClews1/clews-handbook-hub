import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withTimeout } from "@/lib/with-timeout";
import { plSheetLabel, type PlSheetName, type PlSheets } from "@/lib/company-pl";
import { costWatch, monthlyNet, parsePlSheet, periodTotals, profitBridge, type PlProjectionMethod, type PlYear } from "@/lib/company-pl-analysis";
import CompanyPlProjections from "./CompanyPlProjections";

type View = "overview" | "trends" | "drivers" | "divisions" | "costs" | "projections";
const gbp = (n: number) => `${n < 0 ? "−" : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const change = (a: number, b: number) => (a ? `${b >= a ? "+" : "−"}${Math.abs(((b - a) / Math.abs(a)) * 100).toFixed(1)}%` : "—");

function latestPerYear(records: { imported_at: string; sheets: PlSheets }[], sheet: keyof PlSheets) {
  const byYear = new Map<number, PlYear>();
  for (const r of [...records].sort((a, b) => a.imported_at.localeCompare(b.imported_at))) {
    const rows = r.sheets[sheet];
    const parsed = rows ? parsePlSheet(rows) : null;
    if (parsed) byYear.set(parsed.year, parsed);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p><p className={`text-xs ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : "text-muted-foreground"}`}>{sub}</p></CardContent></Card>;
}

export default function CompanyPerformanceDashboard({ source = "Full set", method, onMethodChange }: { source?: PlSheetName; method: PlProjectionMethod; onMethodChange: (method: PlProjectionMethod) => void }) {
  const [records, setRecords] = useState<{ imported_at: string; sheets: PlSheets }[] | null>(null);
  const [error, setError] = useState(false);
  const [view, setView] = useState<View>("overview");
  useEffect(() => {
    withTimeout(supabase.from("company_pl_workbooks").select("imported_at, sheets"), 20000, "P&L analysis")
      .then(({ data, error: e }) => { if (e) setError(true); else setRecords((data ?? []) as never); })
      .catch(() => setError(true));
  }, []);

  const a = useMemo(() => {
    if (!records) return null;
    const full = latestPerYear(records, source);
    if (full.length < 2) return null;
    const cur = full[full.length - 1];
    const prev = full[full.length - 2];
    const months = cur.reportedMonths;
    const totals = full.map((y) => periodTotals(y, months));
    const t1 = totals[totals.length - 1], t0 = totals[totals.length - 2];
    const clews = latestPerYear(records, "Clews EBITDA"), rfs = latestPerYear(records, "RFS EBITDA");
    const div = (list: PlYear[]) => { const c = list.find((y) => y.year === cur.year), p = list.find((y) => y.year === prev.year); return c && p ? { cur: periodTotals(c, months), prev: periodTotals(p, months), costs: costWatch(p, c, months) } : null; };
    const clewsDiv = div(clews), rfsDiv = div(rfs);
    const otherSales = cur.lines.get("other sales")?.slice(0, months).reduce<number>((s, v) => s + (v ?? 0), 0) ?? 0;
    return {
      cur, prev, months, totals, t0, t1, bridge: profitBridge(t0, t1), costs: costWatch(prev, cur, months),
      period: `${cur.monthLabels[0].slice(0, 3)}–${cur.monthLabels[months - 1]?.slice(0, 3)}`,
      fullYears: full.filter((y) => y.reportedMonths === 12).map((y) => periodTotals(y, 12)),
      monthly: monthlyNet(cur).map((m, i) => ({ month: m.label.slice(0, 3), [cur.year]: m.value, [prev.year]: monthlyNet(prev)[i]?.value ?? 0 })),
      clewsDiv, rfsDiv, otherSales,
      splitGap: clewsDiv && rfsDiv ? t1.netProfit - clewsDiv.cur.netProfit - rfsDiv.cur.netProfit : null,
      marginPoint: t1.sales * 0.01,
    };
  }, [records, source]);

  if (error) return <p role="alert" className="text-destructive">Performance analysis could not load. Refresh to try again.</p>;
  if (!records) return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analysing P&amp;L…</p>;
  if (!a) return <p className="text-muted-foreground">At least two years of “{plSheetLabel(source)}” worksheets are needed for performance analysis. Import more years, or choose a different worksheet in Settings.</p>;

  const views: [View, string][] = [["overview", "CEO Overview"], ["trends", "Long-term Trends"], ["drivers", "Profit Drivers"], ["divisions", "Clews vs RFS"], ["costs", "Cost Watch"], ["projections", "Projections"]];
  const risingCosts = [...a.costs].filter((c) => c.change > 0 && c.shareAfter > c.shareBefore).sort((x, y) => y.change - x.change);
  const income = a.costs.filter((c) => /sales|income|recyclables/i.test(c.label));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{views.map(([key, label]) => <Button key={key} size="sm" variant={view === key ? "default" : "outline"} onClick={() => setView(key)}>{label}</Button>)}</div>
      <p className="text-sm text-muted-foreground">Compared on matched months: <strong className="text-foreground">{a.period} {a.cur.year}</strong> vs the same months in earlier years. Later {a.cur.year} months are treated as not yet reported, not as zero. “Net profit” is as reported and still includes depreciation and bank charges/interest — it is not EBITDA.</p>

      {view === "projections" && <CompanyPlProjections cur={a.cur} prev={a.prev} source={source} method={method} onMethodChange={onMethodChange} />}

      {view === "overview" && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label={`Sales ${a.period}`} value={gbp(a.t1.sales)} sub={`${change(a.t0.sales, a.t1.sales)} vs ${a.prev.year}`} tone={a.t1.sales >= a.t0.sales ? "good" : "bad"} />
          <Kpi label="Gross margin" value={pct(a.t1.grossMargin)} sub={`${pct(a.t0.grossMargin)} in ${a.prev.year}`} tone={a.t1.grossMargin >= a.t0.grossMargin ? "good" : "bad"} />
          <Kpi label="Overheads" value={gbp(a.t1.overheads)} sub={`${change(a.t0.overheads, a.t1.overheads)} vs ${a.prev.year}`} tone={a.t1.overheads > a.t0.overheads ? "bad" : "good"} />
          <Kpi label="Net profit (reported)" value={gbp(a.t1.netProfit)} sub={`${gbp(a.t1.netProfit - a.t0.netProfit)} vs ${a.prev.year} · ${pct(a.t1.netMargin)} margin`} tone={a.t1.netProfit >= a.t0.netProfit ? "good" : "bad"} />
        </div>
        <Card><CardHeader><CardTitle className="text-base">Needs attention</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 pl-5 text-sm">
          {(() => { const q1 = monthlyNet(a.cur).slice(0, 3).reduce((s, m) => s + m.value, 0); return a.t1.netProfit > 0 && q1 / a.t1.netProfit > 0.6 ? <li>{Math.round((q1 / a.t1.netProfit) * 100)}% of year-to-date profit ({gbp(q1)}) came in Jan–Mar. Find out what made those months stronger.</li> : null; })()}
          {a.rfsDiv && a.rfsDiv.cur.grossMargin < a.rfsDiv.prev.grossMargin && <li>RFS gross margin fell from {pct(a.rfsDiv.prev.grossMargin)} to {pct(a.rfsDiv.cur.grossMargin)}; reported result {gbp(a.rfsDiv.prev.netProfit)} → {gbp(a.rfsDiv.cur.netProfit)}.</li>}
          {risingCosts.slice(0, 3).map((c) => <li key={c.label}>{c.label} up {gbp(c.change)} ({c.pct !== null ? change(c.before, c.after) : "new"}), now {pct(c.shareAfter)} of sales vs {pct(c.shareBefore)}.</li>)}
          {a.otherSales !== 0 && <li>{gbp(a.otherSales)} of Other Sales is in the period ({a.t1.netProfit ? Math.round((a.otherSales / a.t1.netProfit) * 100) : 0}% of net profit). Confirm whether it will happen again.</li>}
          <li>One percentage point of gross margin is worth about {gbp(a.marginPoint)} at current sales.</li>
        </ul></CardContent></Card>
      </>}

      {view === "trends" && <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Sales, gross profit &amp; net profit — {a.period}</CardTitle></CardHeader><CardContent className="h-72">
          <ResponsiveContainer><BarChart data={a.totals.map((t) => ({ year: String(t.year), Sales: t.sales, "Gross profit": t.grossProfit, "Net profit": t.netProfit }))}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="year" /><YAxis tickFormatter={(v) => `£${Math.round(v / 1000)}k`} /><Tooltip formatter={(v: number) => gbp(v)} /><Legend />
            <Bar dataKey="Sales" fill="hsl(var(--primary))" /><Bar dataKey="Gross profit" fill="hsl(var(--primary) / 0.6)" /><Bar dataKey="Net profit" fill="hsl(var(--foreground))" />
          </BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Monthly net profit — {a.cur.year} vs {a.prev.year}</CardTitle></CardHeader><CardContent className="h-72">
          <ResponsiveContainer><LineChart data={a.monthly}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `£${Math.round(v / 1000)}k`} /><Tooltip formatter={(v: number) => gbp(v)} /><Legend />
            <Line dataKey={String(a.cur.year)} stroke="hsl(var(--primary))" strokeWidth={2} /><Line dataKey={String(a.prev.year)} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
          </LineChart></ResponsiveContainer></CardContent></Card>
        <Card className="xl:col-span-2"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>{a.period}</TableHead>{a.totals.map((t) => <TableHead key={t.year} className="text-right">{t.year}</TableHead>)}</TableRow></TableHeader><TableBody>
          {([["Sales", "sales"], ["Gross profit", "grossProfit"], ["Overheads", "overheads"], ["Net profit", "netProfit"]] as const).map(([label, k]) => <TableRow key={k}><TableCell className="font-medium">{label}</TableCell>{a.totals.map((t) => <TableCell key={t.year} className="text-right tabular-nums">{gbp(t[k])}</TableCell>)}</TableRow>)}
          <TableRow><TableCell className="font-medium">Gross margin</TableCell>{a.totals.map((t) => <TableCell key={t.year} className="text-right tabular-nums">{pct(t.grossMargin)}</TableCell>)}</TableRow>
          <TableRow><TableCell className="font-medium">Net margin</TableCell>{a.totals.map((t) => <TableCell key={t.year} className="text-right tabular-nums">{pct(t.netMargin)}</TableCell>)}</TableRow>
        </TableBody></Table></CardContent></Card>
        {a.fullYears.length > 0 && <p className="text-sm text-muted-foreground xl:col-span-2">Full years: {a.fullYears.map((t) => `${t.year} sales ${gbp(t.sales)}, profit ${gbp(t.netProfit)}`).join(" · ")}.</p>}
      </div>}

      {view === "drivers" && <Card><CardHeader><CardTitle className="text-base">Why net profit changed by {gbp(a.bridge.change)} ({a.prev.year} → {a.cur.year}, {a.period})</CardTitle></CardHeader><CardContent className="space-y-3">
        {([["Higher/lower sales at last year's margin", a.bridge.sales], ["Change in gross margin", a.bridge.margin], ["Change in overheads", a.bridge.overheads], ["Other / rounding", a.bridge.other]] as const).map(([label, v]) => (
          <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm"><div><p>{label}</p><div className="mt-1 h-2 rounded bg-muted"><div className={`h-2 rounded ${v >= 0 ? "bg-primary" : "bg-destructive"}`} style={{ width: `${Math.min(100, (Math.abs(v) / Math.max(1, Math.abs(a.bridge.sales), Math.abs(a.bridge.margin), Math.abs(a.bridge.overheads))) * 100)}%` }} /></div></div><span className="font-semibold tabular-nums">{gbp(v)}</span></div>
        ))}
        <p className="text-sm text-muted-foreground">An approximation from the selected worksheet. One percentage point of gross margin ≈ {gbp(a.marginPoint)}.</p>
      </CardContent></Card>}

      {view === "divisions" && (a.clewsDiv && a.rfsDiv ? <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>{a.period}</TableHead><TableHead className="text-right">Clews {a.prev.year}</TableHead><TableHead className="text-right">Clews {a.cur.year}</TableHead><TableHead className="text-right">RFS {a.prev.year}</TableHead><TableHead className="text-right">RFS {a.cur.year}</TableHead></TableRow></TableHeader><TableBody>
        {([["Sales", "sales", gbp], ["Gross profit", "grossProfit", gbp], ["Gross margin", "grossMargin", pct], ["Overheads", "overheads", gbp], ["Net profit (reported)", "netProfit", gbp]] as const).map(([label, k, f]) => <TableRow key={k}><TableCell className="font-medium">{label}</TableCell>{[a.clewsDiv!.prev, a.clewsDiv!.cur, a.rfsDiv!.prev, a.rfsDiv!.cur].map((t, i) => <TableCell key={i} className="text-right tabular-nums">{f(t[k])}</TableCell>)}</TableRow>)}
      </TableBody></Table>
        <p className="p-4 text-sm text-muted-foreground">Divisions use the workbook's allocated costs. Clews + RFS differs from Full set by {gbp(a.splitGap ?? 0)} — confirm allocations with finance before treating this as a reconciled split.</p>
        {a.rfsDiv.costs.filter((c) => c.change !== 0).sort((x, y) => y.change - x.change).slice(0, 5).length > 0 && <div className="border-t border-border p-4 text-sm"><p className="mb-2 font-medium">Biggest RFS line changes</p><ul className="list-disc space-y-1 pl-5">{a.rfsDiv.costs.filter((c) => c.change !== 0).sort((x, y) => Math.abs(y.change) - Math.abs(x.change)).slice(0, 5).map((c) => <li key={c.label}>{c.label}: {gbp(c.before)} → {gbp(c.after)} ({pct(c.shareAfter)} of RFS sales vs {pct(c.shareBefore)})</li>)}</ul></div>}
      </CardContent></Card> : <p className="text-muted-foreground">{plSheetLabel("Clews EBITDA")} and {plSheetLabel("RFS EBITDA")} tabs are needed for both {a.prev.year} and {a.cur.year}.</p>)}

      {view === "costs" && <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Line ({a.period})</TableHead><TableHead className="text-right">{a.prev.year}</TableHead><TableHead className="text-right">{a.cur.year}</TableHead><TableHead className="text-right">Change</TableHead><TableHead className="text-right">% of sales</TableHead></TableRow></TableHeader><TableBody>
        {[...a.costs].filter((c) => !income.includes(c)).sort((x, y) => y.change - x.change).map((c) => <TableRow key={c.label}><TableCell className="font-medium">{c.label}</TableCell><TableCell className="text-right tabular-nums">{gbp(c.before)}</TableCell><TableCell className="text-right tabular-nums">{gbp(c.after)}</TableCell><TableCell className={`text-right tabular-nums ${c.change > 0 && c.shareAfter > c.shareBefore ? "text-destructive" : ""}`}>{gbp(c.change)}{c.pct !== null ? ` (${change(c.before, c.after)})` : ""}</TableCell><TableCell className="text-right tabular-nums">{pct(c.shareBefore)} → {pct(c.shareAfter)}</TableCell></TableRow>)}
      </TableBody></Table><p className="p-4 text-sm text-muted-foreground">Red = rising faster than sales. Income lines: {income.map((c) => `${c.label} ${change(c.before, c.after)}`).join(" · ") || "—"}.</p></CardContent></Card>}
    </div>
  );
}
