import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, Legend, Line, ComposedChart } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TreePine } from "lucide-react";
import {
  format,
  subMonths,
  startOfMonth,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
  startOfWeek,
  startOfQuarter,
  startOfYear,
  parseISO,
} from "date-fns";

type Granularity = "week" | "month" | "quarter" | "year";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Annual" },
];

const bucketStart = (d: Date, g: Granularity) =>
  g === "week" ? startOfWeek(d, { weekStartsOn: 1 })
  : g === "month" ? startOfMonth(d)
  : g === "quarter" ? startOfQuarter(d)
  : startOfYear(d);

const bucketKey = (d: Date, g: Granularity) => format(bucketStart(d, g), "yyyy-MM-dd");

const bucketLabel = (d: Date, g: Granularity) =>
  g === "week" ? `w/c ${format(d, "dd MMM")}`
  : g === "month" ? format(d, "MMM yy")
  : g === "quarter" ? `Q${format(d, "Q yyyy")}`
  : format(d, "yyyy");

const bucketDates = (start: Date, end: Date, g: Granularity) =>
  g === "week" ? eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
  : g === "month" ? eachMonthOfInterval({ start, end })
  : g === "quarter" ? eachQuarterOfInterval({ start, end })
  : eachYearOfInterval({ start, end });


const WOOD_A_PRODUCTS = ["WOOD A", "WOOD A OUT"];
const WOOD_C_PRODUCTS = ["WOOD-C", "WOOD-C OUT"];
const ALL_WOOD_PRODUCTS = [...WOOD_A_PRODUCTS, ...WOOD_C_PRODUCTS];

const MIXED_WASTE_DESCRIPTIONS = [
  "Mixed Municipal Waste",
  "mixed construction and demolition wastes other than those mentioned in 17 09 01 17 09 02 and 17 09 03",
  "mixed construction and demolition wastes other than those mentioned in 17 09 01 17 09 02 and 17 09 0",
];

interface MonthData {
  month: string;
  label: string;
  woodAInward: number;
  woodAOutward: number;
  woodCInward: number;
  woodCOutward: number;
  mixedWasteInward: number;
  extractedA: number;
  extractedC: number;
}

interface WasteKPIGradeCWoodProps {
  externalStartDate?: Date;
  externalEndDate?: Date;
}

