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
import { useWasteValueSettings, streamCostPerTonne } from "@/hooks/useWasteValueSettings";
import {
  format,
  subMonths,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  startOfYear,
  startOfDay,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
  parseISO,
} from "date-fns";

type PeriodKey =
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "last-12-months";

type Bucket = "day" | "week" | "month" | "quarter" | "year";

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "last-12-months", label: "Last 12 months" },
];

const periodWindow = (p: PeriodKey) => {
  const now = new Date();
  switch (p) {
    case "this-week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now, bucket: "day" as Bucket };
    case "last-week": {
      const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return { start: s, end: endOfWeek(s, { weekStartsOn: 1 }), bucket: "day" as Bucket };
    }
    case "this-month":
      return { start: startOfMonth(now), end: now, bucket: "week" as Bucket };
    case "last-month": {
      const s = startOfMonth(subMonths(now, 1));
      return { start: s, end: endOfMonth(s), bucket: "week" as Bucket };
    }
    case "last-3-months":
      return { start: startOfMonth(subMonths(now, 2)), end: now, bucket: "week" as Bucket };
    default:
      return { start: startOfMonth(subMonths(now, 11)), end: now, bucket: "month" as Bucket };
  }
};

const bucketStart = (d: Date, g: Bucket) =>
  g === "day" ? startOfDay(d)
  : g === "week" ? startOfWeek(d, { weekStartsOn: 1 })
  : g === "month" ? startOfMonth(d)
  : g === "quarter" ? startOfQuarter(d)
  : startOfYear(d);

const bucketKey = (d: Date, g: Bucket) => format(bucketStart(d, g), "yyyy-MM-dd");

const bucketLabel = (d: Date, g: Bucket) =>
  g === "day" ? format(d, "EEE dd")
  : g === "week" ? `w/c ${format(d, "dd MMM")}`
  : g === "month" ? format(d, "MMM yy")
  : g === "quarter" ? `Q${format(d, "Q yyyy")}`
  : format(d, "yyyy");

const bucketDates = (start: Date, end: Date, g: Bucket) =>
  g === "day" ? eachDayOfInterval({ start, end })
  : g === "week" ? eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
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

interface BucketData {
  key: string;
  label: string;
  woodAInward: number;
  woodAOutward: number;
  woodCInward: number;
  woodCOutward: number;
  mixedWasteInward: number;
  extractedA: number;
  extractedC: number;
}

