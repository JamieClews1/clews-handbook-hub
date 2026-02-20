import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart } from "recharts";
import { Truck } from "lucide-react";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  format, parseISO, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval,
} from "date-fns";

type Granularity = "weekly" | "monthly" | "quarterly";

interface TotalWasteHandledProps {
  externalStartDate: Date;
  externalEndDate: Date;
}

const GRANULARITY_OPTIONS: { label: string; value: Granularity }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
];

function getBucketKey(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case "weekly":
      return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "monthly":
      return format(startOfMonth(date), "yyyy-MM");
    case "quarterly":
      return format(startOfQuarter(date), "yyyy-'Q'Q");
  }
}

function getBucketLabel(key: string, granularity: Granularity): string {
  switch (granularity) {
    case "weekly":
      return format(parseISO(key), "dd MMM");
    case "monthly":
      return format(parseISO(key + "-01"), "MMM yyyy");
    case "quarterly":
      return key;
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

const TotalWasteHandled = ({ externalStartDate, externalEndDate }: TotalWasteHandledProps) => {
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [excludeBP, setExcludeBP] = useState(false);

  const weekStart = startOfWeek(externalStartDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(externalEndDate, { weekStartsOn: 1 });
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  // Fetch all Midweigh INWARD jobs
  // Fetch Midweigh jobs with job_type WASTEIN or SKIP (yard intake)
  const { data: midweighYardIntake, isLoading: loadingMidweigh } = useQuery({
    queryKey: ["twh-midweigh-yard", startStr, endStr],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, weight_t, job_number, site, vehicle_registration, job_type")
          .eq("source", "midweigh")
          .in("job_type", ["WASTEIN", "SKIP"])
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

  // Build a Set of Midweigh SKIP "vehReg|date" keys for matching Skiptrak jobs
  const midweighSkipKeys = useMemo(() => {
    if (!midweighYardIntake) return new Set<string>();
    const keys = new Set<string>();
    midweighYardIntake.forEach((j: any) => {
      if (j.job_type === "SKIP" && j.vehicle_registration && j.job_date) {
        keys.add(`${j.vehicle_registration.replace(/\s/g, "").toUpperCase()}|${j.job_date}`);
      }
    });
    return keys;
  }, [midweighYardIntake]);

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
          .select("job_date, weight_t, job_number, site, vehicle_registration")
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

  const isLoading = loadingMidweigh || loadingSkiptrak;

  const chartData = useMemo(() => {
    if (!midweighYardIntake || !skiptrakJobs) return [];

    const keys = generateBucketKeys(externalStartDate, externalEndDate, granularity);
    const buckets: Record<string, { midweighIn: number; skiptrakNonYard: number }> = {};
    keys.forEach((k) => { buckets[k] = { midweighIn: 0, skiptrakNonYard: 0 }; });

    midweighYardIntake.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      if (excludeBP && job.site === "BP Contract") return;
      const key = getBucketKey(parseISO(job.job_date), granularity);
      if (!buckets[key]) return;
      buckets[key].midweighIn += (job.weight_t || 0) / 1000;
    });

    skiptrakJobs.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      if (job.vehicle_registration && job.job_date) {
        const matchKey = `${job.vehicle_registration.replace(/\s/g, "").toUpperCase()}|${job.job_date}`;
        if (midweighSkipKeys.has(matchKey)) return; // already counted in Midweigh yard intake
      }
      if (excludeBP && job.site === "BP Contract") return;
      const key = getBucketKey(parseISO(job.job_date), granularity);
      if (!buckets[key]) return;
      buckets[key].skiptrakNonYard += (job.weight_t || 0);
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketKey, values]) => ({
        period: getBucketLabel(bucketKey, granularity),
        bucketKey,
        midweighIn: Math.round(values.midweighIn * 100) / 100,
        skiptrakNonYard: Math.round(values.skiptrakNonYard * 100) / 100,
        total: Math.round((values.midweighIn + values.skiptrakNonYard) * 100) / 100,
      }));
  }, [midweighYardIntake, skiptrakJobs, midweighSkipKeys, externalStartDate, externalEndDate, granularity, excludeBP]);

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

  const periodLabel = granularity === "weekly" ? "Week" : granularity === "monthly" ? "Month" : "Quarter";

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
              Yard intake + non-yard skip collections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="exclude-bp" checked={excludeBP} onCheckedChange={setExcludeBP} />
            <Label htmlFor="exclude-bp" className="text-xs cursor-pointer">Excl. Biffa BP</Label>
          </div>
          <div className="flex gap-1 rounded-lg border bg-muted p-0.5">
            {GRANULARITY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={granularity === opt.value ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 px-3"
                onClick={() => setGranularity(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm">
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
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: granularity === "weekly" ? "900px" : "600px" }}>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 10 }}
                    interval={granularity === "weekly" ? 3 : 0}
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

        {!isLoading && chartData.length > 0 && (
          <div className="mt-6 w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{periodLabel}</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.midweighIn.color }}>Yard Intake</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.skiptrakNonYard.color }}>Non-Yard Skip</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.total.color }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.bucketKey} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-1.5 px-3 text-muted-foreground">{row.period}</td>
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
