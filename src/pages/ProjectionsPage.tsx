import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import InsightsFrame, { useInsightsPeriod } from "@/components/insights/InsightsFrame";
import { useInsightsData, ticketValue } from "@/hooks/useInsightsData";
import { useCompanyPlAccess } from "@/hooks/useCompanyPlAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PL_PROJECTION_METHODS, type PlProjectionMethod } from "@/lib/company-pl-analysis";
import { operationalForecast } from "@/lib/insights-forecast";
import { londonToday } from "@/lib/insights-period";
const gbp = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export default function ProjectionsPage() {
  const { period } = useInsightsPeriod(); const { canAccessPl } = useCompanyPlAccess(); const [method, setMethod] = useState<PlProjectionMethod>("seasonal");
  const year = Number(period.end.slice(0, 4)); const today = londonToday(); const end = `${year}-12-31` > today ? today : `${year}-12-31`;
  const query = useInsightsData(`${year}-01-01`, end); const prior = useInsightsData(`${year - 1}-01-01`, `${year - 1}-12-31`);
  const completed = year < Number(today.slice(0, 4)) ? 12 : Number(today.slice(5, 7)) - 1;
  const data = useMemo(() => {
    const aggregate = (rows: NonNullable<typeof query.data>, source: string) => months.map((_, index) => { const matching = rows.filter(row => row.source === source && Number(row.job_date.slice(5, 7)) === index + 1); return matching.length ? matching.reduce((sum, row) => sum + ticketValue(row), 0) : null; });
    const mw = aggregate(query.data ?? [], "midweigh"); const st = aggregate(query.data ?? [], "skiptrak");
    const fm = operationalForecast(mw, aggregate(prior.data ?? [], "midweigh"), year, completed, method);
    const fs = operationalForecast(st, aggregate(prior.data ?? [], "skiptrak"), year, completed, method);
    const gaps = months.filter((_, index) => index < completed && (mw[index] === null || st[index] === null));
    return { gaps, rows: months.map((month, index) => ({ month, midweigh: index < completed || index === completed && year === Number(today.slice(0, 4)) ? mw[index] : fm?.[index] ?? null, skiptrak: index < completed || index === completed && year === Number(today.slice(0, 4)) ? st[index] : fs?.[index] ?? null, forecast: index > completed || year < Number(today.slice(0, 4)) ? false : index !== completed ? false : false, estimated: year === Number(today.slice(0, 4)) && index > completed })), actual: (query.data ?? []).reduce((sum, row) => sum + ticketValue(row), 0), total: fm && fs ? fm.reduce((sum, value) => sum + value, 0) + fs.reduce((sum, value) => sum + value, 0) : null };
  }, [query.data, prior.data, method, completed, year, today]);
  const loading = query.isLoading || prior.isLoading;
  return <InsightsFrame title="Revenue & forecast" description="What the work is worth, and where the year is heading" actions={canAccessPl ? <Button asChild size="sm" variant="outline"><Link to="/finance/company-pl">Open Company P&L</Link></Button> : undefined}>
    <div className="space-y-2 text-sm text-muted-foreground"><Badge variant="outline">Fixed: calendar year {year} · monthly · both sources</Badge><p>Ticket value is weighed Midweigh Total Price plus weighed Skiptrak Cost. It is an operational measure, not reported sales or cash. Future bookings and unweighed entries are excluded.</p><p>Current month is shown as actual to date; forecasts begin next month and use completed months only.</p></div>
    {query.isError || prior.isError ? <div role="alert">Ticket values could not be loaded. <Button variant="outline" onClick={() => { void query.refetch(); void prior.refetch(); }}>Try again</Button></div> : <>
      <div className="grid gap-4 md:grid-cols-2"><article className="rounded-lg border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Ticket value · recorded to date</p>{loading ? <Skeleton className="mt-3 h-9 w-32" /> : <p className="mt-2 text-3xl font-semibold tabular-nums">{gbp(data.actual)}</p>}<Badge variant="outline" className="mt-3 text-primary">Actual</Badge></article><article className="rounded-lg border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Full-year ticket-value estimate</p>{loading ? <Skeleton className="mt-3 h-9 w-32" /> : <p className="mt-2 text-3xl font-semibold tabular-nums">{data.total === null ? "Unavailable" : gbp(data.total)}</p>}<Badge variant="outline" className="mt-3">Forecast</Badge><p className="mt-2 text-xs text-muted-foreground">{data.total === null ? "Missing source months: forecast paused rather than treating them as zero." : PL_PROJECTION_METHODS.find(item => item.key === method)?.summary}</p></article></div>
      {!loading && data.gaps.length > 0 && <p className="border-l-4 border-warning p-3 text-sm">Missing weighed source records in {data.gaps.join(", ")}. This may be a data gap, not proof of zero trading; forecast and comparisons are paused.</p>}
      <div className="flex flex-wrap gap-2">{PL_PROJECTION_METHODS.map(item => <Button key={item.key} size="sm" variant={method === item.key ? "default" : "outline"} onClick={() => setMethod(item.key)}>{item.label}</Button>)}</div>
      <section className="space-y-4 border-t border-border pt-5"><h2 className="font-semibold">Monthly ticket value</h2>{loading ? <Skeleton className="h-80 w-full" /> : <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.rows}><CartesianGrid className="stroke-border" vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={value => new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value)} /><Tooltip formatter={value => gbp(Number(value))} /><Legend /><Bar dataKey="midweigh" name="Midweigh" fill="hsl(var(--info))" stackId="value">{data.rows.map(row => <Cell key={row.month} fillOpacity={row.estimated ? 0.35 : 1} />)}</Bar><Bar dataKey="skiptrak" name="Skiptrak" fill="hsl(var(--warning))" stackId="value">{data.rows.map(row => <Cell key={row.month} fillOpacity={row.estimated ? 0.35 : 1} />)}</Bar></BarChart></ResponsiveContainer></div>}<p className="text-xs text-muted-foreground">Solid = actual, including current month to date. Faded = forecast. Missing months remain unknown.</p></section>
      <details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-medium">Monthly data table</summary><div className="overflow-x-auto"><table className="mt-3 w-full text-right text-sm tabular-nums"><thead><tr><th className="text-left">Month</th><th>Status</th><th>Midweigh</th><th>Skiptrak</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.month} className="border-t border-border"><td className="py-2 text-left">{row.month} {year}</td><td>{row.estimated ? "Forecast" : "Actual"}</td><td>{row.midweigh === null ? "Unknown" : gbp(row.midweigh)}</td><td>{row.skiptrak === null ? "Unknown" : gbp(row.skiptrak)}</td></tr>)}</tbody></table></div></details>
    </>}
  </InsightsFrame>;
}