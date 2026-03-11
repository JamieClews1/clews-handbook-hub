import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Legend, Line } from "recharts";
import { PoundSterling, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  startOfWeek, startOfMonth, startOfQuarter,
  format, parseISO, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval,
} from "date-fns";
import type { ComparisonRange } from "./TotalWasteHandled";

type Granularity = "weekly" | "monthly" | "quarterly";

interface TotalRevenueProps {
  externalStartDate: Date;
  externalEndDate: Date;
  comparisonRanges?: ComparisonRange[];
}

const GRANULARITY_OPTIONS: { label: string; value: Granularity }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
];

const COMPARISON_COLORS = [
  "hsl(280, 60%, 55%)",
  "hsl(340, 60%, 55%)",
];

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
    case "quarterly": {
      const [yr, q] = key.split("-");
      return `${q} ${yr}`;
    }
  }
}

function generateBuckets(start: Date, end: Date, granularity: Granularity): string[] {
  switch (granularity) {
    case "weekly":
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(d => format(d, "yyyy-MM-dd"));
    case "monthly":
      return eachMonthOfInterval({ start, end }).map(d => format(d, "yyyy-MM"));
    case "quarterly":
      return eachQuarterOfInterval({ start, end }).map(d => format(d, "yyyy-'Q'Q"));
  }
}

