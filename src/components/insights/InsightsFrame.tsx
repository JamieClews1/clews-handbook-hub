import { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Sparkles, Settings2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeading } from "@/components/PageHeading";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { capReportingEnd, comparisonPeriod, londonToday, periodLabel, validDay, type InsightsPeriod } from "@/lib/insights-period";

export function useInsightsPeriod() {
  const [params, setParams] = useSearchParams(); const today = londonToday();
  const requestedEnd = params.get("end"); const end = validDay(requestedEnd) ? capReportingEnd(requestedEnd, today) : today;
  const requestedStart = params.get("start"); const start = validDay(requestedStart) && requestedStart <= end ? requestedStart : `${end.slice(0, 4)}-01-01`;
  const comparison = params.get("compare"); const compare = comparison === "off" || comparison === "previous" ? comparison : "year";
  const period: InsightsPeriod = { start, end, compare };
  const update = (values: Record<string, string>) => setParams(old => { const next = new URLSearchParams(old); Object.entries(values).forEach(([key, value]) => next.set(key, value)); return next; });
  return { period, previous: comparisonPeriod(period), params, update };
}
export function InsightsFreshness() {
  const query = useQuery({ queryKey: ["insights-sync-status"], queryFn: async () => {
    const entries = await Promise.all(["midweigh", "skiptrak"].map(async source => {
      const { data, error } = await supabase.from("data_upload_log").select("uploaded_at").eq("source", source).order("uploaded_at", { ascending: false }).limit(1);
      if (error) throw error; return { source, at: data?.[0]?.uploaded_at };
    })); return entries;
  }, staleTime: 60000, retry: 1 });
  return <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-live="polite">
    {query.isLoading ? "Checking sync…" : query.isError ? "Sync status unavailable" : query.data?.map(item => <span key={item.source} className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${item.at ? "bg-primary" : "bg-warning"}`} />{item.source === "midweigh" ? "Midweigh" : "Skiptrak"}: {item.at ? `synced ${new Date(item.at).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "no sync recorded"}</span>)}
    <Button variant="ghost" size="icon" className="h-7 w-7" title="Refresh sync status" aria-label="Refresh sync status" onClick={() => void query.refetch()}><RefreshCw className="h-3.5 w-3.5" /></Button>
  </div>;
}
export function InsightsFilterBar() {
  const { period, previous, update } = useInsightsPeriod(); const today = londonToday();
  return <div className="space-y-2">
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1.5"><Label htmlFor="insights-start" className="text-xs text-muted-foreground">Period from</Label><Input id="insights-start" type="date" value={period.start} max={period.end} onChange={event => { if (validDay(event.target.value)) update({ start: event.target.value }); }} className="w-40" /></div>
      <div className="space-y-1.5"><Label htmlFor="insights-end" className="text-xs text-muted-foreground">To</Label><Input id="insights-end" type="date" value={period.end} min={period.start} max={today} onChange={event => { if (validDay(event.target.value)) update({ end: event.target.value }); }} className="w-40" /></div>
      <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => update({ start: `${today.slice(0, 4)}-01-01`, end: today })}>YTD</Button><Button size="sm" variant="outline" onClick={() => update({ start: `${today.slice(0, 7)}-01`, end: today })}>This month</Button></div>
      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Compare</Label><Select value={period.compare} onValueChange={compare => update({ compare })}><SelectTrigger className="w-52" aria-label="Comparison period"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="off">Off</SelectItem><SelectItem value="year">Same period last year</SelectItem><SelectItem value="previous">Previous period</SelectItem></SelectContent></Select></div>
      <div className="ml-auto self-center"><InsightsFreshness /></div>
    </div>
    <p className="text-xs text-muted-foreground">{periodLabel(period.start, period.end)}{previous ? ` versus ${periodLabel(previous.start, previous.end)}.` : "."} {period.end === today ? "Current month is to date." : ""} Reporting excludes future dates and unweighed entries; stored bookings are unchanged.</p>
  </div>;
}
const links = [ ["Overview", "/performance-hub"], ["Waste flows", "/performance-hub/waste-kpis"], ["Recovery & incentives", "/performance-hub/recovery"], ["Revenue & forecast", "/performance-hub/projections"], ["Data checks", "/performance-hub/reports"] ];
export default function InsightsFrame({ title, description, children, filters = true, actions }: { title: string; description: string; children: ReactNode; filters?: boolean; actions?: ReactNode }) {
  const { isAdmin } = useAuth(); const { params } = useInsightsPeriod();
  return <div className="mx-auto max-w-screen-2xl space-y-5 px-4 py-6 sm:px-6">
    <PageHeading title={title} description={description} actions={<><Button asChild size="sm" variant="outline" className="gap-2"><Link to="/performance-hub/reports?tab=ask-ai"><Sparkles className="h-4 w-4" />Ask AI</Link></Button>{isAdmin && <Button asChild size="icon" variant="outline" title="Insights settings" aria-label="Insights settings"><Link to="/performance-hub/insights-settings"><Settings2 className="h-4 w-4" /></Link></Button>}{actions}</>} />
    <nav aria-label="Insights pages" className="flex flex-wrap gap-1 border-b border-border pb-3">{links.map(([label, path]) => <Button asChild key={path} variant="ghost" size="sm"><Link to={`${path}?${params}`}>{label}</Link></Button>)}</nav>
    {filters && <InsightsFilterBar />}{children}
  </div>;
}