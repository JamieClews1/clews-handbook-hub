import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Recycle, Trash2, Factory, Truck, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, subMonths, subYears, format, parseISO, startOfYear, isBefore, isAfter,
} from "date-fns";
import { MonthPicker } from "@/components/MonthPicker";

/* ------------------------------------------------------------------ */
/*  ZTL group map – shares the same localStorage key as the ZTL chart */
/* ------------------------------------------------------------------ */
type WasteGroup = "landfill" | "rdf" | "recycled";
const ZTL_STORAGE_KEY = "ztl-waste-group-map";
const DEFAULT_GROUP_MAP: Record<string, WasteGroup> = {
  "MIX MUN": "landfill",
  "Waste Out": "landfill",
  "RDF": "rdf",
  "WASTE OUT (FOR RDF)": "rdf",
};
function loadGroupMap(): Record<string, WasteGroup> {
  try {
    const saved = localStorage.getItem(ZTL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...DEFAULT_GROUP_MAP };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
async function fetchAllPaged(builder: any) {
  let all: any[] = [];
  let from = 0;
  const ps = 1000;
  let more = true;
  while (more) {
    const { data, error } = await builder.range(from, from + ps - 1);
    if (error) throw error;
    if (data) all = all.concat(data);
    more = data?.length === ps;
    from += ps;
  }
  return all;
}

interface PeriodMetrics {
  recyclingRate: number;
  landfillRate: number;
  wasteOutUnit17: number;
  totalWasteHandled: number;
}

function computeMetrics(
  midweighOutward: any[],
  midweighYardIntake: any[],
  skiptrakJobs: any[],
  groupMap: Record<string, WasteGroup>,
): PeriodMetrics {
  let landfillT = 0;
  let rdfT = 0;
  let recycledT = 0;
  let wasteOutT = 0; // all Midweigh OUTWARD = "waste out of Unit 17"

  midweighOutward.forEach((j: any) => {
    if (j.weight_t == null) return;
    const tonnes = (j.weight_t || 0) / 1000;
    wasteOutT += tonnes;
    const desc = j.raw?.Product || "";
    const group: WasteGroup = groupMap[desc] || "recycled";
    if (group === "landfill") landfillT += tonnes;
    else if (group === "rdf") rdfT += tonnes;
    else recycledT += tonnes;
  });

  const totalOut = landfillT + rdfT + recycledT;
  const recyclingRate = totalOut > 0 ? (recycledT / totalOut) * 100 : 0;
  const landfillRate = totalOut > 0 ? (landfillT / totalOut) * 100 : 0;

  // Total Waste Handled = Yard Intake (Midweigh) + Non-Yard Skip (Skiptrak)
  let yardIntakeT = 0;
  midweighYardIntake.forEach((j: any) => {
    if (j.weight_t == null) return;
    yardIntakeT += (j.weight_t || 0) / 1000;
  });

  let nonYardSkipT = 0;
  skiptrakJobs.forEach((j: any) => {
    if (j.weight_t == null) return;
    const tipping = (j.tipping_location || "").trim().toLowerCase();
    if (tipping.startsWith("clews recycling") || !tipping) return;
    nonYardSkipT += (j.weight_t || 0);
  });

  return {
    recyclingRate: Math.round(recyclingRate * 10) / 10,
    landfillRate: Math.round(landfillRate * 10) / 10,
    wasteOutUnit17: Math.round(wasteOutT * 100) / 100,
    totalWasteHandled: Math.round((yardIntakeT + nonYardSkipT) * 100) / 100,
  };
}

/* ------------------------------------------------------------------ */
/*  Fetch helper for a date range                                      */
/* ------------------------------------------------------------------ */
async function fetchPeriodData(startStr: string, endStr: string) {
  const [midweighOutward, midweighYardIntake, skiptrak] = await Promise.all([
    fetchAllPaged(
      supabase
        .from("data_hub_jobs")
        .select("job_date, weight_t, raw, movement_type")
        .eq("source", "midweigh")
        .eq("movement_type", "OUTWARD")
        .gte("job_date", startStr)
        .lte("job_date", endStr),
    ),
    fetchAllPaged(
      supabase
        .from("data_hub_jobs")
        .select("job_date, weight_t, job_type")
        .eq("source", "midweigh")
        .in("job_type", ["WASTEIN", "SKIP"])
        .gte("job_date", startStr)
        .lte("job_date", endStr),
    ),
    fetchAllPaged(
      supabase
        .from("data_hub_jobs")
        .select("job_date, weight_t, tipping_location")
        .eq("source", "skiptrak")
        .gte("job_date", startStr)
        .lte("job_date", endStr),
    ),
  ]);
  return { midweighOutward, midweighYardIntake, skiptrak };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const PerformanceHubKPIs = () => {
  const groupMap = useMemo(() => loadGroupMap(), []);
  const now = new Date();

  // Last full month
  const lastMonth = subMonths(now, 1);
  const lmStart = startOfMonth(lastMonth);
  const lmEnd = endOfMonth(lastMonth);

  // YTD (Jan 1 → end of last full month)
  const ytdStart = startOfYear(now);
  const ytdEnd = lmEnd;

  // Previous 6 months (the 6 months before the last full month)
  const prev6Start = startOfMonth(subMonths(lastMonth, 6));
  const prev6End = endOfMonth(subMonths(lastMonth, 1));

  // Same period last year (same YTD range but -1 year)
  const splyStart = subYears(ytdStart, 1);
  const splyEnd = subYears(ytdEnd, 1);

  const { data, isLoading } = useQuery({
    queryKey: ["perf-hub-kpis", format(lmStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const [lastMonthData, ytdData, prev6Data, splyData] = await Promise.all([
        fetchPeriodData(format(lmStart, "yyyy-MM-dd"), format(lmEnd, "yyyy-MM-dd")),
        fetchPeriodData(format(ytdStart, "yyyy-MM-dd"), format(ytdEnd, "yyyy-MM-dd")),
        fetchPeriodData(format(prev6Start, "yyyy-MM-dd"), format(prev6End, "yyyy-MM-dd")),
        fetchPeriodData(format(splyStart, "yyyy-MM-dd"), format(splyEnd, "yyyy-MM-dd")),
      ]);
      return { lastMonthData, ytdData, prev6Data, splyData };
    },
    staleTime: 5 * 60 * 1000,
  });

  const metrics = useMemo(() => {
    if (!data) return null;
    return {
      lastMonth: computeMetrics(
        data.lastMonthData.midweighOutward,
        data.lastMonthData.midweighYardIntake,
        data.lastMonthData.skiptrak,
        groupMap,
      ),
      ytd: computeMetrics(
        data.ytdData.midweighOutward,
        data.ytdData.midweighYardIntake,
        data.ytdData.skiptrak,
        groupMap,
      ),
      prev6: computeMetrics(
        data.prev6Data.midweighOutward,
        data.prev6Data.midweighYardIntake,
        data.prev6Data.skiptrak,
        groupMap,
      ),
      sply: computeMetrics(
        data.splyData.midweighOutward,
        data.splyData.midweighYardIntake,
        data.splyData.skiptrak,
        groupMap,
      ),
    };
  }, [data, groupMap]);

  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-[160px]" />
          </Card>
        ))}
      </div>
    );
  }

  const lastMonthLabel = format(lmStart, "MMMM yyyy");
  const ytdLabel = `YTD ${now.getFullYear()}`;
  const prev6Label = `${format(prev6Start, "MMM")}–${format(prev6End, "MMM yyyy")}`;
  const splyLabel = `YTD ${now.getFullYear() - 1}`;

  const kpis: {
    label: string;
    icon: React.ReactNode;
    lastMonth: string;
    ytd: number;
    prev6: number;
    sply: number;
    isPercent: boolean;
    higherIsBetter: boolean;
  }[] = [
    {
      label: "Recycling Rate",
      icon: <Recycle className="h-5 w-5 text-green-600" />,
      lastMonth: `${metrics.lastMonth.recyclingRate}%`,
      ytd: metrics.ytd.recyclingRate,
      prev6: metrics.prev6.recyclingRate,
      sply: metrics.sply.recyclingRate,
      isPercent: true,
      higherIsBetter: true,
    },
    {
      label: "Landfill Rate",
      icon: <Trash2 className="h-5 w-5 text-destructive" />,
      lastMonth: `${metrics.lastMonth.landfillRate}%`,
      ytd: metrics.ytd.landfillRate,
      prev6: metrics.prev6.landfillRate,
      sply: metrics.sply.landfillRate,
      isPercent: true,
      higherIsBetter: false,
    },
    {
      label: "Waste Out (Unit 17)",
      icon: <Factory className="h-5 w-5 text-primary" />,
      lastMonth: `${metrics.lastMonth.wasteOutUnit17.toFixed(1)}t`,
      ytd: metrics.ytd.wasteOutUnit17,
      prev6: metrics.prev6.wasteOutUnit17,
      sply: metrics.sply.wasteOutUnit17,
      isPercent: false,
      higherIsBetter: true,
    },
    {
      label: "Total Waste Handled",
      icon: <Truck className="h-5 w-5 text-primary" />,
      lastMonth: `${metrics.lastMonth.totalWasteHandled.toFixed(1)}t`,
      ytd: metrics.ytd.totalWasteHandled,
      prev6: metrics.prev6.totalWasteHandled,
      sply: metrics.sply.totalWasteHandled,
      isPercent: false,
      higherIsBetter: true,
    },
  ];

  return (
    <div className="space-y-3 mb-8">
      <h2 className="text-lg font-semibold text-foreground">
        Annual Totals — Last full month: {lastMonthLabel}
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {kpi.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-2xl font-bold text-foreground leading-tight">{kpi.lastMonth}</p>
                </div>
              </div>

              {/* Comparison rows */}
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <ComparisonRow
                  label={ytdLabel}
                  value={kpi.ytd}
                  compValue={kpi.sply}
                  compLabel={splyLabel}
                  isPercent={kpi.isPercent}
                  higherIsBetter={kpi.higherIsBetter}
                />
                <ComparisonRow
                  label={ytdLabel}
                  value={kpi.ytd}
                  compValue={kpi.prev6}
                  compLabel={prev6Label}
                  isPercent={kpi.isPercent}
                  higherIsBetter={kpi.higherIsBetter}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Comparison row                                                     */
/* ------------------------------------------------------------------ */
function ComparisonRow({
  label,
  value,
  compValue,
  compLabel,
  isPercent,
  higherIsBetter,
}: {
  label: string;
  value: number;
  compValue: number;
  compLabel: string;
  isPercent: boolean;
  higherIsBetter: boolean;
}) {
  const diff = compValue > 0 ? ((value - compValue) / compValue) * 100 : 0;
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;
  const isNeutral = Math.abs(diff) < 0.5;

  const formatted = isPercent
    ? `${value.toFixed(1)}%`
    : `${value.toFixed(1)}t`;

  const compFormatted = isPercent
    ? `${compValue.toFixed(1)}%`
    : `${compValue.toFixed(1)}t`;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground truncate mr-2">
        vs {compLabel}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-foreground">{formatted}</span>
        <span className="text-muted-foreground">vs</span>
        <span className="text-muted-foreground">{compFormatted}</span>
        {!isNeutral && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1 py-0 h-4 ${
              isPositive
                ? "text-green-600 border-green-300 bg-green-50"
                : "text-destructive border-destructive/30 bg-destructive/5"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
            )}
            {Math.abs(diff).toFixed(0)}%
          </Badge>
        )}
        {isNeutral && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-muted-foreground">
            <Minus className="h-2.5 w-2.5" />
          </Badge>
        )}
      </div>
    </div>
  );
}

export default PerformanceHubKPIs;
