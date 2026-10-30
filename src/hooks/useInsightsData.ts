import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";
import { outgoingHeadlineTotals, midweighRowTonnes } from "@/lib/outgoing-waste-streams";
import { capReportingEnd } from "@/lib/insights-period";

export type InsightJob = { id: string; job_number: string; job_date: string; source: string; job_type: string | null; movement_type: string | null; tipping_location: string | null; customer: string | null; ewc: string | null; waste_description: string | null; weight_t: number | null; product: string | null; mw_value: string | null; st_value: string | null };
export async function fetchInsightsJobs(start: string, end: string): Promise<InsightJob[]> {
  const rows: InsightJob[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await withTimeout(supabase.from("data_hub_jobs")
      .select("id,job_number,job_date,source,job_type,movement_type,tipping_location,customer,ewc,waste_description,weight_t,product:raw->>Product,mw_value:raw->>Total Price,st_value:raw->>Cost")
      .in("source", ["midweigh", "skiptrak"]).gte("job_date", start).lte("job_date", capReportingEnd(end)).gt("weight_t", 0)
      .order("id", { ascending: true }).range(offset, offset + 999).returns<InsightJob[]>(), 20000, "Insights source read");
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const seen = new Set<string>();
  return rows.filter(row => { const key = `${row.source}:${row.job_number || row.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
export function useInsightsData(start: string, end: string, enabled = true) {
  return useQuery({ queryKey: ["insights-jobs", start, capReportingEnd(end)], queryFn: () => fetchInsightsJobs(start, end), enabled, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 });
}
export function ticketValue(row: InsightJob) { const value = row.source === "midweigh" ? row.mw_value : row.st_value; const n = Number(String(value ?? "").replace(/[£,\s]/g, "")); return Number.isFinite(n) ? n : 0; }
export function insightTotals(rows: InsightJob[]) {
  const out = rows.filter(row => row.source === "midweigh" && row.job_type === "WASTEOUT");
  const headlines = outgoingHeadlineTotals(out);
  const incoming = rows.filter(row => row.source === "midweigh" && ["WASTEIN", "SKIP"].includes(row.job_type ?? "")).reduce((sum, row) => sum + midweighRowTonnes(row), 0);
  const offsite = rows.filter(row => row.source === "skiptrak" && Boolean(row.tipping_location?.trim()) && !row.tipping_location?.trim().toLowerCase().startsWith("clews recycling")).reduce((sum, row) => sum + Number(row.weight_t ?? 0), 0);
  return { ...headlines, incoming, handled: incoming + offsite, offsite, loads: out.length, recyclingRate: headlines.total ? headlines.recycling / headlines.total * 100 : null, landfillRate: headlines.total ? headlines.landfill / headlines.total * 100 : null };
}