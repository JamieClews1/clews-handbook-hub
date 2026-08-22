import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart, Legend } from "recharts";
import { Truck, Info, X, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  format, parseISO, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval,
  getMonth,
} from "date-fns";

type Granularity = "weekly" | "monthly" | "quarterly";

export interface ComparisonRange {
  year: number;
  start: Date;
  end: Date;
}

interface TotalWasteHandledProps {
  externalStartDate: Date;
  externalEndDate: Date;
  comparisonRanges?: ComparisonRange[];
}

const GRANULARITY_OPTIONS: { label: string; value: Granularity }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function computeTotals(midweighJobs: any[], skiptrakJobs: any[], excludeBP: boolean) {
  const monthBuckets: Record<number, number> = {};

  midweighJobs.forEach((job: any) => {
    if (!job.job_date || job.weight_t == null) return;
    if (excludeBP && job.site === "BP Contract") return;
    const m = getMonth(parseISO(job.job_date));
    monthBuckets[m] = (monthBuckets[m] || 0) + (job.weight_t || 0) / 1000;
  });

  skiptrakJobs.forEach((job: any) => {
    if (!job.job_date || job.weight_t == null) return;
    const tipping = (job.tipping_location || "").trim();
    if (!tipping || tipping.toLowerCase().startsWith("clews recycling")) return;
    if (excludeBP && job.site === "BP Contract") return;
    const m = getMonth(parseISO(job.job_date));
    monthBuckets[m] = (monthBuckets[m] || 0) + (job.weight_t || 0);
  });

  return monthBuckets;
}