// Extract revenue from raw JSON
function getRevenue(raw: Record<string, unknown> | null): number {
  if (!raw) return 0;
  // Midweigh uses "Total Price", Skiptrak uses "Cost"
  const val = raw["Total Price"] ?? raw["TotalPrice"] ?? raw["Cost"] ?? raw["Price"];
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val.replace(/[£,]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

const formatCurrency = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const TotalRevenue = ({ externalStartDate, externalEndDate, comparisonRanges = [] }: TotalRevenueProps) => {
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [showTable, setShowTable] = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);

  const startStr = format(externalStartDate, "yyyy-MM-dd");
  const endStr = format(externalEndDate, "yyyy-MM-dd");

  // Fetch main data
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["total-revenue", startStr, endStr],
    queryFn: async () => {
      const pageSize = 1000;
      let allJobs: { job_date: string; source: string; raw: Record<string, unknown> }[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, source, raw")
          .gte("job_date", startStr)
          .lte("job_date", endStr)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        allJobs = allJobs.concat((data || []) as typeof allJobs);
        hasMore = (data?.length || 0) === pageSize;
        page++;
      }
      return allJobs;
    },
  });

  // Fetch comparison data
  const compRangeKey = comparisonRanges.map(r => `${r.year}`).join(",");
  const { data: compData } = useQuery({
    queryKey: ["total-revenue-comp", compRangeKey],
    queryFn: async () => {
      const results: Record<number, { job_date: string; source: string; raw: Record<string, unknown> }[]> = {};
      await Promise.all(comparisonRanges.map(async (range) => {
        const s = format(range.start, "yyyy-MM-dd");
        const e = format(range.end, "yyyy-MM-dd");
        const pageSize = 1000;
        let all: typeof results[number] = [];
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("data_hub_jobs")
            .select("job_date, source, raw")
            .gte("job_date", s)
            .lte("job_date", e)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          all = all.concat((data || []) as typeof all);
          hasMore = (data?.length || 0) === pageSize;
          page++;
        }
        results[range.year] = all;
      }));
      return results;
    },
    enabled: comparisonRanges.length > 0,
  });

  // Process chart data
  const chartData = useMemo(() => {
    if (!jobs) return [];
    const buckets = generateBuckets(externalStartDate, externalEndDate, granularity);
    const midweighMap: Record<string, number> = {};
    const skiptrakMap: Record<string, number> = {};

    buckets.forEach(b => { midweighMap[b] = 0; skiptrakMap[b] = 0; });

    jobs.forEach(j => {
      if (!j.job_date) return;
      const date = parseISO(j.job_date);
      const key = getBucketKey(date, granularity);
      const rev = getRevenue(j.raw);
      if (j.source === "midweigh") {
        midweighMap[key] = (midweighMap[key] || 0) + rev;
      } else {
        skiptrakMap[key] = (skiptrakMap[key] || 0) + rev;
      }
    });

    let cumMidweigh = 0;
    let cumSkiptrak = 0;

    // Process comparison ranges
    const compMaps: Record<number, Record<string, number>> = {};
    if (compData) {
      comparisonRanges.forEach(range => {
        const rangeJobs = compData[range.year] || [];
        const map: Record<string, number> = {};
        // Generate buckets for this range but we'll use month index for alignment
        rangeJobs.forEach(j => {
          if (!j.job_date) return;
          const date = parseISO(j.job_date);
          const key = getBucketKey(date, granularity);
          const rev = getRevenue(j.raw);
          map[key] = (map[key] || 0) + rev;
        });
        compMaps[range.year] = map;
      });
    }

    return buckets.map((key, idx) => {
      const midweigh = Math.round(midweighMap[key] || 0);
      const skiptrak = Math.round(skiptrakMap[key] || 0);
      cumMidweigh += midweigh;
      cumSkiptrak += skiptrak;

      const row: Record<string, unknown> = {
        bucket: getBucketLabel(key, granularity),
        midweigh,
        skiptrak,
        total: midweigh + skiptrak,
        cumTotal: cumMidweigh + cumSkiptrak,
      };

      // Add comparison data aligned by bucket index
      comparisonRanges.forEach(range => {
        const compBuckets = generateBuckets(range.start, range.end, granularity);
        const compKey = compBuckets[idx];
        const val = compKey ? Math.round(compMaps[range.year]?.[compKey] || 0) : 0;
        row[`comp_${range.year}`] = val;
      });

      return row;
    });
  }, [jobs, granularity, externalStartDate, externalEndDate, compData, comparisonRanges]);

  // Summary totals
  const totals = useMemo(() => {
    if (!chartData.length) return { midweigh: 0, skiptrak: 0, total: 0 };
    const midweigh = chartData.reduce((s, r) => s + (r.midweigh as number), 0);
    const skiptrak = chartData.reduce((s, r) => s + (r.skiptrak as number), 0);
    return { midweigh, skiptrak, total: midweigh + skiptrak };
  }, [chartData]);

  const chartConfig: Record<string, { label: string; color: string }> = {
    midweigh: { label: "Midweigh", color: "hsl(210, 70%, 50%)" },
    skiptrak: { label: "Skiptrak", color: "hsl(35, 85%, 55%)" },
  };

  comparisonRanges.forEach((range, i) => {
    chartConfig[`comp_${range.year}`] = {
      label: `Total ${range.year}`,
      color: COMPARISON_COLORS[i % COMPARISON_COLORS.length],
    };
  });

  if (showCumulative) {
    chartConfig.cumTotal = { label: "Cumulative", color: "hsl(150, 60%, 45%)" };
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <PoundSterling className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Total Revenue</CardTitle>
            <p className="text-sm text-muted-foreground">Split by Midweigh & Skiptrak</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="cum-rev" checked={showCumulative} onCheckedChange={setShowCumulative} />
            <Label htmlFor="cum-rev" className="text-xs">Cumulative</Label>
          </div>
          <div className="flex gap-1">
            {GRANULARITY_OPTIONS.map(g => (
              <Button
                key={g.value}
                variant={granularity === g.value ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setGranularity(g.value)}
              >
                {g.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Midweigh</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totals.midweigh)}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Skiptrak</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totals.skiptrak)}</p>
          </div>
          <div className="rounded-lg border bg-primary/10 p-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(totals.total)}</p>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">Loading...</div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="bucket"
                className="text-xs"
                tick={{ fontSize: 11 }}
                angle={granularity === "weekly" ? -45 : 0}
                textAnchor={granularity === "weekly" ? "end" : "middle"}
                height={granularity === "weekly" ? 60 : 30}
              />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      const formatted = formatCurrency(value as number);
                      // Map data keys to clearer labels
                      const labelMap: Record<string, string> = {
                        midweigh: "Midweigh",
                        skiptrak: "Skiptrak",
                        total: "Total",
                        cumTotal: "Cumulative",
                      };
                      // Add comparison labels
                      comparisonRanges.forEach((r) => {
                        labelMap[`comp_${r.year}`] = `Total ${r.year}`;
                      });
                      return [formatted, labelMap[name as string] || name];
                    }}
                  />
                }
              />
              <Legend />
              <Bar dataKey="midweigh" stackId="revenue" fill="hsl(210, 70%, 50%)" radius={[0, 0, 0, 0]} name="Midweigh" />
              <Bar dataKey="skiptrak" stackId="revenue" fill="hsl(35, 85%, 55%)" radius={[4, 4, 0, 0]} name="Skiptrak" />
              {showCumulative && (
                <Line type="monotone" dataKey="cumTotal" stroke="hsl(150, 60%, 45%)" strokeWidth={2} dot={false} name="Cumulative" />
              )}
              {comparisonRanges.map((range, i) => (
                <Line
                  key={range.year}
                  type="monotone"
                  dataKey={`comp_${range.year}`}
                  stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name={`Total ${range.year}`}
                />
              ))}
            </ComposedChart>
          </ChartContainer>
        )}

        {/* Collapsible data table */}
        <Collapsible open={showTable} onOpenChange={setShowTable}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-xs gap-1">
              <ChevronDown className={`h-3 w-3 transition-transform ${showTable ? "rotate-180" : ""}`} />
              {showTable ? "Hide" : "Show"} Data Table
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-lg border overflow-auto max-h-[400px] mt-2">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Period</th>
                    <th className="text-right p-2 font-medium">Midweigh</th>
                    <th className="text-right p-2 font-medium">Skiptrak</th>
                    <th className="text-right p-2 font-medium">Total</th>
                    {comparisonRanges.map(r => (
                      <th key={r.year} className="text-right p-2 font-medium">{r.year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, i) => (
                    <tr key={i} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="p-2">{row.bucket as string}</td>
                      <td className="text-right p-2">{formatCurrency(row.midweigh as number)}</td>
                      <td className="text-right p-2">{formatCurrency(row.skiptrak as number)}</td>
                      <td className="text-right p-2 font-medium">{formatCurrency(row.total as number)}</td>
                      {comparisonRanges.map(r => (
                        <td key={r.year} className="text-right p-2">{formatCurrency((row[`comp_${r.year}`] as number) || 0)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-bold bg-muted/30">
                    <td className="p-2">Total</td>
                    <td className="text-right p-2">{formatCurrency(totals.midweigh)}</td>
                    <td className="text-right p-2">{formatCurrency(totals.skiptrak)}</td>
                    <td className="text-right p-2">{formatCurrency(totals.total)}</td>
                    {comparisonRanges.map(r => {
                      const sum = chartData.reduce((s, row) => s + ((row[`comp_${r.year}`] as number) || 0), 0);
                      return <td key={r.year} className="text-right p-2">{formatCurrency(sum)}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default TotalRevenue;
