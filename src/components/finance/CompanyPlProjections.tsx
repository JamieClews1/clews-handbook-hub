import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { monthlyActuals, monthlyForecast, yearEndProjections, PL_PROJECTION_METHODS, type PlProjectionMethod, type PlYear } from "@/lib/company-pl-analysis";
import { plSheetLabel, type PlSheetName } from "@/lib/company-pl";

const gbp = (n: number) => `${n < 0 ? "−" : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

type Props = { cur: PlYear; prev: PlYear; source: PlSheetName; method: PlProjectionMethod; onMethodChange: (method: PlProjectionMethod) => void };

export default function CompanyPlProjections({ cur, prev, source, method, onMethodChange }: Props) {
  const projections = yearEndProjections(cur, prev);
  const requested = projections.find((p) => p.key === method);
  const selected = requested ?? projections[0];
  if (!selected) return <p role="alert" className="text-muted-foreground">Projections are unavailable: reported months contain missing or invalid sales, gross profit, overheads or net profit figures. Check Source worksheets.</p>;
  const remainingMonths = 12 - cur.reportedMonths;
  const forecast = monthlyForecast(cur, prev, selected.key);
  const actualRows = monthlyActuals(cur);
  const meta = PL_PROJECTION_METHODS.find((m) => m.key === selected.key);
  const end = cur.monthLabels[cur.reportedMonths - 1]?.slice(0, 3);
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><TrendingUp className="h-5 w-5 text-primary" />{cur.year} year-end projections</h2><p className="mt-1 text-sm text-muted-foreground">{plSheetLabel(source)} · January–{end} actuals · {remainingMonths} months remaining</p></div>
      <span className="text-sm font-medium text-muted-foreground">Indicative estimates · not a budget or cash forecast</span>
    </div>
    {!requested && <p className="text-sm text-muted-foreground">The model chosen in Settings is unavailable for this data (it needs a complete previous year), so “{selected.label}” is shown instead.</p>}
    <div className="flex flex-wrap gap-2">{projections.map((p) => <Button key={p.key} size="sm" variant={selected.key === p.key ? "default" : "outline"} onClick={() => onMethodChange(p.key)}>{p.label}</Button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([
      ["Projected sales", gbp(selected.projected.sales)], ["Projected gross margin", pct(selected.projected.grossMargin)], ["Projected overheads", gbp(selected.projected.overheads)], ["Projected net profit", gbp(selected.projected.netProfit)],
    ] as const).map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${label === "Projected net profit" && selected.projected.netProfit < 0 ? "text-destructive" : "text-foreground"}`}>{value}</p></CardContent></Card>)}</div>
    <div className="overflow-x-auto border border-border rounded-md"><Table><TableHeader><TableRow><TableHead>Performance</TableHead><TableHead className="text-right">Actual Jan–{end}</TableHead><TableHead className="text-right">Estimated remaining</TableHead><TableHead className="text-right">Projected full year</TableHead></TableRow></TableHeader><TableBody>
      {([ ["Sales", "sales"], ["Gross profit", "grossProfit"], ["Overheads", "overheads"], ["Net profit", "netProfit"] ] as const).map(([label, key]) => <TableRow key={key}><TableCell className="font-medium">{label}</TableCell><TableCell className="text-right tabular-nums">{gbp(selected.actual[key])}</TableCell><TableCell className="text-right tabular-nums">{gbp(selected.remaining[key])}</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(selected.projected[key])}</TableCell></TableRow>)}
      <TableRow><TableCell className="font-medium">Net margin</TableCell><TableCell className="text-right">{pct(selected.actual.netMargin)}</TableCell><TableCell className="text-right">{pct(selected.remaining.netMargin)}</TableCell><TableCell className="text-right font-semibold">{pct(selected.projected.netMargin)}</TableCell></TableRow>
    </TableBody></Table></div>
    <Card><CardHeader><CardTitle className="text-base">{cur.year} month by month — actual January–{end} and the remaining forecast</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Gross profit</TableHead><TableHead className="text-right">Overheads</TableHead><TableHead className="text-right">Net profit</TableHead></TableRow></TableHeader><TableBody>
        <TableRow className="bg-muted/50 hover:bg-muted/50"><TableCell colSpan={5} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actual — year to date</TableCell></TableRow>
        {actualRows.map((m) => <TableRow key={m.label}><TableCell className="font-medium">{m.label.slice(0, 3)}</TableCell><TableCell className="text-right tabular-nums">{gbp(m.sales)}</TableCell><TableCell className="text-right tabular-nums">{gbp(m.grossProfit)}</TableCell><TableCell className="text-right tabular-nums">{gbp(m.overheads)}</TableCell><TableCell className={`text-right tabular-nums ${m.netProfit < 0 ? "text-destructive" : ""}`}>{gbp(m.netProfit)}</TableCell></TableRow>)}
        <TableRow className="border-t-2"><TableCell className="font-semibold">Year to date total</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(actualRows.reduce((s, m) => s + m.sales, 0))}</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(actualRows.reduce((s, m) => s + m.grossProfit, 0))}</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(actualRows.reduce((s, m) => s + m.overheads, 0))}</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(actualRows.reduce((s, m) => s + m.netProfit, 0))}</TableCell></TableRow>
        <TableRow className="bg-muted/50 hover:bg-muted/50"><TableCell colSpan={5} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forecast — remaining months</TableCell></TableRow>
        {forecast.map((m) => <TableRow key={m.label}><TableCell className="font-medium">{m.label.slice(0, 3)} <span className="text-xs font-normal text-muted-foreground">est</span></TableCell><TableCell className="text-right tabular-nums">{gbp(m.sales)}</TableCell><TableCell className="text-right tabular-nums">{gbp(m.grossProfit)}</TableCell><TableCell className="text-right tabular-nums">{gbp(m.overheads)}</TableCell><TableCell className={`text-right tabular-nums ${m.netProfit < 0 ? "text-destructive" : ""}`}>{gbp(m.netProfit)}</TableCell></TableRow>)}
        <TableRow><TableCell className="font-semibold">Total remaining</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(forecast.reduce((s, m) => s + m.sales, 0))}</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(forecast.reduce((s, m) => s + m.grossProfit, 0))}</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(forecast.reduce((s, m) => s + m.overheads, 0))}</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(forecast.reduce((s, m) => s + m.netProfit, 0))}</TableCell></TableRow>
      </TableBody></Table></div>
      <p className="text-sm text-muted-foreground">{meta?.calculation} Months under “Actual” are recorded results; forecast months are estimates, not recorded results.</p>
    </CardContent></Card>
    <div className="space-y-2 text-sm"><h3 className="font-semibold">How this projection is calculated</h3><p className="text-muted-foreground">{meta?.calculation}</p>
      <p className="text-muted-foreground">No adjustments for one-off income, future price changes, new contracts or unexpected costs. Unreported months remain estimates, not recorded results. Net profit is not EBITDA or cash. You can change the model in Settings.</p>
    </div>
    <div className="space-y-2"><h3 className="font-semibold">Compare projection methods</h3><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Full-year sales</TableHead><TableHead className="text-right">Full-year net profit</TableHead><TableHead className="text-right">Net margin</TableHead></TableRow></TableHeader><TableBody>{projections.map((p) => <TableRow key={p.key} className={p.key === selected.key ? "bg-muted/50" : undefined}><TableCell>{p.label}</TableCell><TableCell className="text-right tabular-nums">{gbp(p.projected.sales)}</TableCell><TableCell className="text-right tabular-nums">{gbp(p.projected.netProfit)}</TableCell><TableCell className="text-right">{pct(p.projected.netMargin)}</TableCell></TableRow>)}</TableBody></Table></div><p className="text-xs text-muted-foreground">These are alternative assumptions, not a statistical confidence range or best/worst-case forecast.</p></div>
  </section>;
}
