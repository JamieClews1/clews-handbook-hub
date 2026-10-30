import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsightsData, insightTotals } from "@/hooks/useInsightsData";
import { outgoingHeadlineTotals } from "@/lib/outgoing-waste-streams";
import InsightsFrame, { useInsightsPeriod } from "./InsightsFrame";
import InsightMetric from "./InsightMetric";
const tonnes = (value: number) => `${value.toLocaleString("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} t`;
const rate = (value: number) => `${value.toFixed(1)}%`;
export default function InsightsOverview() {
  const { period, previous, params } = useInsightsPeriod();
  const query = useInsightsData(period.start, period.end); const prev = useInsightsData(previous?.start ?? period.start, previous?.end ?? period.end, Boolean(previous));
  const current = useMemo(() => insightTotals(query.data ?? []), [query.data]);
  const before = previous && prev.data ? insightTotals(prev.data) : null;
  const monthly = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof query.data>>();
    for (const row of query.data ?? []) { if (row.source !== "midweigh" || row.job_type !== "WASTEOUT") continue; const key = row.job_date.slice(0, 7); const rows = groups.get(key) ?? []; rows.push(row); groups.set(key, rows); }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, rows]) => ({ month, ...outgoingHeadlineTotals(rows) }));
  }, [query.data]);
  const outRatio = current.incoming > 0 ? current.total / current.incoming * 100 : null;
  const loading = query.isLoading || (Boolean(previous) && prev.isLoading);
  const error = query.isError || (Boolean(previous) && prev.isError);
  return <InsightsFrame title="Overview" description="How the yard is performing this period">
    {error ? <div role="alert" className="border-l-4 border-destructive p-4"><p>Complete Insights figures could not be loaded.</p><Button variant="outline" className="mt-2" onClick={() => { void query.refetch(); void prev.refetch(); }}>Try again</Button></div> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <InsightMetric label="Waste handled" value={current.handled} previous={before?.handled} formatValue={tonnes} loading={loading} definition="Midweigh WASTEIN/SKIP yard intake plus weighed Skiptrak jobs with a recorded non-Clews tipping location. Midweigh kg converted to tonnes; Skiptrak already in tonnes." />
        <InsightMetric label="Recycling rate · all units" value={current.recyclingRate} previous={before?.recyclingRate} formatValue={rate} rate loading={loading} definition="Midweigh WASTEOUT tonnes excluding Landfill and RDF divided by all weighed WASTEOUT tonnes. Product, not destination, separates Trommel and Landfill." />
        <InsightMetric label="Landfill rate · all units" value={current.landfillRate} previous={before?.landfillRate} formatValue={rate} rate lowerIsBetter loading={loading} definition="Waste Out product under EWC 19 12 12 divided by all weighed Midweigh WASTEOUT tonnes." />
        <InsightMetric label="Waste out · all units" value={current.total} previous={before?.total} formatValue={tonnes} loading={loading} definition="All weighed Midweigh WASTEOUT records. Native operational tickets are not changed." />
        <InsightMetric label="Waste in · yard" value={current.incoming} previous={before?.incoming} formatValue={tonnes} loading={loading} definition="Weighed Midweigh WASTEIN and SKIP records only, converted from kg to tonnes." />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 border-t border-border pt-5"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><h2 className="font-semibold">Needs attention</h2></div>
          {loading ? <Skeleton className="h-28 w-full" /> : !query.data?.length ? <p className="text-sm text-muted-foreground">No weighed records in this period. Review Data Uploads or choose another period.</p> : <div className="space-y-4 text-sm">
            {outRatio !== null && outRatio > 100 && <p className="border-l-2 border-warning pl-3">Waste out is <strong>{outRatio.toFixed(1)}%</strong> of yard waste in. Review stock movements and internal transfers; the reason is not established by these totals. <Link className="text-primary underline" to={`/performance-hub/waste-kpis?${params}`}>Waste flows →</Link></p>}
            {previous && !prev.data?.length && <p>Prior-period weighed records are missing; comparisons are unavailable.</p>}
            <p className="text-muted-foreground">Rates above cover all units. Monthly yard incentive rates retain their existing outward-movement scope.</p>
            <Button asChild size="sm" variant="outline"><Link to={`/performance-hub/reports?${params}`}>Review data checks <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>}
        </section>
        <section className="min-w-0 space-y-4 border-t border-border pt-5"><h2 className="font-semibold">Where outgoing waste went</h2><p className="text-xs text-muted-foreground">Midweigh WASTEOUT · all units · tonnes per month</p>{loading ? <Skeleton className="h-64 w-full" /> : <><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid className="stroke-border" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="recycling" name="Recycled" stackId="out" fill="hsl(var(--primary))" /><Bar dataKey="rdf" name="RDF" stackId="out" fill="hsl(var(--warning))" /><Bar dataKey="landfill" name="Landfill" stackId="out" fill="hsl(var(--destructive))" /></BarChart></ResponsiveContainer></div><details className="text-sm"><summary className="cursor-pointer font-medium">Monthly data table</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-right text-xs tabular-nums"><thead><tr><th className="text-left">Month</th><th>Recycled</th><th>RDF</th><th>Landfill</th></tr></thead><tbody>{monthly.map(row => <tr key={row.month} className="border-t border-border"><td className="py-2 text-left">{row.month}</td><td>{tonnes(row.recycling)}</td><td>{tonnes(row.rdf)}</td><td>{tonnes(row.landfill)}</td></tr>)}</tbody></table></div></details></>}
        </section>
      </div>
    </>}
    <div className="grid gap-4 border-t border-border pt-5 md:grid-cols-3">{[["Waste flows", "What came in, and where it went", "/performance-hub/waste-kpis"], ["Recovery & incentives", "Wood recovery, savings assumptions and monthly bonus pools", "/performance-hub/recovery"], ["Revenue & forecast", "Operational ticket value, separate from Company P&L", "/performance-hub/projections"]].map(([label, detail, path]) => <Link key={path} to={`${path}?${params}`} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary"><div><h2 className="font-semibold">{label}</h2><p className="mt-2 text-sm text-muted-foreground">{detail}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}</div>
  </InsightsFrame>;
}