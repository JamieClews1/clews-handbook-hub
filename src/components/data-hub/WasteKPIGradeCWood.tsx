import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TreePine } from "lucide-react";
import { format, subMonths, startOfMonth, parseISO, eachMonthOfInterval } from "date-fns";

const WOOD_C_PRODUCTS = ["WOOD-C", "WOOD-C OUT"];
const MIXED_WASTE_DESCRIPTIONS = [
  "Mixed Municipal Waste",
  "mixed construction and demolition wastes other than those mentioned in 17 09 01 17 09 02 and 17 09 03",
  "mixed construction and demolition wastes other than those mentioned in 17 09 01 17 09 02 and 17 09 0",
];

interface MonthData {
  month: string;
  label: string;
  woodCInward: number;
  woodCOutward: number;
  mixedWasteInward: number;
  extractedFromMixed: number;
}

interface WasteKPIGradeCWoodProps {
  externalStartDate?: Date;
  externalEndDate?: Date;
}

const WasteKPIGradeCWood = ({ externalStartDate, externalEndDate }: WasteKPIGradeCWoodProps = {}) => {
  const defaultStart = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
  const startDate = externalStartDate ? format(externalStartDate, "yyyy-MM-dd") : defaultStart;
  const endDateStr = externalEndDate ? format(externalEndDate, "yyyy-MM-dd") : undefined;

  const { data: woodCData, isLoading: loadingWood } = useQuery({
    queryKey: ["waste-kpi-wood-c", startDate, endDateStr],
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
          return WOOD_C_PRODUCTS.includes(product);
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
    if (!woodCData || !mixedWasteData) return [];

    const months: Record<string, MonthData> = {};

    // Initialize months from date range
    const rangeStart = externalStartDate || subMonths(new Date(), 11);
    const rangeEnd = externalEndDate || new Date();
    const monthDates = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
    monthDates.forEach((d) => {
      const key = format(d, "yyyy-MM");
      months[key] = {
        month: key,
        label: format(d, "MMM yy"),
        woodCInward: 0,
        woodCOutward: 0,
        mixedWasteInward: 0,
        extractedFromMixed: 0,
      };
    });

    // Process WOOD-C data (midweigh = KG, convert to tonnes)
    woodCData.forEach((row: any) => {
      if (!row.job_date) return;
      const key = row.job_date.substring(0, 7);
      if (!months[key]) return;
      const tonnes = (row.weight_t || 0) / 1000;
      if (row.movement_type === "INWARD") {
        months[key].woodCInward += tonnes;
      } else if (row.movement_type === "OUTWARD") {
        months[key].woodCOutward += tonnes;
      }
    });

    // Process mixed waste inward (midweigh = KG, convert to tonnes)
    mixedWasteData.forEach((row: any) => {
      if (!row.job_date) return;
      const key = row.job_date.substring(0, 7);
      if (!months[key]) return;
      months[key].mixedWasteInward += (row.weight_t || 0) / 1000;
    });

    // Extracted = outward - direct inward (the rest came from mixed streams)
    Object.values(months).forEach((m) => {
      m.extractedFromMixed = Math.max(0, m.woodCOutward - m.woodCInward);
      // Round all values
      m.woodCInward = Math.round(m.woodCInward * 100) / 100;
      m.woodCOutward = Math.round(m.woodCOutward * 100) / 100;
      m.mixedWasteInward = Math.round(m.mixedWasteInward * 100) / 100;
      m.extractedFromMixed = Math.round(m.extractedFromMixed * 100) / 100;
    });

    return Object.values(months);
  }, [woodCData, mixedWasteData]);

  const totals = useMemo(() => {
    if (!chartData.length) return { inward: 0, outward: 0, extracted: 0, mixed: 0, pct: 0 };
    const inward = chartData.reduce((s, d) => s + d.woodCInward, 0);
    const outward = chartData.reduce((s, d) => s + d.woodCOutward, 0);
    const extracted = chartData.reduce((s, d) => s + d.extractedFromMixed, 0);
    const mixed = chartData.reduce((s, d) => s + d.mixedWasteInward, 0);
    const pct = mixed > 0 ? (extracted / mixed) * 100 : 0;
    return {
      inward: Math.round(inward * 100) / 100,
      outward: Math.round(outward * 100) / 100,
      extracted: Math.round(extracted * 100) / 100,
      mixed: Math.round(mixed * 100) / 100,
      pct: Math.round(pct * 100) / 100,
    };
  }, [chartData]);

  const isLoading = loadingWood || loadingMixed;

  const chartConfig = {
    woodCInward: { label: "Grade C Direct In", color: "hsl(35, 85%, 55%)" },
    woodCOutward: { label: "Grade C Total Out", color: "hsl(142, 70%, 45%)" },
    extractedFromMixed: { label: "Extracted from Mixed", color: "hsl(200, 80%, 50%)" },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
            <TreePine className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Grade C Wood Recovery</CardTitle>
            <CardDescription>
              Grade C wood extracted from Mixed Municipal Waste &amp; Construction &amp; Demolition streams
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
            {/* Summary badges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Direct Grade C In</p>
                <p className="text-xl font-bold text-foreground">{totals.inward.toFixed(1)}t</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Grade C Out</p>
                <p className="text-xl font-bold text-foreground">{totals.outward.toFixed(1)}t</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Extracted from Mixed</p>
                <p className="text-xl font-bold text-primary">{totals.extracted.toFixed(1)}t</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">% of Mixed Waste</p>
                <p className="text-xl font-bold text-primary">{totals.pct.toFixed(1)}%</p>
              </div>
            </div>

            {/* Chart */}
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} label={{ value: "Tonnes", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="woodCInward" name="Direct Grade C In" fill="hsl(35, 85%, 55%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="extractedFromMixed" name="Extracted from Mixed" fill="hsl(200, 80%, 50%)" radius={[2, 2, 0, 0]} />
                <Line dataKey="woodCOutward" name="Total Grade C Out" stroke="hsl(142, 70%, 45%)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ChartContainer>

            {/* Data table */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Mixed Waste In (t)</TableHead>
                    <TableHead className="text-right">Grade C Direct In (t)</TableHead>
                    <TableHead className="text-right">Grade C Total Out (t)</TableHead>
                    <TableHead className="text-right">Extracted from Mixed (t)</TableHead>
                    <TableHead className="text-right">% of Mixed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((row) => {
                    const pct = row.mixedWasteInward > 0
                      ? ((row.extractedFromMixed / row.mixedWasteInward) * 100).toFixed(1)
                      : "0.0";
                    return (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right">{row.mixedWasteInward.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.woodCInward.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.woodCOutward.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{row.extractedFromMixed.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{pct}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totals.mixed.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totals.inward.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totals.outward.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-primary">{totals.extracted.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Badge>{totals.pct.toFixed(1)}%</Badge>
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