const WasteKPIGradeCWood = () => {
  const [period, setPeriod] = useState<PeriodKey>("last-month");
  const { streams, rates } = useWasteValueSettings();

  // Always fetch a rolling 13-month window once; every period is computed from it.
  const fetchFrom = format(startOfMonth(subMonths(new Date(), 12)), "yyyy-MM-dd");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["waste-kpi-wood-rows", fetchFrom],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, movement_type, weight_t, waste_description, raw")
          .eq("source", "midweigh")
          .in("movement_type", ["INWARD", "OUTWARD"])
          .gte("job_date", fetchFrom)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(
          ...data.filter(
            (r: any) =>
              ALL_WOOD_PRODUCTS.includes((r.raw as any)?.Product) ||
              (r.movement_type === "INWARD" && MIXED_WASTE_DESCRIPTIONS.includes(r.waste_description))
          )
        );
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const window_ = useMemo(() => periodWindow(period), [period]);

  const chartData = useMemo<BucketData[]>(() => {
    if (!rows) return [];
    const buckets: Record<string, BucketData> = {};
    bucketDates(window_.start, window_.end, window_.bucket).forEach((d) => {
      const key = bucketKey(d, window_.bucket);
      buckets[key] = {
        key,
        label: bucketLabel(bucketStart(d, window_.bucket), window_.bucket),
        woodAInward: 0, woodAOutward: 0,
        woodCInward: 0, woodCOutward: 0,
        mixedWasteInward: 0,
        extractedA: 0, extractedC: 0,
      };
    });

    const from = format(window_.start, "yyyy-MM-dd");
    const to = format(window_.end, "yyyy-MM-dd");

    rows.forEach((row: any) => {
      const d = (row.job_date || "").substring(0, 10);
      if (!d || d < from || d > to) return;
      const key = bucketKey(parseISO(d), window_.bucket);
      const b = buckets[key];
      if (!b) return;
      const tonnes = (row.weight_t || 0) / 1000; // midweigh = KG
      const product = (row.raw as any)?.Product;
      if (ALL_WOOD_PRODUCTS.includes(product)) {
        const isA = WOOD_A_PRODUCTS.includes(product);
        if (row.movement_type === "INWARD") isA ? (b.woodAInward += tonnes) : (b.woodCInward += tonnes);
        else if (row.movement_type === "OUTWARD") isA ? (b.woodAOutward += tonnes) : (b.woodCOutward += tonnes);
      } else if (row.movement_type === "INWARD") {
        b.mixedWasteInward += tonnes;
      }
    });

    const r = (v: number) => Math.round(v * 100) / 100;
    Object.values(buckets).forEach((b) => {
      b.extractedA = r(Math.max(0, b.woodAOutward - b.woodAInward));
      b.extractedC = r(Math.max(0, b.woodCOutward - b.woodCInward));
      b.woodAInward = r(b.woodAInward);
      b.woodAOutward = r(b.woodAOutward);
      b.woodCInward = r(b.woodCInward);
      b.woodCOutward = r(b.woodCOutward);
      b.mixedWasteInward = r(b.mixedWasteInward);
    });

    return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, window_]);

  // Period totals come straight from the raw rows in the window, so the headline
  // never drifts from what the chart buckets add up to.
  const totals = useMemo(() => {
    let aIn = 0, aOut = 0, cIn = 0, cOut = 0, mixed = 0;
    chartData.forEach((b) => {
      aIn += b.woodAInward;
      aOut += b.woodAOutward;
      cIn += b.woodCInward;
      cOut += b.woodCOutward;
      mixed += b.mixedWasteInward;
    });
    const r = (v: number) => Math.round(v * 100) / 100;
    const extA = chartData.reduce((s, b) => s + b.extractedA, 0);
    const extC = chartData.reduce((s, b) => s + b.extractedC, 0);
    return {
      aIn: r(aIn), aOut: r(aOut), cIn: r(cIn), cOut: r(cOut), mixed: r(mixed),
      extA: r(extA), extC: r(extC),
      pctA: mixed > 0 ? r((extA / mixed) * 100) : 0,
      pctC: mixed > 0 ? r((extC / mixed) * 100) : 0,
    };
  }, [chartData]);

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

  const totalRecovery = Math.round((totals.extA + totals.extC) * 100) / 100;
  const totalRate = totals.mixed > 0 ? (totalRecovery / totals.mixed) * 100 : 0;
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const money = (v: number) => `£${Math.round(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const landfillCostPerTonne =
    Number(rates.landfill_gate_rate || 0) + Number(rates.landfill_haulage_rate || 0);
  const findStream = (needle: string) => streams.find((s) => s.stream?.toLowerCase().includes(needle));
  const woodACost = (() => {
    const s = findStream("wood a");
    return s ? streamCostPerTonne(s) : 0;
  })();
  const woodCCost = (() => {
    const s = findStream("wood c") ?? findStream("wood-c");
    return s ? streamCostPerTonne(s) : 0;
  })();

  const netA = landfillCostPerTonne - woodACost;
  const netC = landfillCostPerTonne - woodCCost;
  const valueA = totals.extA * netA;
  const valueC = totals.extC * netC;
  const totalValue = valueA + valueC;
  const avoidedLandfill = totalRecovery * landfillCostPerTonne;
  const actualCost = totals.extA * woodACost + totals.extC * woodCCost;

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "";
  const rangeLabel = `${format(window_.start, "dd MMM")} – ${format(window_.end, "dd MMM yyyy")}`;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
            <TreePine className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Wood Recovery</CardTitle>
            <CardDescription>
              What the team saved by pulling wood out of mixed waste — every figure below follows the period you pick
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? "default" : "outline"}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
          <Badge variant="secondary" className="ml-auto">{rangeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Headline sentence + saving */}
            <div className="rounded-lg border-2 p-4 space-y-4" style={{ borderColor: COLOR_RATE }}>
              <p className="text-lg text-foreground leading-relaxed">
                {periodLabel} the team pulled{" "}
                <span className="font-bold" style={{ color: COLOR_RATE }}>{fmt(totalRecovery)}t</span> of wood out of{" "}
                <span className="font-semibold">{fmt(totals.mixed)}t</span> of mixed waste
                {" "}({totalRate.toFixed(1)}% recovery), saving{" "}
                <span className="font-bold" style={{ color: COLOR_RATE }}>{money(totalValue)}</span> versus sending it
                to landfill.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Landfill cost avoided</p>
                  <p className="text-2xl font-bold text-foreground">{money(avoidedLandfill)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmt(totalRecovery)}t × {money(landfillCostPerTonne)}/t
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Cost of handling as wood</p>
                  <p className="text-2xl font-bold text-foreground">{money(actualCost)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Grade A {money(woodACost)}/t · Grade C {money(woodCCost)}/t
                  </p>
                </div>
                <div className="rounded-md border p-3" style={{ borderColor: COLOR_RATE }}>
                  <p className="text-xs text-muted-foreground">Net saving</p>
                  <p className="text-2xl font-bold" style={{ color: COLOR_RATE }}>{money(totalValue)}</p>
                  <p className="text-[11px] text-muted-foreground">Avoided landfill less handling cost</p>
                </div>
              </div>
              {streams.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Set wood stream costs in the Settings tab for an accurate net value.
                </p>
              )}
            </div>

            {/* Grade breakdown */}
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { grade: "A", color: COLOR_A, inT: totals.aIn, outT: totals.aOut, rec: totals.extA, pct: totals.pctA, net: netA, value: valueA },
                { grade: "C", color: COLOR_C, inT: totals.cIn, outT: totals.cOut, rec: totals.extC, pct: totals.pctC, net: netC, value: valueC },
              ].map((g) => (
                <div key={g.grade} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm" style={{ background: g.color }} />
                      <span className="font-semibold text-foreground">Grade {g.grade} wood</span>
                    </div>
                    <Badge variant="outline">{g.pct.toFixed(1)}% of mixed</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
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
                    <div>
                      <p className="text-[11px] text-muted-foreground">Saved</p>
                      <p className="text-lg font-semibold" style={{ color: g.color }}>{money(g.value)}</p>
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
                    Faded = arrived already graded · Solid = recovered from mixed waste · {money(g.net)}/t saved
                  </p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Wood out, by where it came from — {periodLabel.toLowerCase()}
              </p>
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
                  <Bar yAxisId="t" dataKey="directIn" name="Arrived as wood" fill="hsl(35, 85%, 55%)" stackId="w" />
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
                {periodLabel} detail
              </summary>
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Mixed waste in</TableHead>
                      <TableHead className="text-right">A arrived</TableHead>
                      <TableHead className="text-right">A out</TableHead>
                      <TableHead className="text-right">A recovered</TableHead>
                      <TableHead className="text-right">C arrived</TableHead>
                      <TableHead className="text-right">C out</TableHead>
                      <TableHead className="text-right">C recovered</TableHead>
                      <TableHead className="text-right">Saved</TableHead>
                      <TableHead className="text-right">Recovery rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.map((row) => {
                      const totalExt = row.extractedA + row.extractedC;
                      const pct = row.mixedWasteInward > 0 ? ((totalExt / row.mixedWasteInward) * 100).toFixed(1) : "0.0";
                      const saved = row.extractedA * netA + row.extractedC * netC;
                      return (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium">{row.label}</TableCell>
                          <TableCell className="text-right">{fmt(row.mixedWasteInward)}</TableCell>
                          <TableCell className="text-right">{fmt(row.woodAInward)}</TableCell>
                          <TableCell className="text-right">{fmt(row.woodAOutward)}</TableCell>
                          <TableCell className="text-right font-medium" style={{ color: COLOR_A }}>{fmt(row.extractedA)}</TableCell>
                          <TableCell className="text-right">{fmt(row.woodCInward)}</TableCell>
                          <TableCell className="text-right">{fmt(row.woodCOutward)}</TableCell>
                          <TableCell className="text-right font-medium" style={{ color: COLOR_C }}>{fmt(row.extractedC)}</TableCell>
                          <TableCell className="text-right">{money(saved)}</TableCell>
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
                      <TableCell className="text-right">{money(totalValue)}</TableCell>
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
