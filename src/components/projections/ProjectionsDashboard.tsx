import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Legend, Line } from "recharts";
import { TrendingUp, Weight, PoundSterling, Loader2, Info } from "lucide-react";
import { format, parseISO, startOfMonth, eachMonthOfInterval, subYears } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type MonthlyData = {
  month: string; // yyyy-MM
  midweighTonnes: number;
  skiptrakTonnes: number;
  midweighRevenue: number;
  skiptrakRevenue: number;
};

function getRevenue(raw: Record<string, unknown> | null): number {
  if (!raw) return 0;
  const val = raw["Total Price"] ?? raw["TotalPrice"] ?? raw["Cost"] ?? raw["Price"];
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val.replace(/[£,]/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

const formatCurrency = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatTonnes = (v: number) =>
  `${v.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}t`;

export function ProjectionsDashboard() {
  const [showMethodology, setShowMethodology] = useState(false);

  // Fetch last 2 years of data for projection basis
  const { data: historicalData, isLoading } = useQuery({
    queryKey: ["projections-historical"],
    queryFn: async () => {
      const end = new Date();
      const start = subYears(end, 2);
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");

      const pageSize = 1000;
      let allJobs: { job_date: string; source: string; weight_t: number | null; raw: Record<string, unknown> }[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, source, weight_t, raw")
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

  // Process historical data into monthly buckets and generate projections
  const { monthlyHistory, projections2026, summaryCards } = useMemo(() => {
    if (!historicalData) return { monthlyHistory: [], projections2026: [], summaryCards: null };

    // Build monthly aggregates
    const monthMap: Record<string, MonthlyData> = {};
    historicalData.forEach((j) => {
      if (!j.job_date) return;
      const monthKey = format(parseISO(j.job_date), "yyyy-MM");
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { month: monthKey, midweighTonnes: 0, skiptrakTonnes: 0, midweighRevenue: 0, skiptrakRevenue: 0 };
      }
      const weight = j.weight_t || 0;
      const rev = getRevenue(j.raw);
      if (j.source === "midweigh") {
        monthMap[monthKey].midweighTonnes += weight;
        monthMap[monthKey].midweighRevenue += rev;
      } else {
        monthMap[monthKey].skiptrakTonnes += weight;
        monthMap[monthKey].skiptrakRevenue += rev;
      }
    });

    const history = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Calculate average monthly values by calendar month (1-12) for seasonality
    const monthlyAvgs: Record<number, { midweighTonnes: number; skiptrakTonnes: number; midweighRevenue: number; skiptrakRevenue: number; count: number }> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyAvgs[m] = { midweighTonnes: 0, skiptrakTonnes: 0, midweighRevenue: 0, skiptrakRevenue: 0, count: 0 };
    }

    history.forEach((d) => {
      const calMonth = parseInt(d.month.split("-")[1], 10);
      monthlyAvgs[calMonth].midweighTonnes += d.midweighTonnes;
      monthlyAvgs[calMonth].skiptrakTonnes += d.skiptrakTonnes;
      monthlyAvgs[calMonth].midweighRevenue += d.midweighRevenue;
      monthlyAvgs[calMonth].skiptrakRevenue += d.skiptrakRevenue;
      monthlyAvgs[calMonth].count += 1;
    });

    // Apply a simple growth factor: compare last 12 months total vs prior 12 months
    const now = new Date();
    const last12Start = format(subYears(now, 1), "yyyy-MM");
    const prev12Start = format(subYears(now, 2), "yyyy-MM");

    let last12Rev = 0, prev12Rev = 0, last12Tonnes = 0, prev12Tonnes = 0;
    history.forEach((d) => {
      if (d.month >= last12Start) {
        last12Rev += d.midweighRevenue + d.skiptrakRevenue;
        last12Tonnes += d.midweighTonnes + d.skiptrakTonnes;
      } else if (d.month >= prev12Start) {
        prev12Rev += d.midweighRevenue + d.skiptrakRevenue;
        prev12Tonnes += d.midweighTonnes + d.skiptrakTonnes;
      }
    });

    const revenueGrowth = prev12Rev > 0 ? last12Rev / prev12Rev : 1;
    const tonnesGrowth = prev12Tonnes > 0 ? last12Tonnes / prev12Tonnes : 1;

    // Generate 2026 projections
    const projected: {
      month: string;
      label: string;
      midweighTonnes: number;
      skiptrakTonnes: number;
      totalTonnes: number;
      midweighRevenue: number;
      skiptrakRevenue: number;
      totalRevenue: number;
    }[] = [];

    for (let m = 1; m <= 12; m++) {
      const avg = monthlyAvgs[m];
      const count = avg.count || 1;

      const mwTonnes = Math.round((avg.midweighTonnes / count) * tonnesGrowth);
      const stTonnes = Math.round((avg.skiptrakTonnes / count) * tonnesGrowth);
      const mwRev = Math.round((avg.midweighRevenue / count) * revenueGrowth);
      const stRev = Math.round((avg.skiptrakRevenue / count) * revenueGrowth);

      projected.push({
        month: `2026-${String(m).padStart(2, "0")}`,
        label: format(new Date(2026, m - 1, 1), "MMM"),
        midweighTonnes: mwTonnes,
        skiptrakTonnes: stTonnes,
        totalTonnes: mwTonnes + stTonnes,
        midweighRevenue: mwRev,
        skiptrakRevenue: stRev,
        totalRevenue: mwRev + stRev,
      });
    }

    const totalMidweighTonnes = projected.reduce((s, p) => s + p.midweighTonnes, 0);
    const totalSkiptrakTonnes = projected.reduce((s, p) => s + p.skiptrakTonnes, 0);
    const totalMidweighRev = projected.reduce((s, p) => s + p.midweighRevenue, 0);
    const totalSkiptrakRev = projected.reduce((s, p) => s + p.skiptrakRevenue, 0);

    return {
      monthlyHistory: history,
      projections2026: projected,
      summaryCards: {
        totalTonnes: totalMidweighTonnes + totalSkiptrakTonnes,
        midweighTonnes: totalMidweighTonnes,
        skiptrakTonnes: totalSkiptrakTonnes,
        totalRevenue: totalMidweighRev + totalSkiptrakRev,
        midweighRevenue: totalMidweighRev,
        skiptrakRevenue: totalSkiptrakRev,
        revenueGrowthPct: ((revenueGrowth - 1) * 100).toFixed(1),
        tonnesGrowthPct: ((tonnesGrowth - 1) * 100).toFixed(1),
      },
    };
  }, [historicalData]);

  const tonnesChartConfig = {
    midweighTonnes: { label: "Midweigh", color: "hsl(210, 70%, 50%)" },
    skiptrakTonnes: { label: "Skiptrak", color: "hsl(35, 85%, 55%)" },
    totalTonnes: { label: "Total", color: "hsl(150, 60%, 45%)" },
  };

  const revenueChartConfig = {
    midweighRevenue: { label: "Midweigh", color: "hsl(210, 70%, 50%)" },
    skiptrakRevenue: { label: "Skiptrak", color: "hsl(35, 85%, 55%)" },
    totalRevenue: { label: "Total", color: "hsl(150, 60%, 45%)" },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Analysing historical data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            2026 Projections
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered forecasts based on the last 24 months of operational data
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowMethodology(!showMethodology)}>
          <Info className="h-4 w-4" />
          Methodology
        </Button>
      </div>

      {/* Methodology panel */}
      {showMethodology && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How projections are calculated</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Monthly averages are calculated for each calendar month using the last 2 years of data to capture <strong>seasonal patterns</strong>.</li>
              <li>A <strong>year-over-year growth factor</strong> is applied by comparing the most recent 12 months against the prior 12 months.</li>
              <li>Tonnage and revenue are projected independently to account for differing growth rates.</li>
              <li>Midweigh revenue uses the "Total Price" field; Skiptrak uses the "Cost" field from raw job data.</li>
            </ul>
            {summaryCards && (
              <div className="flex gap-4 pt-2">
                <Badge variant="outline" className="text-xs">
                  Tonnage Growth: {Number(summaryCards.tonnesGrowthPct) >= 0 ? "+" : ""}{summaryCards.tonnesGrowthPct}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Revenue Growth: {Number(summaryCards.revenueGrowthPct) >= 0 ? "+" : ""}{summaryCards.revenueGrowthPct}%
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {summaryCards && (
        <>
          {/* Summary Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tonnes Summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Weight className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Estimated Waste Tonnage</CardTitle>
                    <p className="text-sm text-muted-foreground">Projected 2026 total</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Midweigh</p>
                    <p className="text-xl font-bold text-foreground">{formatTonnes(summaryCards.midweighTonnes)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Skiptrak</p>
                    <p className="text-xl font-bold text-foreground">{formatTonnes(summaryCards.skiptrakTonnes)}</p>
                  </div>
                  <div className="rounded-lg border bg-primary/10 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-primary">{formatTonnes(summaryCards.totalTonnes)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <PoundSterling className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Estimated Revenue</CardTitle>
                    <p className="text-sm text-muted-foreground">Projected 2026 total</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Midweigh</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(summaryCards.midweighRevenue)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Skiptrak</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(summaryCards.skiptrakRevenue)}</p>
                  </div>
                  <div className="rounded-lg border bg-primary/10 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(summaryCards.totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tonnes Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Weight className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Monthly Waste Tonnage Projection</CardTitle>
                  <p className="text-sm text-muted-foreground">Estimated monthly intake for 2026</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={tonnesChartConfig} className="h-[350px] w-full">
                <ComposedChart data={projections2026} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          const labels: Record<string, string> = {
                            midweighTonnes: "Midweigh",
                            skiptrakTonnes: "Skiptrak",
                            totalTonnes: "Total",
                          };
                          return [formatTonnes(value as number), labels[name as string] || name];
                        }}
                      />
                    }
                  />
                  <Legend />
                  <Bar dataKey="midweighTonnes" stackId="tonnes" fill="hsl(210, 70%, 50%)" radius={[0, 0, 0, 0]} name="Midweigh" />
                  <Bar dataKey="skiptrakTonnes" stackId="tonnes" fill="hsl(35, 85%, 55%)" radius={[4, 4, 0, 0]} name="Skiptrak" />
                  <Line type="monotone" dataKey="totalTonnes" stroke="hsl(150, 60%, 45%)" strokeWidth={2} dot={{ r: 3 }} name="Total" />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <PoundSterling className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Monthly Revenue Projection</CardTitle>
                  <p className="text-sm text-muted-foreground">Estimated monthly revenue for 2026</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[350px] w-full">
                <ComposedChart data={projections2026} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          const labels: Record<string, string> = {
                            midweighRevenue: "Midweigh",
                            skiptrakRevenue: "Skiptrak",
                            totalRevenue: "Total",
                          };
                          return [formatCurrency(value as number), labels[name as string] || name];
                        }}
                      />
                    }
                  />
                  <Legend />
                  <Bar dataKey="midweighRevenue" stackId="revenue" fill="hsl(210, 70%, 50%)" radius={[0, 0, 0, 0]} name="Midweigh" />
                  <Bar dataKey="skiptrakRevenue" stackId="revenue" fill="hsl(35, 85%, 55%)" radius={[4, 4, 0, 0]} name="Skiptrak" />
                  <Line type="monotone" dataKey="totalRevenue" stroke="hsl(150, 60%, 45%)" strokeWidth={2} dot={{ r: 3 }} name="Total" />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Data Table */}
          <Card>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardTitle className="text-base">Monthly Breakdown Table</CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="rounded-lg border overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Month</th>
                          <th className="text-right p-2 font-medium">Midweigh (t)</th>
                          <th className="text-right p-2 font-medium">Skiptrak (t)</th>
                          <th className="text-right p-2 font-medium">Total (t)</th>
                          <th className="text-right p-2 font-medium">Midweigh (£)</th>
                          <th className="text-right p-2 font-medium">Skiptrak (£)</th>
                          <th className="text-right p-2 font-medium">Total (£)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projections2026.map((row) => (
                          <tr key={row.month} className="border-t border-border/50 hover:bg-muted/30">
                            <td className="p-2 font-medium">{row.label} 2026</td>
                            <td className="text-right p-2">{formatTonnes(row.midweighTonnes)}</td>
                            <td className="text-right p-2">{formatTonnes(row.skiptrakTonnes)}</td>
                            <td className="text-right p-2 font-medium">{formatTonnes(row.totalTonnes)}</td>
                            <td className="text-right p-2">{formatCurrency(row.midweighRevenue)}</td>
                            <td className="text-right p-2">{formatCurrency(row.skiptrakRevenue)}</td>
                            <td className="text-right p-2 font-medium">{formatCurrency(row.totalRevenue)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-border font-bold bg-muted/30">
                          <td className="p-2">Full Year</td>
                          <td className="text-right p-2">{formatTonnes(summaryCards.midweighTonnes)}</td>
                          <td className="text-right p-2">{formatTonnes(summaryCards.skiptrakTonnes)}</td>
                          <td className="text-right p-2">{formatTonnes(summaryCards.totalTonnes)}</td>
                          <td className="text-right p-2">{formatCurrency(summaryCards.midweighRevenue)}</td>
                          <td className="text-right p-2">{formatCurrency(summaryCards.skiptrakRevenue)}</td>
                          <td className="text-right p-2">{formatCurrency(summaryCards.totalRevenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </>
      )}
    </div>
  );
}
