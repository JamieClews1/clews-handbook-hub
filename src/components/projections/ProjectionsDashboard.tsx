import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Legend, Line, Cell } from "recharts";
import { TrendingUp, Weight, PoundSterling, Loader2, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type MonthlyData = {
  month: string;
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

const ACTUAL_MIDWEIGH_COLOR = "hsl(210, 70%, 50%)";
const ACTUAL_SKIPTRAK_COLOR = "hsl(35, 85%, 55%)";
const PROJECTED_MIDWEIGH_COLOR = "hsl(210, 50%, 70%)";
const PROJECTED_SKIPTRAK_COLOR = "hsl(35, 65%, 75%)";

function fetchAllPages(startStr: string, endStr: string) {
  return async () => {
    const pageSize = 1000;
    let allJobs: { job_date: string; source: string; job_type: string | null; weight_t: number | null; raw: Record<string, unknown> }[] = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("job_date, source, job_type, weight_t, raw")
        .gte("job_date", startStr)
        .lte("job_date", endStr)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      allJobs = allJobs.concat((data || []) as typeof allJobs);
      hasMore = (data?.length || 0) === pageSize;
      page++;
    }
    return allJobs;
  };
}

function aggregateToMonths(jobs: { job_date: string; source: string; job_type: string | null; weight_t: number | null; raw: Record<string, unknown> }[]): MonthlyData[] {
  const monthMap: Record<string, MonthlyData> = {};
  jobs.forEach((j) => {
    if (!j.job_date) return;
    const monthKey = format(parseISO(j.job_date), "yyyy-MM");
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { month: monthKey, midweighTonnes: 0, skiptrakTonnes: 0, midweighRevenue: 0, skiptrakRevenue: 0 };
    }
    const weight = j.weight_t || 0;
    const rev = getRevenue(j.raw);
    if (j.source === "midweigh") {
      monthMap[monthKey].midweighTonnes += weight / 1000; // KG → tonnes
      monthMap[monthKey].midweighRevenue += rev;
    } else {
      monthMap[monthKey].skiptrakTonnes += weight; // already tonnes
      monthMap[monthKey].skiptrakRevenue += rev;
    }
  });
  return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
}

