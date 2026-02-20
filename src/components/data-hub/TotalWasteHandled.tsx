import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart } from "recharts";
import { Truck } from "lucide-react";
import { startOfWeek, endOfWeek, format, parseISO, eachWeekOfInterval } from "date-fns";

interface TotalWasteHandledProps {
  externalStartDate: Date;
  externalEndDate: Date;
}

const TotalWasteHandled = ({ externalStartDate, externalEndDate }: TotalWasteHandledProps) => {
  const weekStart = startOfWeek(externalStartDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(externalEndDate, { weekStartsOn: 1 });
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  // Fetch all Midweigh INWARD jobs
  const { data: midweighInward, isLoading: loadingMidweigh } = useQuery({
    queryKey: ["twh-midweigh-inward", startStr, endStr],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, weight_t, job_number, raw")
          .eq("source", "midweigh")
          .eq("movement_type", "INWARD")
          .gte("job_date", startStr)
          .lte("job_date", endStr)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data) all = all.concat(data);
        hasMore = data?.length === pageSize;
        from += pageSize;
      }
      return all;
    },
  });

  // Fetch Midweigh inward records to identify SKIP product job numbers
  const { data: midweighSkipRecords, isLoading: loadingMidweighSkip } = useQuery({
    queryKey: ["twh-midweigh-skip-records", startStr, endStr],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_number, raw")
          .eq("source", "midweigh")
          .eq("movement_type", "INWARD")
          .gte("job_date", startStr)
          .lte("job_date", endStr)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data) all = all.concat(data);
        hasMore = data?.length === pageSize;
        from += pageSize;
      }
      // Extract job numbers where Product is SKIP
      const skipNums = new Set<string>();
      all.forEach((j: any) => {
        if (j.raw?.Product === "SKIP") {
          skipNums.add(j.job_number);
        }
      });
      return skipNums;
    },
  });

  // Fetch all Skiptrak jobs in the date range
  const { data: skiptrakJobs, isLoading: loadingSkiptrak } = useQuery({
    queryKey: ["twh-skiptrak-all", startStr, endStr],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, weight_t, job_number")
          .eq("source", "skiptrak")
          .gte("job_date", startStr)
          .lte("job_date", endStr)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data) all = all.concat(data);
        hasMore = data?.length === pageSize;
        from += pageSize;
      }
      return all;
    },
  });

  const isLoading = loadingMidweigh || loadingMidweighSkip || loadingSkiptrak;

  const chartData = useMemo(() => {
    if (!midweighInward || !skiptrakJobs || !midweighSkipRecords) return [];

    const weeks = eachWeekOfInterval({ start: weekStart, end: weekEnd }, { weekStartsOn: 1 });
    const buckets: Record<string, { midweighIn: number; skiptrakNonYard: number }> = {};

    weeks.forEach((ws) => {
      buckets[format(ws, "yyyy-MM-dd")] = { midweighIn: 0, skiptrakNonYard: 0 };
    });

    // Sum Midweigh inward (weight_t is in KG for midweigh)
    midweighInward.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      const ws = startOfWeek(parseISO(job.job_date), { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      if (!buckets[key]) return;
      buckets[key].midweighIn += (job.weight_t || 0) / 1000; // KG to Tonnes
    });

    // Sum Skiptrak jobs that did NOT come into the yard
    // (i.e. their job_number is NOT in midweighSkipRecords set)
    skiptrakJobs.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      // If this job_number exists as a SKIP in Midweigh, it came into the yard - skip it
      if (midweighSkipRecords.has(job.job_number)) return;
      const ws = startOfWeek(parseISO(job.job_date), { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      if (!buckets[key]) return;
      buckets[key].skiptrakNonYard += (job.weight_t || 0); // Skiptrak is already in Tonnes
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekDate, values]) => ({
        week: format(parseISO(weekDate), "dd MMM"),
        weekFull: weekDate,
        midweighIn: Math.round(values.midweighIn * 100) / 100,
        skiptrakNonYard: Math.round(values.skiptrakNonYard * 100) / 100,
        total: Math.round((values.midweighIn + values.skiptrakNonYard) * 100) / 100,
      }));
  }, [midweighInward, skiptrakJobs, midweighSkipRecords, weekStart, weekEnd]);

  const totals = useMemo(() => {
    if (!chartData.length) return { midweighIn: 0, skiptrakNonYard: 0, total: 0 };
    return {
      midweighIn: chartData.reduce((s, r) => s + r.midweighIn, 0),
      skiptrakNonYard: chartData.reduce((s, r) => s + r.skiptrakNonYard, 0),
      total: chartData.reduce((s, r) => s + r.total, 0),
    };
  }, [chartData]);

  const chartConfig = {
    midweighIn: { label: "Yard Intake (Midweigh)", color: "hsl(210, 70%, 50%)" },
    skiptrakNonYard: { label: "Skip (Non-Yard)", color: "hsl(35, 85%, 55%)" },
    total: { label: "Total Handled", color: "hsl(142, 70%, 45%)" },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Total Waste Handled</CardTitle>
            <p className="text-sm text-muted-foreground">
              Yard intake + non-yard skip collections · Weekly
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <div className="text-muted-foreground">Yard Intake</div>
            <div className="font-semibold" style={{ color: chartConfig.midweighIn.color }}>
              {totals.midweighIn.toFixed(2)}t
            </div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">Non-Yard Skip</div>
            <div className="font-semibold" style={{ color: chartConfig.skiptrakNonYard.color }}>
              {totals.skiptrakNonYard.toFixed(2)}t
            </div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">Total</div>
            <div className="font-bold" style={{ color: chartConfig.total.color }}>
              {totals.total.toFixed(2)}t
            </div>
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
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10 }}
                    interval={3}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    label={{ value: "Tonnes", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="midweighIn"
                    stackId="waste"
                    fill={chartConfig.midweighIn.color}
                    name="Yard Intake (Midweigh)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="skiptrakNonYard"
                    stackId="waste"
                    fill={chartConfig.skiptrakNonYard.color}
                    name="Skip (Non-Yard)"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={chartConfig.total.color}
                    strokeWidth={2}
                    dot={false}
                    name="Total Handled"
                  />
                </ComposedChart>
              </ChartContainer>
            </div>
          </div>
        )}

        {/* Tonnage Table */}
        {!isLoading && chartData.length > 0 && (
          <div className="mt-6 w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Week</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.midweighIn.color }}>Yard Intake</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.skiptrakNonYard.color }}>Non-Yard Skip</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.total.color }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.weekFull} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-1.5 px-3 text-muted-foreground">{row.week}</td>
                    <td className="py-1.5 px-3 text-right">{row.midweighIn.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right">{row.skiptrakNonYard.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-medium">{row.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3">Total</td>
                  <td className="py-2 px-3 text-right">{totals.midweighIn.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right">{totals.skiptrakNonYard.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right">{totals.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TotalWasteHandled;
