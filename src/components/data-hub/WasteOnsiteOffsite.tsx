import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line, Legend } from "recharts";
import { MapPin, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  format, parseISO, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval,
  getMonth,
} from "date-fns";
import type { ComparisonRange } from "./TotalWasteHandled";

type Granularity = "weekly" | "monthly" | "quarterly";

interface WasteOnsiteOffsiteProps {
  externalStartDate: Date;
  externalEndDate: Date;
  comparisonRanges?: ComparisonRange[];
}

const GRANULARITY_OPTIONS: { label: string; value: Granularity }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
];

const ONSITE_KEYWORDS = ["clews recycling", "clews recycling ltd"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COMPARISON_COLORS = ["hsl(280, 60%, 55%)", "hsl(340, 60%, 55%)"];

function isOnsite(location: string | null): boolean {
  if (!location) return false;
  return ONSITE_KEYWORDS.some(kw => location.toLowerCase().trim().startsWith(kw));
}

function getBucketKey(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case "weekly": return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "monthly": return format(startOfMonth(date), "yyyy-MM");
    case "quarterly": return format(startOfQuarter(date), "yyyy-'Q'Q");
  }
}

function getBucketLabel(key: string, granularity: Granularity): string {
  switch (granularity) {
    case "weekly": return format(parseISO(key), "dd MMM");
    case "monthly": return format(parseISO(key + "-01"), "MMM yyyy");
    case "quarterly": return key;
  }
}

function generateBucketKeys(start: Date, end: Date, granularity: Granularity): string[] {
  switch (granularity) {
    case "weekly":
      return eachWeekOfInterval(
        { start: startOfWeek(start, { weekStartsOn: 1 }), end: endOfWeek(end, { weekStartsOn: 1 }) },
        { weekStartsOn: 1 }
      ).map((d) => format(d, "yyyy-MM-dd"));
    case "monthly":
      return eachMonthOfInterval({ start: startOfMonth(start), end: endOfMonth(end) })
        .map((d) => format(d, "yyyy-MM"));
    case "quarterly":
      return eachQuarterOfInterval({ start: startOfQuarter(start), end: endOfQuarter(end) })
        .map((d) => format(d, "yyyy-'Q'Q"));
  }
}

async function fetchAllPaged(queryBuilder: any) {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await queryBuilder.range(from, from + pageSize - 1);
    if (error) throw error;
    if (data) all = all.concat(data);
    hasMore = data?.length === pageSize;
    from += pageSize;
  }
  return all;
}

