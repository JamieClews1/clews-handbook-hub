import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from "recharts";
import { MapPin, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  format, parseISO, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval,
} from "date-fns";

type Granularity = "weekly" | "monthly" | "quarterly";

interface WasteOnsiteOffsiteProps {
  externalStartDate: Date;
  externalEndDate: Date;
}

const GRANULARITY_OPTIONS: { label: string; value: Granularity }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
];

const ONSITE_KEYWORDS = ["clews recycling", "clews recycling ltd"];

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

const WasteOnsiteOffsite = ({ externalStartDate, externalEndDate }: WasteOnsiteOffsiteProps) => {
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [showTable, setShowTable] = useState(false);

  const weekStart = startOfWeek(externalStartDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(externalEndDate, { weekStartsOn: 1 });
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  const { data: skiptrakJobs, isLoading } = useQuery({
    queryKey: ["waste-onsite-offsite", startStr, endStr],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, weight_t, tipping_location")
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

  const chartData = useMemo(() => {
    if (!skiptrakJobs) return [];

    const keys = generateBucketKeys(externalStartDate, externalEndDate, granularity);
    const buckets: Record<string, { onsite: number; offsite: number }> = {};
    keys.forEach((k) => { buckets[k] = { onsite: 0, offsite: 0 }; });

    skiptrakJobs.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      const key = getBucketKey(parseISO(job.job_date), granularity);
      if (!buckets[key]) return;
      if (isOnsite(job.tipping_location)) {
        buckets[key].onsite += job.weight_t || 0;
      } else {
        buckets[key].offsite += job.weight_t || 0;
      }
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketKey, values]) => ({
        period: getBucketLabel(bucketKey, granularity),
        bucketKey,
        onsite: Math.round(values.onsite * 100) / 100,
        offsite: Math.round(values.offsite * 100) / 100,
        total: Math.round((values.onsite + values.offsite) * 100) / 100,
      }));
  }, [skiptrakJobs, externalStartDate, externalEndDate, granularity]);

  const totals = useMemo(() => {
    if (!chartData.length) return { onsite: 0, offsite: 0, total: 0 };
    return {
      onsite: chartData.reduce((s, r) => s + r.onsite, 0),
      offsite: chartData.reduce((s, r) => s + r.offsite, 0),
      total: chartData.reduce((s, r) => s + r.total, 0),
    };
  }, [chartData]);

  const chartConfig = {
    onsite: { label: "Tipped On-Site (Clews)", color: "hsl(142, 70%, 45%)" },
    offsite: { label: "Tipped Off-Site", color: "hsl(35, 85%, 55%)" },
    total: { label: "Total", color: "hsl(210, 70%, 50%)" },
  };

  const periodLabel = granularity === "weekly" ? "Week" : granularity === "monthly" ? "Month" : "Quarter";

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
              <div className="text-muted-foreground">On-Site</div>
              <div className="font-semibold" style={{ color: chartConfig.onsite.color }}>
                {totals.onsite.toFixed(2)}t
              </div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Off-Site</div>
              <div className="font-semibold" style={{ color: chartConfig.offsite.color }}>
                {totals.offsite.toFixed(2)}t
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
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} interval={granularity === "weekly" ? 3 : 0} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "Tonnes", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="onsite" stackId="waste" fill={chartConfig.onsite.color} name="On-Site (Clews)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="offsite" stackId="waste" fill={chartConfig.offsite.color} name="Off-Site" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="total" stroke={chartConfig.total.color} strokeWidth={2} dot={false} name="Total" />
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
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.onsite.color }}>On-Site</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.offsite.color }}>Off-Site</th>
                  <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.total.color }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.bucketKey} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-1.5 px-3 text-muted-foreground">{row.period}</td>
                    <td className="py-1.5 px-3 text-right">{row.onsite.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right">{row.offsite.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right font-medium">{row.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3">Total</td>
                  <td className="py-2 px-3 text-right">{totals.onsite.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right">{totals.offsite.toFixed(2)}</td>
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

export default WasteOnsiteOffsite;