const WasteKPIGradeCWood = ({ externalStartDate, externalEndDate }: WasteKPIGradeCWoodProps = {}) => {
  const defaultStart = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
  const startDate = externalStartDate ? format(externalStartDate, "yyyy-MM-dd") : defaultStart;
  const endDateStr = externalEndDate ? format(externalEndDate, "yyyy-MM-dd") : undefined;

  const { data: woodData, isLoading: loadingWood } = useQuery({
    queryKey: ["waste-kpi-wood-all", startDate, endDateStr],
    queryFn: async () => {
      const allRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let query = supabase
          .from("data_hub_jobs")
          .select("job_date, movement_type, weight_t, raw")
          .eq("source", "midweigh")
          .in("movement_type", ["INWARD", "OUTWARD"])
          .gte("job_date", startDate);
        if (endDateStr) query = query.lte("job_date", endDateStr);
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        const filtered = data.filter((r: any) => {
          const product = (r.raw as any)?.Product;
          return ALL_WOOD_PRODUCTS.includes(product);
        });
        allRows.push(...filtered);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    },
  });

  const { data: mixedWasteData, isLoading: loadingMixed } = useQuery({
    queryKey: ["waste-kpi-mixed-waste", startDate, endDateStr],
    queryFn: async () => {
      const allRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let query = supabase
          .from("data_hub_jobs")
          .select("job_date, movement_type, weight_t, waste_description")
          .eq("source", "midweigh")
          .eq("movement_type", "INWARD")
          .in("waste_description", MIXED_WASTE_DESCRIPTIONS)
          .gte("job_date", startDate);
        if (endDateStr) query = query.lte("job_date", endDateStr);
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    },
  });

  const chartData = useMemo(() => {
    if (!woodData || !mixedWasteData) return [];

    const buckets: Record<string, MonthData> = {};
    const rangeStart = externalStartDate || subMonths(new Date(), 11);
    const rangeEnd = externalEndDate || new Date();
    bucketDates(rangeStart, rangeEnd, granularity).forEach((d) => {
      const key = bucketKey(d, granularity);
      buckets[key] = {
        month: key,
        label: bucketLabel(bucketStart(d, granularity), granularity),
        woodAInward: 0, woodAOutward: 0,
        woodCInward: 0, woodCOutward: 0,
        mixedWasteInward: 0,
        extractedA: 0, extractedC: 0,
      };
    });

    const keyFor = (jobDate: string) => bucketKey(parseISO(jobDate.substring(0, 10)), granularity);

    // Process wood data (midweigh = KG, convert to tonnes)
    woodData.forEach((row: any) => {
      if (!row.job_date) return;
      const key = keyFor(row.job_date);
      if (!buckets[key]) return;
      const product = (row.raw as any)?.Product;
      const tonnes = (row.weight_t || 0) / 1000;
      const isA = WOOD_A_PRODUCTS.includes(product);
      if (row.movement_type === "INWARD") {
        if (isA) buckets[key].woodAInward += tonnes;
        else buckets[key].woodCInward += tonnes;
      } else if (row.movement_type === "OUTWARD") {
        if (isA) buckets[key].woodAOutward += tonnes;
        else buckets[key].woodCOutward += tonnes;
      }
    });

    // Process mixed waste inward
    mixedWasteData.forEach((row: any) => {
      if (!row.job_date) return;
      const key = keyFor(row.job_date);
      if (!buckets[key]) return;
      buckets[key].mixedWasteInward += (row.weight_t || 0) / 1000;
    });

    // Extracted = outward - direct inward
    Object.values(buckets).forEach((m) => {
      m.extractedA = Math.max(0, m.woodAOutward - m.woodAInward);
      m.extractedC = Math.max(0, m.woodCOutward - m.woodCInward);
      // Round all
      m.woodAInward = Math.round(m.woodAInward * 100) / 100;
      m.woodAOutward = Math.round(m.woodAOutward * 100) / 100;
      m.woodCInward = Math.round(m.woodCInward * 100) / 100;
      m.woodCOutward = Math.round(m.woodCOutward * 100) / 100;
      m.mixedWasteInward = Math.round(m.mixedWasteInward * 100) / 100;
      m.extractedA = Math.round(m.extractedA * 100) / 100;
      m.extractedC = Math.round(m.extractedC * 100) / 100;
    });

    return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
  }, [woodData, mixedWasteData, granularity, externalStartDate, externalEndDate]);


  const totals = useMemo(() => {
    if (!chartData.length) return { aIn: 0, aOut: 0, cIn: 0, cOut: 0, extA: 0, extC: 0, mixed: 0, pctA: 0, pctC: 0 };
    const aIn = chartData.reduce((s, d) => s + d.woodAInward, 0);
    const aOut = chartData.reduce((s, d) => s + d.woodAOutward, 0);
    const cIn = chartData.reduce((s, d) => s + d.woodCInward, 0);
    const cOut = chartData.reduce((s, d) => s + d.woodCOutward, 0);
    const extA = chartData.reduce((s, d) => s + d.extractedA, 0);
    const extC = chartData.reduce((s, d) => s + d.extractedC, 0);
    const mixed = chartData.reduce((s, d) => s + d.mixedWasteInward, 0);
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      aIn: r(aIn), aOut: r(aOut), cIn: r(cIn), cOut: r(cOut),
      extA: r(extA), extC: r(extC), mixed: r(mixed),
      pctA: mixed > 0 ? r((extA / mixed) * 100) : 0,
      pctC: mixed > 0 ? r((extC / mixed) * 100) : 0,
    };
  }, [chartData]);

  const isLoading = loadingWood || loadingMixed;

  const COLOR_A = "hsl(260, 70%, 55%)";
  const COLOR_C = "hsl(200, 80%, 50%)";
  const COLOR_RATE = "hsl(142, 70%, 40%)";

  const chartConfig = {
    directIn: { label: "Wood received as wood", color: "hsl(35, 85%, 55%)" },
    extractedA: { label: "Grade A recovered from mixed", color: COLOR_A },
    extractedC: { label: "Grade C recovered from mixed", color: COLOR_C },
    recoveryRate: { label: "Recovery rate (% of mixed)", color: COLOR_RATE },
  };

  const enrichedChartData = useMemo(
    () =>
      chartData.map((m) => ({
        ...m,
        directIn: Math.round((m.woodAInward + m.woodCInward) * 100) / 100,
        recoveryRate:
          m.mixedWasteInward > 0
            ? Math.round(((m.extractedA + m.extractedC) / m.mixedWasteInward) * 1000) / 10
            : 0,
      })),
    [chartData]
  );

  const totalRecovery = totals.extA + totals.extC;
  const totalRate = totals.mixed > 0 ? (totalRecovery / totals.mixed) * 100 : 0;
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
            <TreePine className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Wood Recovery</CardTitle>
            <CardDescription>
              How much wood we pull back out of mixed waste, on top of the wood that arrives already segregated
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Headline */}
            <div className="rounded-lg border bg-muted/30 p-4 flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Wood recovered from mixed waste</p>
                <p className="text-3xl font-bold text-foreground">{fmt(totalRecovery)}t</p>
              </div>
              <div className="text-muted-foreground text-2xl leading-none hidden sm:block">/</div>
              <div>
                <p className="text-xs text-muted-foreground">Mixed waste received</p>
                <p className="text-3xl font-bold text-foreground">{fmt(totals.mixed)}t</p>
              </div>
              <div className="text-muted-foreground text-2xl leading-none hidden sm:block">=</div>
              <div>
                <p className="text-xs text-muted-foreground">Recovery rate</p>
                <p className="text-3xl font-bold" style={{ color: COLOR_RATE }}>{totalRate.toFixed(1)}%</p>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm ml-auto">
                Recovery = wood sent out minus wood that arrived already graded. Anything extra must have been
                picked out of the mixed waste stream.
              </p>
            </div>

            {/* Grade breakdown */}
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { grade: "A", color: COLOR_A, inT: totals.aIn, outT: totals.aOut, rec: totals.extA, pct: totals.pctA },
                { grade: "C", color: COLOR_C, inT: totals.cIn, outT: totals.cOut, rec: totals.extC, pct: totals.pctC },
              ].map((g) => (
                <div key={g.grade} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm" style={{ background: g.color }} />
                      <span className="font-semibold text-foreground">Grade {g.grade} wood</span>
                    </div>
                    <Badge variant="outline">{g.pct.toFixed(1)}% of mixed</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Arrived as wood</p>
                      <p className="text-lg font-semibold text-foreground">{fmt(g.inT)}t</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Sent out</p>
                      <p className="text-lg font-semibold text-foreground">{fmt(g.outT)}t</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Recovered</p>
                      <p className="text-lg font-semibold" style={{ color: g.color }}>{fmt(g.rec)}t</p>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                    <div
                      className="h-full"
                      style={{
                        background: g.color,
                        opacity: 0.35,
                        width: `${g.outT > 0 ? Math.min(100, (g.inT / g.outT) * 100) : 0}%`,
                      }}
                    />
                    <div
                      className="h-full"
                      style={{
                        background: g.color,
                        width: `${g.outT > 0 ? Math.min(100, (g.rec / g.outT) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Faded = arrived already graded · Solid = recovered from mixed waste
                  </p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Monthly wood out, by where it came from</p>
              <ChartContainer config={chartConfig} className="h-[340px] w-full">
                <ComposedChart data={enrichedChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    yAxisId="t"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    label={{ value: "Tonnes", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    unit="%"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar yAxisId="t" dataKey="directIn" name="Arrived as wood" fill="hsl(35, 85%, 55%)" stackId="w" radius={[0, 0, 0, 0]} />
                  <Bar yAxisId="t" dataKey="extractedA" name="Grade A recovered" fill={COLOR_A} stackId="w" />
                  <Bar yAxisId="t" dataKey="extractedC" name="Grade C recovered" fill={COLOR_C} stackId="w" radius={[2, 2, 0, 0]} />
                  <Line
                    yAxisId="pct"
                    dataKey="recoveryRate"
                    name="Recovery rate %"
                    stroke={COLOR_RATE}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    type="monotone"
                  />
                </ComposedChart>
              </ChartContainer>
            </div>

            {/* Data table */}
            <details className="rounded-lg border">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground">
                Monthly detail
              </summary>
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Mixed waste in</TableHead>
                      <TableHead className="text-right">A arrived</TableHead>
                      <TableHead className="text-right">A out</TableHead>
                      <TableHead className="text-right">A recovered</TableHead>
                      <TableHead className="text-right">C arrived</TableHead>
                      <TableHead className="text-right">C out</TableHead>
                      <TableHead className="text-right">C recovered</TableHead>
                      <TableHead className="text-right">Recovery rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.map((row) => {
                      const totalExt = row.extractedA + row.extractedC;
                      const pct = row.mixedWasteInward > 0 ? ((totalExt / row.mixedWasteInward) * 100).toFixed(1) : "0.0";
                      return (
                        <TableRow key={row.month}>
                          <TableCell className="font-medium">{row.label}</TableCell>
                          <TableCell className="text-right">{fmt(row.mixedWasteInward)}</TableCell>
                          <TableCell className="text-right">{fmt(row.woodAInward)}</TableCell>
                          <TableCell className="text-right">{fmt(row.woodAOutward)}</TableCell>
                          <TableCell className="text-right font-medium" style={{ color: COLOR_A }}>{fmt(row.extractedA)}</TableCell>
                          <TableCell className="text-right">{fmt(row.woodCInward)}</TableCell>
                          <TableCell className="text-right">{fmt(row.woodCOutward)}</TableCell>
                          <TableCell className="text-right font-medium" style={{ color: COLOR_C }}>{fmt(row.extractedC)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{pct}%</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{fmt(totals.mixed)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.aIn)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.aOut)}</TableCell>
                      <TableCell className="text-right" style={{ color: COLOR_A }}>{fmt(totals.extA)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.cIn)}</TableCell>
                      <TableCell className="text-right">{fmt(totals.cOut)}</TableCell>
                      <TableCell className="text-right" style={{ color: COLOR_C }}>{fmt(totals.extC)}</TableCell>
                      <TableCell className="text-right">
                        <Badge>{totalRate.toFixed(1)}%</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WasteKPIGradeCWood;
