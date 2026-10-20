import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { yearEndProjections, type PlYear } from "@/lib/company-pl-analysis";
import { plSheetLabel, type PlSheetName } from "@/lib/company-pl";

const gbp = (n: number) => `${n < 0 ? "−" : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export default function CompanyPlProjections({ cur, prev, source }: { cur: PlYear; prev: PlYear; source: PlSheetName }) {
  const [method, setMethod] = useState("seasonal");
  const projections = yearEndProjections(cur, prev);
  const selected = projections.find((p) => p.key === method) ?? projections[0];
  if (!selected) return <p role="alert" className="text-muted-foreground">Projections are unavailable: reported months contain missing or invalid sales, gross profit, overheads or net profit figures. Check Source worksheets.</p>;
  const remainingMonths = 12 - cur.reportedMonths;
  const end = cur.monthLabels[cur.reportedMonths - 1]?.slice(0, 3);
  const recentStart = cur.monthLabels[Math.max(0, cur.reportedMonths - 3)]?.slice(0, 3);
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><TrendingUp className="h-5 w-5 text-primary" />{cur.year} year-end projections</h2><p className="mt-1 text-sm text-muted-foreground">{plSheetLabel(source)} · January–{end} actuals · {remainingMonths} months remaining</p></div>
      <span className="text-sm font-medium text-muted-foreground">Indicative estimates · not a budget or cash forecast</span>
    </div>
    <div className="flex flex-wrap gap-2">{projections.map((p) => <Button key={p.key} size="sm" variant={selected.key === p.key ? "default" : "outline"} onClick={() => setMethod(p.key)}>{p.label}</Button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([
      ["Projected sales", gbp(selected.projected.sales)], ["Projected gross margin", pct(selected.projected.grossMargin)], ["Projected overheads", gbp(selected.projected.overheads)], ["Projected net profit", gbp(selected.projected.netProfit)],
    ] as const).map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${label === "Projected net profit" && selected.projected.netProfit < 0 ? "text-destructive" : "text-foreground"}`}>{value}</p></CardContent></Card>)}</div>
    <div className="overflow-x-auto border border-border rounded-md"><Table><TableHeader><TableRow><TableHead>Performance</TableHead><TableHead className="text-right">Actual Jan–{end}</TableHead><TableHead className="text-right">Estimated remaining</TableHead><TableHead className="text-right">Projected full year</TableHead></TableRow></TableHeader><TableBody>
      {([ ["Sales", "sales"], ["Gross profit", "grossProfit"], ["Overheads", "overheads"], ["Net profit", "netProfit"] ] as const).map(([label, key]) => <TableRow key={key}><TableCell className="font-medium">{label}</TableCell><TableCell className="text-right tabular-nums">{gbp(selected.actual[key])}</TableCell><TableCell className="text-right tabular-nums">{gbp(selected.remaining[key])}</TableCell><TableCell className="text-right font-semibold tabular-nums">{gbp(selected.projected[key])}</TableCell></TableRow>)}
      <TableRow><TableCell className="font-medium">Net margin</TableCell><TableCell className="text-right">{pct(selected.actual.netMargin)}</TableCell><TableCell className="text-right">{pct(selected.remaining.netMargin)}</TableCell><TableCell className="text-right font-semibold">{pct(selected.projected.netMargin)}</TableCell></TableRow>
    </TableBody></Table></div>
    <div className="space-y-2 text-sm"><h3 className="font-semibold">Assumptions</h3><p className="text-muted-foreground">{selected.key === "seasonal" ? `Remaining sales follow ${prev.year}'s monthly sales pattern, scaled by this year's matched-period sales growth. Gross margin stays at this year's year-to-date level; overheads and the difference between gross profit minus overheads and reported net profit continue at their year-to-date monthly averages.` : selected.key === "recent" ? `Remaining months repeat the average sales, gross profit, overheads and net profit recorded in ${recentStart}–${end}.` : "Remaining months repeat the year-to-date monthly averages for sales, gross profit, overheads and net profit."}</p>
      {!projections.some((p) => p.key === "seasonal") && <p className="text-muted-foreground">Seasonality is unavailable without a complete, valid previous calendar year for this worksheet.</p>}
      <p className="text-muted-foreground">No adjustments for one-off income, future price changes, new contracts or unexpected costs. Year-to-date methods may repeat one-off income; the latest-month method may miss seasonal changes. Unreported months remain estimates, not recorded results. Net profit is not EBITDA or cash.</p>
    </div>
    <div className="space-y-2"><h3 className="font-semibold">Compare projection methods</h3><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Full-year sales</TableHead><TableHead className="text-right">Full-year net profit</TableHead><TableHead className="text-right">Net margin</TableHead></TableRow></TableHeader><TableBody>{projections.map((p) => <TableRow key={p.key}><TableCell>{p.label}</TableCell><TableCell className="text-right tabular-nums">{gbp(p.projected.sales)}</TableCell><TableCell className="text-right tabular-nums">{gbp(p.projected.netProfit)}</TableCell><TableCell className="text-right">{pct(p.projected.netMargin)}</TableCell></TableRow>)}</TableBody></Table></div><p className="text-xs text-muted-foreground">These are alternative assumptions, not a statistical confidence range or best/worst-case forecast.</p></div>
  </section>;
}