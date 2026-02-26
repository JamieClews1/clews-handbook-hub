import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, Legend, Line, ComposedChart } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TreePine } from "lucide-react";
import { format, subMonths, startOfMonth, eachMonthOfInterval } from "date-fns";

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

    const months: Record<string, MonthData> = {};
    const rangeStart = externalStartDate || subMonths(new Date(), 11);
    const rangeEnd = externalEndDate || new Date();
    const monthDates = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
    monthDates.forEach((d) => {
      const key = format(d, "yyyy-MM");
      months[key] = {
        month: key,
        label: format(d, "MMM yy"),
        woodAInward: 0, woodAOutward: 0,
        woodCInward: 0, woodCOutward: 0,
        mixedWasteInward: 0,
        extractedA: 0, extractedC: 0,
      };
    });

    // Process wood data (midweigh = KG, convert to tonnes)
    woodData.forEach((row: any) => {
      if (!row.job_date) return;
      const key = row.job_date.substring(0, 7);
      if (!months[key]) return;
      const product = (row.raw as any)?.Product;
      const tonnes = (row.weight_t || 0) / 1000;
      const isA = WOOD_A_PRODUCTS.includes(product);
      if (row.movement_type === "INWARD") {
        if (isA) months[key].woodAInward += tonnes;
        else months[key].woodCInward += tonnes;
      } else if (row.movement_type === "OUTWARD") {
        if (isA) months[key].woodAOutward += tonnes;
        else months[key].woodCOutward += tonnes;
      }
    });

    // Process mixed waste inward
    mixedWasteData.forEach((row: any) => {
      if (!row.job_date) return;
      const key = row.job_date.substring(0, 7);
      if (!months[key]) return;
      months[key].mixedWasteInward += (row.weight_t || 0) / 1000;
    });

    // Extracted = outward - direct inward
    Object.values(months).forEach((m) => {
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

    return Object.values(months);
  }, [woodData, mixedWasteData]);

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

  const chartConfig = {
    woodAInward: { label: "Grade A In", color: "hsl(260, 70%, 55%)" },
    woodAOutward: { label: "Grade A Out", color: "hsl(280, 65%, 50%)" },
    woodCInward: { label: "Grade C In", color: "hsl(35, 85%, 55%)" },
    woodCOutward: { label: "Grade C Out", color: "hsl(142, 70%, 45%)" },
    extractedA: { label: "Grade A Recovery", color: "hsl(260, 80%, 65%)" },
    extractedC: { label: "Grade C Recovery", color: "hsl(200, 80%, 50%)" },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
            <TreePine className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Wood Recovery — Grade A &amp; Grade C</CardTitle>
            <CardDescription>
              Direct inward vs outward, with likely recovery extracted from mixed waste streams
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
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Grade A — Direct In</p>
                <p className="text-xl font-bold text-foreground">{totals.aIn.toFixed(1)}t</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Grade A — Total Out</p>
                <p className="text-xl font-bold text-foreground">{totals.aOut.toFixed(1)}t</p>
              </div>
              <div className="rounded-lg border p-3 text-center bg-purple-50 dark:bg-purple-950/20">
                <p className="text-xs text-muted-foreground">Grade A — Recovery</p>
                <p className="text-xl font-bold" style={{ color: "hsl(260, 70%, 55%)" }}>{totals.extA.toFixed(1)}t</p>
                <p className="text-xs text-muted-foreground">{totals.pctA.toFixed(1)}% of mixed</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Mixed Waste In</p>
                <p className="text-xl font-bold text-foreground">{totals.mixed.toFixed(1)}t</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Grade C — Direct In</p>
                <p className="text-xl font-bold text-foreground">{totals.cIn.toFixed(1)}t</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Grade C — Total Out</p>
                <p className="text-xl font-bold text-foreground">{totals.cOut.toFixed(1)}t</p>
              </div>
              <div className="rounded-lg border p-3 text-center bg-blue-50 dark:bg-blue-950/20">
                <p className="text-xs text-muted-foreground">Grade C — Recovery</p>
                <p className="text-xl font-bold text-primary">{totals.extC.toFixed(1)}t</p>
                <p className="text-xs text-muted-foreground">{totals.pctC.toFixed(1)}% of mixed</p>
              </div>
              <div className="rounded-lg border p-3 text-center bg-muted/30">
                <p className="text-xs text-muted-foreground">Total Wood Recovery</p>
                <p className="text-xl font-bold text-foreground">{(totals.extA + totals.extC).toFixed(1)}t</p>
                <p className="text-xs text-muted-foreground">{totals.mixed > 0 ? (((totals.extA + totals.extC) / totals.mixed) * 100).toFixed(1) : "0.0"}% of mixed</p>
              </div>
            </div>

            {/* Chart */}
            <ChartContainer config={chartConfig} className="h-[380px] w-full">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} label={{ value: "Tonnes", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="woodAInward" name="Grade A In" fill="hsl(260, 70%, 55%)" radius={[2, 2, 0, 0]} stackId="in" />
                <Bar dataKey="woodCInward" name="Grade C In" fill="hsl(35, 85%, 55%)" radius={[2, 2, 0, 0]} stackId="in" />
                <Bar dataKey="extractedA" name="Grade A Recovery" fill="hsl(260, 80%, 65%)" radius={[2, 2, 0, 0]} stackId="recovery" />
                <Bar dataKey="extractedC" name="Grade C Recovery" fill="hsl(200, 80%, 50%)" radius={[2, 2, 0, 0]} stackId="recovery" />
                <Line dataKey="woodAOutward" name="Grade A Out" stroke="hsl(280, 65%, 50%)" strokeWidth={2} dot={{ r: 3 }} type="monotone" strokeDasharray="5 5" />
                <Line dataKey="woodCOutward" name="Grade C Out" stroke="hsl(142, 70%, 45%)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ChartContainer>

            {/* Data table */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Mixed In (t)</TableHead>
                    <TableHead className="text-right">A In (t)</TableHead>
                    <TableHead className="text-right">A Out (t)</TableHead>
                    <TableHead className="text-right text-purple-600 dark:text-purple-400">A Recovery (t)</TableHead>
                    <TableHead className="text-right">C In (t)</TableHead>
                    <TableHead className="text-right">C Out (t)</TableHead>
                    <TableHead className="text-right text-primary">C Recovery (t)</TableHead>
                    <TableHead className="text-right">% Mixed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row) => {
                    const totalExt = row.extractedA + row.extractedC;
                    const pct = row.mixedWasteInward > 0 ? ((totalExt / row.mixedWasteInward) * 100).toFixed(1) : "0.0";
                    return (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right">{row.mixedWasteInward.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.woodAInward.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.woodAOutward.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium text-purple-600 dark:text-purple-400">{row.extractedA.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.woodCInward.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.woodCOutward.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{row.extractedC.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{pct}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totals.mixed.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totals.aIn.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totals.aOut.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-purple-600 dark:text-purple-400">{totals.extA.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totals.cIn.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totals.cOut.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-primary">{totals.extC.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Badge>{totals.mixed > 0 ? (((totals.extA + totals.extC) / totals.mixed) * 100).toFixed(1) : "0.0"}%</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WasteKPIGradeCWood;