export function ProjectionsDashboard() {
  const [showMethodology, setShowMethodology] = useState(false);

  // Determine the current month – months before this in 2026 are "complete"
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  // Fetch historical 2024-2025 + 2026 actuals in parallel
  const { data: historicalData, isLoading: loadingHist } = useQuery({
    queryKey: ["projections-historical"],
    queryFn: fetchAllPages("2024-01-01", "2025-12-31"),
  });

  const { data: actualData2026, isLoading: loadingActual } = useQuery({
    queryKey: ["projections-2026-actuals"],
    queryFn: fetchAllPages("2026-01-01", "2026-12-31"),
  });

  const isLoading = loadingHist || loadingActual;

  const { chartRows, summaryCards } = useMemo(() => {
    if (!historicalData) return { chartRows: [], summaryCards: null };

    // Historical monthly aggregates for projection basis
    const history = aggregateToMonths(historicalData);

    // Seasonal averages from 2024-2025
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

    // YoY growth factor (2025 vs 2024)
    let y2025Rev = 0, y2024Rev = 0, y2025Tonnes = 0, y2024Tonnes = 0;
    history.forEach((d) => {
      const year = d.month.substring(0, 4);
      if (year === "2025") {
        y2025Rev += d.midweighRevenue + d.skiptrakRevenue;
        y2025Tonnes += d.midweighTonnes + d.skiptrakTonnes;
      } else if (year === "2024") {
        y2024Rev += d.midweighRevenue + d.skiptrakRevenue;
        y2024Tonnes += d.midweighTonnes + d.skiptrakTonnes;
      }
    });
    const revenueGrowth = y2024Rev > 0 ? y2025Rev / y2024Rev : 1;
    const tonnesGrowth = y2024Tonnes > 0 ? y2025Tonnes / y2024Tonnes : 1;

    // 2026 actuals by month
    const actuals2026 = actualData2026 ? aggregateToMonths(actualData2026) : [];
    const actualMap: Record<string, MonthlyData> = {};
    actuals2026.forEach((d) => { actualMap[d.month] = d; });

    // Build rows: actuals for completed months, projected for future months
    type Row = {
      month: string;
      label: string;
      midweighTonnes: number;
      skiptrakTonnes: number;
      totalTonnes: number;
      midweighRevenue: number;
      skiptrakRevenue: number;
      totalRevenue: number;
      isActual: boolean;
    };

    const rows: Row[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `2026-${String(m).padStart(2, "0")}`;
      const label = format(new Date(2026, m - 1, 1), "MMM");
      // A month is "actual" if it's a completed month (before the current month in 2026)
      const isActual = currentYear > 2026 || (currentYear === 2026 && m < currentMonth);
      const actual = actualMap[monthKey];

      if (isActual && actual) {
        rows.push({
          month: monthKey,
          label,
          midweighTonnes: Math.round(actual.midweighTonnes),
          skiptrakTonnes: Math.round(actual.skiptrakTonnes),
          totalTonnes: Math.round(actual.midweighTonnes + actual.skiptrakTonnes),
          midweighRevenue: Math.round(actual.midweighRevenue),
          skiptrakRevenue: Math.round(actual.skiptrakRevenue),
          totalRevenue: Math.round(actual.midweighRevenue + actual.skiptrakRevenue),
          isActual: true,
        });
      } else {
        // Projected
        const avg = monthlyAvgs[m];
        const count = avg.count || 1;
        const mwT = Math.round((avg.midweighTonnes / count) * tonnesGrowth);
        const stT = Math.round((avg.skiptrakTonnes / count) * tonnesGrowth);
        const mwR = Math.round((avg.midweighRevenue / count) * revenueGrowth);
        const stR = Math.round((avg.skiptrakRevenue / count) * revenueGrowth);
        rows.push({
          month: monthKey,
          label,
          midweighTonnes: mwT,
          skiptrakTonnes: stT,
          totalTonnes: mwT + stT,
          midweighRevenue: mwR,
          skiptrakRevenue: stR,
          totalRevenue: mwR + stR,
          isActual: false,
        });
      }
    }

    const totalMwT = rows.reduce((s, r) => s + r.midweighTonnes, 0);
    const totalStT = rows.reduce((s, r) => s + r.skiptrakTonnes, 0);
    const totalMwR = rows.reduce((s, r) => s + r.midweighRevenue, 0);
    const totalStR = rows.reduce((s, r) => s + r.skiptrakRevenue, 0);
    const actualCount = rows.filter((r) => r.isActual).length;

    return {
      chartRows: rows,
      summaryCards: {
        totalTonnes: totalMwT + totalStT,
        midweighTonnes: totalMwT,
        skiptrakTonnes: totalStT,
        totalRevenue: totalMwR + totalStR,
        midweighRevenue: totalMwR,
        skiptrakRevenue: totalStR,
        revenueGrowthPct: ((revenueGrowth - 1) * 100).toFixed(1),
        tonnesGrowthPct: ((tonnesGrowth - 1) * 100).toFixed(1),
        actualMonths: actualCount,
      },
    };
  }, [historicalData, actualData2026, currentYear, currentMonth]);

  const tonnesChartConfig = {
    midweighTonnes: { label: "Midweigh", color: ACTUAL_MIDWEIGH_COLOR },
    skiptrakTonnes: { label: "Skiptrak", color: ACTUAL_SKIPTRAK_COLOR },
    totalTonnes: { label: "Total", color: "hsl(150, 60%, 45%)" },
  };

  const revenueChartConfig = {
    midweighRevenue: { label: "Midweigh", color: ACTUAL_MIDWEIGH_COLOR },
    skiptrakRevenue: { label: "Skiptrak", color: ACTUAL_SKIPTRAK_COLOR },
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

  const renderCustomBar = (dataKey: string, actualColor: string, projectedColor: string, stackId: string, radiusTop: boolean) => (
    <Bar dataKey={dataKey} stackId={stackId} radius={radiusTop ? [4, 4, 0, 0] : [0, 0, 0, 0]} name={dataKey === "midweighTonnes" || dataKey === "midweighRevenue" ? "Midweigh" : "Skiptrak"}>
      {chartRows.map((entry, index) => (
        <Cell key={index} fill={entry.isActual ? actualColor : projectedColor} />
      ))}
    </Bar>
  );

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
            Actuals for completed months, projected for remaining months based on 2024–2025 trends
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowMethodology(!showMethodology)}>
          <Info className="h-4 w-4" />
          Methodology
        </Button>
      </div>

      {/* Legend for actual vs projected */}
      {summaryCards && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: ACTUAL_MIDWEIGH_COLOR }} />
            <span>Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: PROJECTED_MIDWEIGH_COLOR }} />
            <span>Projected</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {summaryCards.actualMonths} month{summaryCards.actualMonths !== 1 ? "s" : ""} actual data
          </Badge>
        </div>
      )}

      {/* Methodology panel */}
      {showMethodology && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How projections are calculated</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Completed months</strong> in 2026 use actual data from the database.</li>
              <li>Remaining months are projected using <strong>seasonal averages from 2024–2025</strong> with a YoY growth factor.</li>
              <li>Growth factor: 2025 full-year totals ÷ 2024 full-year totals, applied separately for tonnage and revenue.</li>
              <li>Midweigh weights converted from KG to tonnes (÷1000). Skiptrak weights already in tonnes.</li>
              <li>Revenue: Midweigh "Total Price" field, Skiptrak "Cost" field.</li>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Weight className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Estimated Waste Tonnage</CardTitle>
                    <p className="text-sm text-muted-foreground">2026 full year (actuals + projected)</p>
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

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <PoundSterling className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Estimated Revenue</CardTitle>
                    <p className="text-sm text-muted-foreground">2026 full year (actuals + projected)</p>
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
                  <CardTitle className="text-lg">Monthly Waste Tonnage</CardTitle>
                  <p className="text-sm text-muted-foreground">Solid bars = actuals · Faded bars = projected</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={tonnesChartConfig} className="h-[350px] w-full">
                <ComposedChart data={chartRows} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => {
                          const labels: Record<string, string> = {
                            midweighTonnes: "Midweigh",
                            skiptrakTonnes: "Skiptrak",
                            totalTonnes: "Total",
                          };
                          const suffix = item?.payload?.isActual ? " (Actual)" : " (Projected)";
                          return [formatTonnes(value as number), (labels[name as string] || name) + suffix];
                        }}
                      />
                    }
                  />
                  <Legend />
                  {renderCustomBar("midweighTonnes", ACTUAL_MIDWEIGH_COLOR, PROJECTED_MIDWEIGH_COLOR, "tonnes", false)}
                  {renderCustomBar("skiptrakTonnes", ACTUAL_SKIPTRAK_COLOR, PROJECTED_SKIPTRAK_COLOR, "tonnes", true)}
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
                  <CardTitle className="text-lg">Monthly Revenue</CardTitle>
                  <p className="text-sm text-muted-foreground">Solid bars = actuals · Faded bars = projected</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={revenueChartConfig} className="h-[350px] w-full">
                <ComposedChart data={chartRows} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => {
                          const labels: Record<string, string> = {
                            midweighRevenue: "Midweigh",
                            skiptrakRevenue: "Skiptrak",
                            totalRevenue: "Total",
                          };
                          const suffix = item?.payload?.isActual ? " (Actual)" : " (Projected)";
                          return [formatCurrency(value as number), (labels[name as string] || name) + suffix];
                        }}
                      />
                    }
                  />
                  <Legend />
                  {renderCustomBar("midweighRevenue", ACTUAL_MIDWEIGH_COLOR, PROJECTED_MIDWEIGH_COLOR, "revenue", false)}
                  {renderCustomBar("skiptrakRevenue", ACTUAL_SKIPTRAK_COLOR, PROJECTED_SKIPTRAK_COLOR, "revenue", true)}
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
                          <th className="text-left p-2 font-medium">Type</th>
                          <th className="text-right p-2 font-medium">Midweigh (t)</th>
                          <th className="text-right p-2 font-medium">Skiptrak (t)</th>
                          <th className="text-right p-2 font-medium">Total (t)</th>
                          <th className="text-right p-2 font-medium">Midweigh (£)</th>
                          <th className="text-right p-2 font-medium">Skiptrak (£)</th>
                          <th className="text-right p-2 font-medium">Total (£)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartRows.map((row) => (
                          <tr key={row.month} className="border-t border-border/50 hover:bg-muted/30">
                            <td className="p-2 font-medium">{row.label} 2026</td>
                            <td className="p-2">
                              <Badge variant={row.isActual ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                {row.isActual ? "Actual" : "Projected"}
                              </Badge>
                            </td>
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
                          <td className="p-2"></td>
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