const WasteOnsiteOffsite = ({ externalStartDate, externalEndDate, comparisonRanges = [] }: WasteOnsiteOffsiteProps) => {
  const hasComparison = comparisonRanges.length > 0;
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const effectiveGranularity = hasComparison ? "monthly" : granularity;
  const [showTable, setShowTable] = useState(false);

  const weekStart = startOfWeek(externalStartDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(externalEndDate, { weekStartsOn: 1 });
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  const { data: skiptrakJobs, isLoading: loadingMain } = useQuery({
    queryKey: ["waste-onsite-offsite", startStr, endStr],
    queryFn: async () => fetchAllPaged(
      supabase.from("data_hub_jobs").select("job_date, weight_t, tipping_location")
        .eq("source", "skiptrak").gte("job_date", startStr).lte("job_date", endStr)
    ),
  });

  const compRangeKey = comparisonRanges.map(r => `${r.year}`).join(",");
  const { data: compData, isLoading: compLoading } = useQuery({
    queryKey: ["waste-onsite-offsite-comp", compRangeKey],
    queryFn: async () => {
      const results: Record<number, any[]> = {};
      await Promise.all(comparisonRanges.map(async (range) => {
        const cStartStr = format(range.start, "yyyy-MM-dd");
        const cEndStr = format(range.end, "yyyy-MM-dd");
        results[range.year] = await fetchAllPaged(
          supabase.from("data_hub_jobs").select("job_date, weight_t, tipping_location")
            .eq("source", "skiptrak").gte("job_date", cStartStr).lte("job_date", cEndStr)
        );
      }));
      return results;
    },
    enabled: comparisonRanges.length > 0,
  });

  const isLoading = loadingMain || compLoading;

  const chartData = useMemo(() => {
    if (!skiptrakJobs) return [];

    if (hasComparison) {
      const months = eachMonthOfInterval({ start: startOfMonth(externalStartDate), end: endOfMonth(externalEndDate) });
      const monthIndices = months.map(d => getMonth(d));
      const currentBuckets: Record<number, { onsite: number; offsite: number }> = {};
      monthIndices.forEach(m => { currentBuckets[m] = { onsite: 0, offsite: 0 }; });

      skiptrakJobs.forEach((job: any) => {
        if (!job.job_date || job.weight_t == null) return;
        const m = getMonth(parseISO(job.job_date));
        if (currentBuckets[m] === undefined) return;
        if (isOnsite(job.tipping_location)) currentBuckets[m].onsite += job.weight_t || 0;
        else currentBuckets[m].offsite += job.weight_t || 0;
      });

      const compTotals: Record<number, Record<number, number>> = {};
      if (compData) {
        Object.entries(compData).forEach(([yearStr, jobs]) => {
          const monthTotals: Record<number, number> = {};
          (jobs as any[]).forEach((job: any) => {
            if (!job.job_date || job.weight_t == null) return;
            const m = getMonth(parseISO(job.job_date));
            monthTotals[m] = (monthTotals[m] || 0) + (job.weight_t || 0);
          });
          compTotals[Number(yearStr)] = monthTotals;
        });
      }

      return monthIndices.map(m => {
        const row: any = {
          period: MONTH_LABELS[m],
          monthIndex: m,
          onsite: Math.round(currentBuckets[m].onsite * 100) / 100,
          offsite: Math.round(currentBuckets[m].offsite * 100) / 100,
          total: Math.round((currentBuckets[m].onsite + currentBuckets[m].offsite) * 100) / 100,
        };
        comparisonRanges.forEach(range => {
          row[`total_${range.year}`] = Math.round((compTotals[range.year]?.[m] || 0) * 100) / 100;
        });
        return row;
      });
    }

    const keys = generateBucketKeys(externalStartDate, externalEndDate, effectiveGranularity);
    const buckets: Record<string, { onsite: number; offsite: number }> = {};
    keys.forEach((k) => { buckets[k] = { onsite: 0, offsite: 0 }; });

    skiptrakJobs.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      const key = getBucketKey(parseISO(job.job_date), effectiveGranularity);
      if (!buckets[key]) return;
      if (isOnsite(job.tipping_location)) buckets[key].onsite += job.weight_t || 0;
      else buckets[key].offsite += job.weight_t || 0;
    });

    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([bucketKey, values]) => ({
      period: getBucketLabel(bucketKey, effectiveGranularity),
      bucketKey,
      onsite: Math.round(values.onsite * 100) / 100,
      offsite: Math.round(values.offsite * 100) / 100,
      total: Math.round((values.onsite + values.offsite) * 100) / 100,
    }));
  }, [skiptrakJobs, compQueries, externalStartDate, externalEndDate, effectiveGranularity, hasComparison, comparisonRanges]);

  const totals = useMemo(() => {
    if (!chartData.length) return { onsite: 0, offsite: 0, total: 0 };
    return {
      onsite: chartData.reduce((s, r) => s + r.onsite, 0),
      offsite: chartData.reduce((s, r) => s + r.offsite, 0),
      total: chartData.reduce((s, r) => s + r.total, 0),
    };
  }, [chartData]);

  const currentYear = externalStartDate.getFullYear();

  const chartConfig: Record<string, { label: string; color: string }> = {
    onsite: { label: "Tipped On-Site (Clews)", color: "hsl(142, 70%, 45%)" },
    offsite: { label: "Tipped Off-Site", color: "hsl(35, 85%, 55%)" },
    total: { label: `Total ${hasComparison ? currentYear : ""}`, color: "hsl(210, 70%, 50%)" },
  };
  comparisonRanges.forEach((range, i) => {
    chartConfig[`total_${range.year}`] = { label: `Total ${range.year}`, color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] };
  });

  const periodLabel = effectiveGranularity === "weekly" ? "Week" : effectiveGranularity === "monthly" ? "Month" : "Quarter";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Waste Tipped: On-Site vs Off-Site</CardTitle>
            <p className="text-sm text-muted-foreground">
              On-site = tipping location is Clews Recycling · Based on Skiptrak data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {!hasComparison && (
            <div className="flex gap-1 rounded-lg border bg-muted p-0.5">
              {GRANULARITY_OPTIONS.map((opt) => (
                <Button key={opt.value} variant={granularity === opt.value ? "default" : "ghost"} size="sm" className="text-xs h-7 px-3" onClick={() => setGranularity(opt.value)}>
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="text-muted-foreground">On-Site</div>
              <div className="font-semibold" style={{ color: chartConfig.onsite.color }}>{totals.onsite.toFixed(2)}t</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Off-Site</div>
              <div className="font-semibold" style={{ color: chartConfig.offsite.color }}>{totals.offsite.toFixed(2)}t</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Total{hasComparison ? ` ${currentYear}` : ""}</div>
              <div className="font-bold" style={{ color: chartConfig.total.color }}>{totals.total.toFixed(2)}t</div>
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
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: effectiveGranularity === "weekly" && !hasComparison ? "900px" : "600px" }}>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={effectiveGranularity === "weekly" && !hasComparison ? 3 : 0} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Tonnes", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {hasComparison && <Legend />}
                  <Bar dataKey="onsite" stackId="waste" fill={chartConfig.onsite.color} name="On-Site (Clews)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="offsite" stackId="waste" fill={chartConfig.offsite.color} name="Off-Site" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="total" stroke={chartConfig.total.color} strokeWidth={2} dot={false} name={`Total ${hasComparison ? currentYear : ""}`} />
                  {comparisonRanges.map((range, i) => (
                    <Line key={range.year} type="monotone" dataKey={`total_${range.year}`} stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} name={`Total ${range.year}`} />
                  ))}
                </ComposedChart>
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
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">{periodLabel}</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.onsite.color }}>On-Site</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.offsite.color }}>Off-Site</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.total.color }}>Total{hasComparison ? ` ${currentYear}` : ""}</th>
                      {comparisonRanges.map((range, i) => (
                        <th key={range.year} className="text-right py-2 px-3 font-medium" style={{ color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}>Total {range.year}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-1.5 px-3 text-muted-foreground">{row.period}</td>
                        <td className="py-1.5 px-3 text-right">{row.onsite.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">{row.offsite.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right font-medium">{row.total.toFixed(2)}</td>
                        {comparisonRanges.map((range) => (
                          <td key={range.year} className="py-1.5 px-3 text-right">{(row[`total_${range.year}`] || 0).toFixed(2)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 px-3">Total</td>
                      <td className="py-2 px-3 text-right">{totals.onsite.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">{totals.offsite.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">{totals.total.toFixed(2)}</td>
                      {comparisonRanges.map((range) => (
                        <td key={range.year} className="py-2 px-3 text-right">{chartData.reduce((s, r) => s + (r[`total_${range.year}`] || 0), 0).toFixed(2)}</td>
                      ))}
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

export default WasteOnsiteOffsite;
