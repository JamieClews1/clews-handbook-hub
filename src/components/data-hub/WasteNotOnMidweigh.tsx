import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  startOfWeek, endOfWeek, format, parseISO, eachWeekOfInterval,
} from "date-fns";

interface WasteNotOnMidweighProps {
  externalStartDate: Date;
  externalEndDate: Date;
}

function stringToColor(str: string, index: number): string {
  const hues = [210, 35, 142, 280, 0, 55, 180, 320, 100, 240];
  return `hsl(${hues[index % hues.length]}, 65%, 55%)`;
}

async function fetchAllPaged(query: any) {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (data) all = all.concat(data);
    hasMore = data?.length === pageSize;
    from += pageSize;
  }
  return all;
}

const WasteNotOnMidweigh = ({ externalStartDate, externalEndDate }: WasteNotOnMidweighProps) => {
  const [selectedSite, setSelectedSite] = useState<string>("all");

  const weekStart = startOfWeek(externalStartDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(externalEndDate, { weekStartsOn: 1 });
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  // Fetch Midweigh INWARD records (vehicle_registration + job_date for matching)
  const { data: midweighInward, isLoading: loadingMidweigh } = useQuery({
    queryKey: ["wnm-midweigh-inward", startStr, endStr],
    queryFn: async () => {
      const all = await fetchAllPaged(
        supabase
          .from("data_hub_jobs")
          .select("vehicle_registration, job_date")
          .eq("source", "midweigh")
          .eq("movement_type", "INWARD")
          .gte("job_date", startStr)
          .lte("job_date", endStr)
      );
      // Build a Set of "vehReg|date" keys for fast lookup
      const keys = new Set<string>();
      all.forEach((j: any) => {
        if (j.vehicle_registration && j.job_date) {
          keys.add(`${j.vehicle_registration.replace(/\s/g, "").toUpperCase()}|${j.job_date}`);
        }
      });
      return keys;
    },
  });

  // Fetch all Skiptrak jobs
  const { data: skiptrakJobs, isLoading: loadingSkiptrak } = useQuery({
    queryKey: ["wnm-skiptrak-all", startStr, endStr],
    queryFn: async () => {
      return await fetchAllPaged(
        supabase
          .from("data_hub_jobs")
          .select("job_date, weight_t, job_number, customer, site, vehicle_registration")
          .eq("source", "skiptrak")
          .gte("job_date", startStr)
          .lte("job_date", endStr)
      );
    },
  });

  const isLoading = loadingMidweigh || loadingSkiptrak;

  // Get Skiptrak jobs with NO matching Midweigh inward on same date + vehicle
  const nonYardJobs = useMemo(() => {
    if (!skiptrakJobs || !midweighInward) return [];
    return skiptrakJobs.filter((j: any) => {
      if (!j.vehicle_registration || !j.job_date) return true; // no vehicle reg = can't match
      const key = `${j.vehicle_registration.replace(/\s/g, "").toUpperCase()}|${j.job_date}`;
      return !midweighInward.has(key);
    });
  }, [skiptrakJobs, midweighInward]);

  // Unique customer-sites
  const customerSites = useMemo(() => {
    const sites = new Map<string, number>();
    nonYardJobs.forEach((j: any) => {
      const key = `${j.customer || "Unknown"} – ${j.site || "Unknown"}`;
      sites.set(key, (sites.get(key) || 0) + (j.weight_t || 0));
    });
    return Array.from(sites.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, tonnes]) => ({ name, tonnes: Math.round(tonnes * 100) / 100 }));
  }, [nonYardJobs]);

  // Chart data: weekly, broken down by customer-site
  const chartData = useMemo(() => {
    if (!nonYardJobs.length) return [];

    const weeks = eachWeekOfInterval({ start: weekStart, end: weekEnd }, { weekStartsOn: 1 });
    const buckets: Record<string, Record<string, number>> = {};
    weeks.forEach((ws) => { buckets[format(ws, "yyyy-MM-dd")] = {}; });

    nonYardJobs.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      const siteKey = `${job.customer || "Unknown"} – ${job.site || "Unknown"}`;
      if (selectedSite !== "all" && siteKey !== selectedSite) return;
      const ws = startOfWeek(parseISO(job.job_date), { weekStartsOn: 1 });
      const weekKey = format(ws, "yyyy-MM-dd");
      if (!buckets[weekKey]) return;
      buckets[weekKey][siteKey] = (buckets[weekKey][siteKey] || 0) + (job.weight_t || 0);
    });

    const siteTotals = new Map<string, number>();
    Object.values(buckets).forEach((week) => {
      Object.entries(week).forEach(([site, tonnes]) => {
        siteTotals.set(site, (siteTotals.get(site) || 0) + tonnes);
      });
    });
    const topSites = Array.from(siteTotals.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name]) => name);

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekDate, siteData]) => {
        const row: any = { week: format(parseISO(weekDate), "dd MMM"), weekFull: weekDate };
        let total = 0;
        topSites.forEach((site) => {
          const val = Math.round((siteData[site] || 0) * 100) / 100;
          row[site] = val;
          total += val;
        });
        const otherTotal = Object.entries(siteData)
          .filter(([s]) => !topSites.includes(s))
          .reduce((sum, [, v]) => sum + v, 0);
        if (otherTotal > 0) {
          row["Other"] = Math.round(otherTotal * 100) / 100;
          total += row["Other"];
        }
        row.total = Math.round(total * 100) / 100;
        return row;
      });
  }, [nonYardJobs, selectedSite, weekStart, weekEnd]);

  const seriesKeys = useMemo(() => {
    if (!chartData.length) return [];
    const keys = new Set<string>();
    chartData.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "week" && k !== "weekFull" && k !== "total") keys.add(k);
      });
    });
    return Array.from(keys);
  }, [chartData]);

  const chartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {};
    seriesKeys.forEach((key, i) => { cfg[key] = { label: key, color: stringToColor(key, i) }; });
    cfg.total = { label: "Total", color: "hsl(0, 0%, 40%)" };
    return cfg;
  }, [seriesKeys]);

  const grandTotal = useMemo(() => {
    return chartData.reduce((s, r) => s + (r.total || 0), 0);
  }, [chartData]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-lg">Waste Tipped Not On Midweigh</CardTitle>
            <p className="text-sm text-muted-foreground">
              Skiptrak tickets with no matching Midweigh inward record (same vehicle &amp; date)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites ({customerSites.length})</SelectItem>
              {customerSites.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name} ({s.tonnes.toFixed(1)}t)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="hidden md:block text-right text-sm">
            <div className="text-muted-foreground">Total</div>
            <div className="font-bold text-destructive">{grandTotal.toFixed(2)}t</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: "900px" }}>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={3} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Tonnes", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {seriesKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="sites" fill={stringToColor(key, i)} name={key}
                      radius={i === seriesKeys.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        )}

        {!isLoading && chartData.length > 0 && (
          <div className="mt-6 w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Week</th>
                  {seriesKeys.map((key, i) => (
                    <th key={key} className="text-right py-2 px-3 font-medium truncate max-w-[120px]"
                      style={{ color: stringToColor(key, i) }} title={key}>
                      {key.length > 20 ? key.substring(0, 18) + "…" : key}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.weekFull} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-1.5 px-3 text-muted-foreground">{row.week}</td>
                    {seriesKeys.map((key) => (
                      <td key={key} className="py-1.5 px-3 text-right">{(row[key] || 0).toFixed(2)}</td>
                    ))}
                    <td className="py-1.5 px-3 text-right font-medium">{(row.total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3">Total</td>
                  {seriesKeys.map((key) => (
                    <td key={key} className="py-2 px-3 text-right">
                      {chartData.reduce((s, r) => s + (r[key] || 0), 0).toFixed(2)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right">{grandTotal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WasteNotOnMidweigh;