const TotalWasteHandled = ({ externalStartDate, externalEndDate, comparisonRanges = [] }: TotalWasteHandledProps) => {
  const hasComparison = comparisonRanges.length > 0;
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const effectiveGranularity = hasComparison ? "monthly" : granularity;
  const [excludeBP, setExcludeBP] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const weekStart = startOfWeek(externalStartDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(externalEndDate, { weekStartsOn: 1 });
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(weekEnd, "yyyy-MM-dd");

  const { data: midweighYardIntake, isLoading: loadingMidweigh } = useQuery({
    queryKey: ["twh-midweigh-yard", startStr, endStr],
    queryFn: async () => fetchAllPaged(
      supabase.from("data_hub_jobs").select("id, job_date, weight_t, site, job_type")
        .eq("source", "midweigh").in("job_type", ["WASTEIN", "SKIP"])
        .gte("job_date", startStr).lte("job_date", endStr)
        .order("id", { ascending: true })
    ),
  });

  const { data: skiptrakJobs, isLoading: loadingSkiptrak } = useQuery({
    queryKey: ["twh-skiptrak-nonyard", startStr, endStr],
    queryFn: async () => fetchAllPaged(
      supabase.from("data_hub_jobs").select("id, job_date, weight_t, site, tipping_location")
        .eq("source", "skiptrak").gte("job_date", startStr).lte("job_date", endStr)
        .order("id", { ascending: true })
    ),
  });

  // Fetch comparison year data in a single query to avoid hooks-in-loop
  const compRangeKey = comparisonRanges.map(r => `${r.year}`).join(",");
  const { data: compData, isLoading: compLoading } = useQuery({
    queryKey: ["twh-comparison", compRangeKey],
    queryFn: async () => {
      const results: Record<number, { midweigh: any[]; skiptrak: any[] }> = {};
      await Promise.all(comparisonRanges.map(async (range) => {
        const cStartStr = format(range.start, "yyyy-MM-dd");
        const cEndStr = format(range.end, "yyyy-MM-dd");
        const [midweigh, skiptrak] = await Promise.all([
          fetchAllPaged(
            supabase.from("data_hub_jobs").select("job_date, weight_t, site, job_type")
              .eq("source", "midweigh").in("job_type", ["WASTEIN", "SKIP"])
              .gte("job_date", cStartStr).lte("job_date", cEndStr)
          ),
          fetchAllPaged(
            supabase.from("data_hub_jobs").select("job_date, weight_t, site, tipping_location")
              .eq("source", "skiptrak").gte("job_date", cStartStr).lte("job_date", cEndStr)
          ),
        ]);
        results[range.year] = { midweigh, skiptrak };
      }));
      return results;
    },
    enabled: comparisonRanges.length > 0,
  });

  const isLoading = loadingMidweigh || loadingSkiptrak || compLoading;

  const chartData = useMemo(() => {
    if (!midweighYardIntake || !skiptrakJobs) return [];

    if (hasComparison) {
      // Monthly with relative month labels
      const months = eachMonthOfInterval({ start: startOfMonth(externalStartDate), end: endOfMonth(externalEndDate) });
      const monthIndices = months.map(d => getMonth(d));

      const currentBuckets: Record<number, { midweighIn: number; skiptrakNonYard: number }> = {};
      monthIndices.forEach(m => { currentBuckets[m] = { midweighIn: 0, skiptrakNonYard: 0 }; });

      midweighYardIntake.forEach((job: any) => {
        if (!job.job_date || job.weight_t == null) return;
        if (excludeBP && job.site === "BP Contract") return;
        const m = getMonth(parseISO(job.job_date));
        if (currentBuckets[m] !== undefined) currentBuckets[m].midweighIn += (job.weight_t || 0) / 1000;
      });

      skiptrakJobs.forEach((job: any) => {
        if (!job.job_date || job.weight_t == null) return;
        const tipping = (job.tipping_location || "").trim();
        if (!tipping || tipping.toLowerCase().startsWith("clews recycling")) return;
        if (excludeBP && job.site === "BP Contract") return;
        const m = getMonth(parseISO(job.job_date));
        if (currentBuckets[m] !== undefined) currentBuckets[m].skiptrakNonYard += (job.weight_t || 0);
      });

      // Compute comparison year totals by month
      const compTotals: Record<number, Record<number, number>> = {};
      if (compData) {
        Object.entries(compData).forEach(([yearStr, data]) => {
          compTotals[Number(yearStr)] = computeTotals(data.midweigh, data.skiptrak, excludeBP);
        });
      }

      const currentYear = externalStartDate.getFullYear();

      return monthIndices.map(m => {
        const row: any = {
          period: MONTH_LABELS[m],
          monthIndex: m,
          midweighIn: Math.round(currentBuckets[m].midweighIn * 100) / 100,
          skiptrakNonYard: Math.round(currentBuckets[m].skiptrakNonYard * 100) / 100,
          total: Math.round((currentBuckets[m].midweighIn + currentBuckets[m].skiptrakNonYard) * 100) / 100,
        };
        comparisonRanges.forEach(range => {
          row[`total_${range.year}`] = Math.round((compTotals[range.year]?.[m] || 0) * 100) / 100;
        });
        return row;
      });
    }

    // Standard mode (no comparison)
    const keys = generateBucketKeys(externalStartDate, externalEndDate, effectiveGranularity);
    const buckets: Record<string, { midweighIn: number; skiptrakNonYard: number }> = {};
    keys.forEach((k) => { buckets[k] = { midweighIn: 0, skiptrakNonYard: 0 }; });

    midweighYardIntake.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      if (excludeBP && job.site === "BP Contract") return;
      const key = getBucketKey(parseISO(job.job_date), effectiveGranularity);
      if (!buckets[key]) return;
      buckets[key].midweighIn += (job.weight_t || 0) / 1000;
    });

    skiptrakJobs.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      const tipping = (job.tipping_location || "").trim();
      if (!tipping || tipping.toLowerCase().startsWith("clews recycling")) return;
      if (excludeBP && job.site === "BP Contract") return;
      const key = getBucketKey(parseISO(job.job_date), effectiveGranularity);
      if (!buckets[key]) return;
      buckets[key].skiptrakNonYard += (job.weight_t || 0);
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketKey, values]) => ({
        period: getBucketLabel(bucketKey, effectiveGranularity),
        bucketKey,
        midweighIn: Math.round(values.midweighIn * 100) / 100,
        skiptrakNonYard: Math.round(values.skiptrakNonYard * 100) / 100,
        total: Math.round((values.midweighIn + values.skiptrakNonYard) * 100) / 100,
      }));
  }, [midweighYardIntake, skiptrakJobs, compData, externalStartDate, externalEndDate, effectiveGranularity, excludeBP, hasComparison, comparisonRanges]);

  const totals = useMemo(() => {
    if (!chartData.length) return { midweighIn: 0, skiptrakNonYard: 0, total: 0 };
    return {
      midweighIn: chartData.reduce((s, r) => s + r.midweighIn, 0),
      skiptrakNonYard: chartData.reduce((s, r) => s + r.skiptrakNonYard, 0),
      total: chartData.reduce((s, r) => s + r.total, 0),
    };
  }, [chartData]);

  const currentYear = externalStartDate.getFullYear();

  const chartConfig: Record<string, { label: string; color: string }> = {
    midweighIn: { label: "Yard Intake (Midweigh)", color: "hsl(210, 70%, 50%)" },
    skiptrakNonYard: { label: "Skip (Non-Yard)", color: "hsl(35, 85%, 55%)" },
    total: { label: `Total ${hasComparison ? currentYear : "Handled"}`, color: "hsl(142, 70%, 45%)" },
  };
  comparisonRanges.forEach((range, i) => {
    chartConfig[`total_${range.year}`] = {
      label: `Total ${range.year}`,
      color: COMPARISON_COLORS[i % COMPARISON_COLORS.length],
    };
  });

  const periodLabel = effectiveGranularity === "weekly" ? "Week" : effectiveGranularity === "monthly" ? "Month" : "Quarter";

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
          <Button
            variant={showMethodology ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7 px-2 gap-1"
            onClick={() => setShowMethodology(!showMethodology)}
          >
            <Info className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">How it's calculated</span>
          </Button>
          <div className="flex items-center gap-2">
            <Switch id="exclude-bp" checked={excludeBP} onCheckedChange={setExcludeBP} />
            <Label htmlFor="exclude-bp" className="text-xs cursor-pointer">Excl. Biffa BP</Label>
          </div>
          {!hasComparison && (
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
          )}
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
              <div className="text-muted-foreground">Total{hasComparison ? ` ${currentYear}` : ""}</div>
              <div className="font-bold" style={{ color: chartConfig.total.color }}>
                {totals.total.toFixed(2)}t
              </div>
            </div>
            {comparisonRanges.map((range, i) => {
              const compTotal = chartData.reduce((s, r) => s + (r[`total_${range.year}`] || 0), 0);
              return (
                <div key={range.year} className="text-right">
                  <div className="text-muted-foreground">Total {range.year}</div>
                  <div className="font-semibold" style={{ color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}>
                    {compTotal.toFixed(2)}t
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardHeader>

      {showMethodology && (
        <div className="mx-6 mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4 relative">
          <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-6 w-6 p-0" onClick={() => setShowMethodology(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <h4 className="text-sm font-semibold mb-3 text-primary">How "Non-Yard Skip" is Calculated</h4>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Definition</p>
              <p>Non-Yard Skip tonnage represents waste collected by skip vehicles that was tipped at a <strong>third-party location</strong>, not at the Clews Recycling yard.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Logic</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>All Skiptrak jobs in the date range are fetched.</li>
                <li>Each job's <code className="bg-muted px-1 py-0.5 rounded text-xs">tipping_location</code> field is checked.</li>
                <li>Jobs where tipping location starts with <strong>"Clews Recycling"</strong> are <em>excluded</em>.</li>
                <li>Jobs with no tipping location are also excluded.</li>
                <li>All remaining Skiptrak jobs are counted as <strong>Non-Yard Skip</strong>.</li>
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Formula</p>
              <p className="font-mono text-xs bg-muted/60 rounded px-2 py-1.5 inline-block">
                Total Waste Handled = Yard Intake (Midweigh) + Non-Yard Skip (Skiptrak where tipping ≠ Clews Recycling)
              </p>
            </div>
          </div>
        </div>
      )}

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
                  <Bar dataKey="midweighIn" stackId="waste" fill={chartConfig.midweighIn.color} name="Yard Intake (Midweigh)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="skiptrakNonYard" stackId="waste" fill={chartConfig.skiptrakNonYard.color} name="Skip (Non-Yard)" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="total" stroke={chartConfig.total.color} strokeWidth={2} dot={false} name={`Total ${hasComparison ? currentYear : "Handled"}`} />
                  {comparisonRanges.map((range, i) => (
                    <Line
                      key={range.year}
                      type="monotone"
                      dataKey={`total_${range.year}`}
                      stroke={COMPARISON_COLORS[i % COMPARISON_COLORS.length]}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3 }}
                      name={`Total ${range.year}`}
                    />
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
                      <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.midweighIn.color }}>Yard Intake</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.skiptrakNonYard.color }}>Non-Yard Skip</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: chartConfig.total.color }}>Total{hasComparison ? ` ${currentYear}` : ""}</th>
                      {comparisonRanges.map((range, i) => (
                        <th key={range.year} className="text-right py-2 px-3 font-medium" style={{ color: COMPARISON_COLORS[i % COMPARISON_COLORS.length] }}>
                          Total {range.year}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-1.5 px-3 text-muted-foreground">{row.period}</td>
                        <td className="py-1.5 px-3 text-right">{row.midweighIn.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">{row.skiptrakNonYard.toFixed(2)}</td>
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
                      <td className="py-2 px-3 text-right">{totals.midweighIn.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">{totals.skiptrakNonYard.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">{totals.total.toFixed(2)}</td>
                      {comparisonRanges.map((range) => (
                        <td key={range.year} className="py-2 px-3 text-right">
                          {chartData.reduce((s, r) => s + (r[`total_${range.year}`] || 0), 0).toFixed(2)}
                        </td>
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

export default TotalWasteHandled;
