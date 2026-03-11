import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line, Legend } from "recharts";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  startOfWeek, endOfWeek, format, parseISO, eachWeekOfInterval, eachMonthOfInterval,
  startOfMonth, endOfMonth, getMonth,
} from "date-fns";
import type { ComparisonRange } from "./TotalWasteHandled";

interface WasteNotOnMidweighProps {
  externalStartDate: Date;
  externalEndDate: Date;
  comparisonRanges?: ComparisonRange[];
}

function stringToColor(str: string, index: number): string {
  const hues = [210, 35, 142, 280, 0, 55, 180, 320, 100, 240];
  return `hsl(${hues[index % hues.length]}, 65%, 55%)`;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COMPARISON_COLORS = ["hsl(280, 60%, 55%)", "hsl(340, 60%, 55%)"];

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

const WasteNotOnMidweigh = ({ externalStartDate, externalEndDate, comparisonRanges = [] }: WasteNotOnMidweighProps) => {
  const hasComparison = comparisonRanges.length > 0;
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [showTable, setShowTable] = useState(false);

  const weekStart = startOfWeek(externalStartDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(externalEndDate, { weekStartsOn: 1 });
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  const { data: midweighSkipKeys, isLoading: loadingMidweigh } = useQuery({
    queryKey: ["wnm-midweigh-skip", startStr, endStr],
    queryFn: async () => {
      const all = await fetchAllPaged(
        supabase.from("data_hub_jobs").select("vehicle_registration, job_date")
          .eq("source", "midweigh").eq("job_type", "SKIP")
          .gte("job_date", startStr).lte("job_date", endStr)
      );
      const keys = new Set<string>();
      all.forEach((j: any) => {
        if (j.vehicle_registration && j.job_date) {
          keys.add(`${j.vehicle_registration.replace(/\s/g, "").toUpperCase()}|${j.job_date}`);
        }
      });
      return keys;
    },
  });

  const { data: skiptrakJobs, isLoading: loadingSkiptrak } = useQuery({
    queryKey: ["wnm-skiptrak-all", startStr, endStr],
    queryFn: async () => fetchAllPaged(
      supabase.from("data_hub_jobs").select("job_date, weight_t, job_number, customer, site, vehicle_registration")
        .eq("source", "skiptrak").gte("job_date", startStr).lte("job_date", endStr)
    ),
  });

  // Comparison year queries - single useQuery to avoid hooks-in-loop
  const compRangeKey = comparisonRanges.map(r => `${r.year}`).join(",");
  const { data: compData, isLoading: compLoading } = useQuery({
    queryKey: ["wnm-comparison", compRangeKey],
    queryFn: async () => {
      const results: Record<number, { midweighKeys: Set<string>; skiptrak: any[] }> = {};
      await Promise.all(comparisonRanges.map(async (range) => {
        const cStartStr = format(range.start, "yyyy-MM-dd");
        const cEndStr = format(range.end, "yyyy-MM-dd");
        const [midweighRaw, skiptrak] = await Promise.all([
          fetchAllPaged(
            supabase.from("data_hub_jobs").select("vehicle_registration, job_date")
              .eq("source", "midweigh").eq("job_type", "SKIP")
              .gte("job_date", cStartStr).lte("job_date", cEndStr)
          ),
          fetchAllPaged(
            supabase.from("data_hub_jobs").select("job_date, weight_t, vehicle_registration")
              .eq("source", "skiptrak").gte("job_date", cStartStr).lte("job_date", cEndStr)
          ),
        ]);
        const keys = new Set<string>();
        midweighRaw.forEach((j: any) => {
          if (j.vehicle_registration && j.job_date) {
            keys.add(`${j.vehicle_registration.replace(/\s/g, "").toUpperCase()}|${j.job_date}`);
          }
        });
        results[range.year] = { midweighKeys: keys, skiptrak };
      }));
      return results;
    },
    enabled: comparisonRanges.length > 0,
  });

  const isLoading = loadingMidweigh || loadingSkiptrak || compLoading;

  const nonYardJobs = useMemo(() => {
    if (!skiptrakJobs || !midweighSkipKeys) return [];
    return skiptrakJobs.filter((j: any) => {
      if (!j.vehicle_registration || !j.job_date) return true;
      const key = `${j.vehicle_registration.replace(/\s/g, "").toUpperCase()}|${j.job_date}`;
      return !midweighSkipKeys.has(key);
    });
  }, [skiptrakJobs, midweighSkipKeys]);

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

  const chartData = useMemo(() => {
    if (!nonYardJobs.length && !hasComparison) return [];

    if (hasComparison) {
      // Monthly comparison mode - show total by month
      const months = eachMonthOfInterval({ start: startOfMonth(externalStartDate), end: endOfMonth(externalEndDate) });
      const monthIndices = months.map(d => getMonth(d));
      const currentBuckets: Record<number, number> = {};
      monthIndices.forEach(m => { currentBuckets[m] = 0; });

      nonYardJobs.forEach((job: any) => {
        if (!job.job_date || job.weight_t == null) return;
        const siteKey = `${job.customer || "Unknown"} – ${job.site || "Unknown"}`;
        if (selectedSite !== "all" && siteKey !== selectedSite) return;
        const m = getMonth(parseISO(job.job_date));
        if (currentBuckets[m] !== undefined) currentBuckets[m] += (job.weight_t || 0);
      });

      const compTotals: Record<number, Record<number, number>> = {};
      if (compData) {
        Object.entries(compData).forEach(([yearStr, data]) => {
          const year = Number(yearStr);
          const monthTotals: Record<number, number> = {};
          const cNonYard = data.skiptrak.filter((j: any) => {
            if (!j.vehicle_registration || !j.job_date) return true;
            const key = `${j.vehicle_registration.replace(/\s/g, "").toUpperCase()}|${j.job_date}`;
            return !data.midweighKeys.has(key);
          });
          cNonYard.forEach((job: any) => {
            if (!job.job_date || job.weight_t == null) return;
            const m = getMonth(parseISO(job.job_date));
            monthTotals[m] = (monthTotals[m] || 0) + (job.weight_t || 0);
          });
          compTotals[year] = monthTotals;
        });
      }

      return monthIndices.map(m => {
        const row: any = {
          week: MONTH_LABELS[m],
          weekFull: String(m),
          total: Math.round(currentBuckets[m] * 100) / 100,
        };
        comparisonRanges.forEach(range => {
          row[`total_${range.year}`] = Math.round((compData[range.year]?.[m] || 0) * 100) / 100;
        });
        return row;
      });
    }

    // Standard weekly mode
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
    const topSites = Array.from(siteTotals.entries()).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name]) => name);

    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([weekDate, siteData]) => {
      const row: any = { week: format(parseISO(weekDate), "dd MMM"), weekFull: weekDate };
      let total = 0;
      topSites.forEach((site) => {
        const val = Math.round((siteData[site] || 0) * 100) / 100;
        row[site] = val;
        total += val;
      });
      const otherTotal = Object.entries(siteData).filter(([s]) => !topSites.includes(s)).reduce((sum, [, v]) => sum + v, 0);
      if (otherTotal > 0) { row["Other"] = Math.round(otherTotal * 100) / 100; total += row["Other"]; }
      row.total = Math.round(total * 100) / 100;
      return row;
    });
  }, [nonYardJobs, selectedSite, weekStart, weekEnd, hasComparison, compQueries, comparisonRanges, externalStartDate, externalEndDate]);

  const seriesKeys = useMemo(() => {
    if (!chartData.length || hasComparison) return [];
    const keys = new Set<string>();
    chartData.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "week" && k !== "weekFull" && k !== "total") keys.add(k);
      });
    });
    return Array.from(keys);
  }, [chartData, hasComparison]);

  const chartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {};
    if (hasComparison) {
      const currentYear = externalStartDate.getFullYear();
      cfg.total = { label: `Total ${currentYear}`, color: "hsl(0, 70%, 50%)" };
      comparisonRanges.forEach((range, i) => {
        cfg[`total_${range.year}`] = { label: `Total ${range.year}`, color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] };
      });
    } else {
      seriesKeys.forEach((key, i) => { cfg[key] = { label: key, color: stringToColor(key, i) }; });
      cfg.total = { label: "Total", color: "hsl(0, 0%, 40%)" };
    }
    return cfg;
  }, [seriesKeys, hasComparison, comparisonRanges]);

  const grandTotal = useMemo(() => chartData.reduce((s, r) => s + (r.total || 0), 0), [chartData]);

  const currentYear = externalStartDate.getFullYear();

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
          {!hasComparison && (
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="All sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites ({customerSites.length})</SelectItem>
                {customerSites.map((s) => (
                  <SelectItem key={s.name} value={s.name}>{s.name} ({s.tonnes.toFixed(1)}t)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="hidden md:flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="text-muted-foreground">Total{hasComparison ? ` ${currentYear}` : ""}</div>
              <div className="font-bold text-destructive">{grandTotal.toFixed(2)}t</div>
            </div>
            {comparisonRanges.map((range, i) => {
              const ct = chartData.reduce((s, r) => s + (r[`total_${range.year}`] || 0), 0);
              return (
                <div key={range.year} className="text-right">
                  <div className="text-muted-foreground">Total {range.year}</div>
                  <div className="font-semibold" style={{ color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}>{ct.toFixed(2)}t</div>
                </div>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : hasComparison ? (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: "600px" }}>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Tonnes", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="total" fill="hsl(0, 70%, 50%)" name={`Total ${currentYear}`} radius={[2, 2, 0, 0]} />
                  {comparisonRanges.map((range, i) => (
                    <Line key={range.year} type="monotone" dataKey={`total_${range.year}`} stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} name={`Total ${range.year}`} />
                  ))}
                </ComposedChart>
              </ChartContainer>
            </div>
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
          <Collapsible open={showTable} onOpenChange={setShowTable}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-4 w-full justify-center gap-2 text-xs text-muted-foreground">
                <ChevronDown className={`h-4 w-4 transition-transform ${showTable ? "rotate-180" : ""}`} />
                {showTable ? "Hide data table" : "Show data table"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">{hasComparison ? "Month" : "Week"}</th>
                      {hasComparison ? (
                        <>
                          <th className="text-right py-2 px-3 font-medium text-destructive">Total {currentYear}</th>
                          {comparisonRanges.map((range, i) => (
                            <th key={range.year} className="text-right py-2 px-3 font-medium" style={{ color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}>Total {range.year}</th>
                          ))}
                        </>
                      ) : (
                        <>
                          {seriesKeys.map((key, i) => (
                            <th key={key} className="text-right py-2 px-3 font-medium truncate max-w-[120px]" style={{ color: stringToColor(key, i) }} title={key}>
                              {key.length > 20 ? key.substring(0, 18) + "…" : key}
                            </th>
                          ))}
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row) => (
                      <tr key={row.weekFull} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-1.5 px-3 text-muted-foreground">{row.week}</td>
                        {hasComparison ? (
                          <>
                            <td className="py-1.5 px-3 text-right font-medium">{(row.total || 0).toFixed(2)}</td>
                            {comparisonRanges.map((range) => (
                              <td key={range.year} className="py-1.5 px-3 text-right">{(row[`total_${range.year}`] || 0).toFixed(2)}</td>
                            ))}
                          </>
                        ) : (
                          <>
                            {seriesKeys.map((key) => (
                              <td key={key} className="py-1.5 px-3 text-right">{(row[key] || 0).toFixed(2)}</td>
                            ))}
                            <td className="py-1.5 px-3 text-right font-medium">{(row.total || 0).toFixed(2)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 px-3">Total</td>
                      {hasComparison ? (
                        <>
                          <td className="py-2 px-3 text-right">{grandTotal.toFixed(2)}</td>
                          {comparisonRanges.map((range) => (
                            <td key={range.year} className="py-2 px-3 text-right">{chartData.reduce((s, r) => s + (r[`total_${range.year}`] || 0), 0).toFixed(2)}</td>
                          ))}
                        </>
                      ) : (
                        <>
                          {seriesKeys.map((key) => (
                            <td key={key} className="py-2 px-3 text-right">{chartData.reduce((s, r) => s + (r[key] || 0), 0).toFixed(2)}</td>
                          ))}
                          <td className="py-2 px-3 text-right">{grandTotal.toFixed(2)}</td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};

export default WasteNotOnMidweigh;
