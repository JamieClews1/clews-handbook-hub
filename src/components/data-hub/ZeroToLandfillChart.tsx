import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Settings2, Leaf, CalendarIcon, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ZeroToLandfillPercentChart from "./ZeroToLandfillPercentChart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subWeeks, subYears, parseISO, differenceInWeeks, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";

type WasteGroup = "landfill" | "rdf" | "recycled";
type ViewMode = "week" | "month" | "total";

const GROUP_LABELS: Record<WasteGroup, string> = {
  landfill: "Landfill",
  rdf: "RDF & Waste To RDF",
  recycled: "All Recycled",
};

const GROUP_COLORS: Record<WasteGroup, string> = {
  landfill: "hsl(0, 70%, 50%)",
  rdf: "hsl(35, 85%, 55%)",
  recycled: "hsl(142, 70%, 45%)",
};

// Default mapping - user can override
const DEFAULT_GROUP_MAP: Record<string, WasteGroup> = {
  "MIX MUN": "landfill",
  "Waste Out": "landfill",
  "RDF": "rdf",
  "WASTE OUT (FOR RDF)": "rdf",
};

const STORAGE_KEY = "ztl-waste-group-map";

function loadGroupMap(): Record<string, WasteGroup> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...DEFAULT_GROUP_MAP };
}

function saveGroupMap(map: Record<string, WasteGroup>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

interface ZeroToLandfillChartProps {
  externalStartDate?: Date;
  externalEndDate?: Date;
}

const ZeroToLandfillChart = ({ externalStartDate, externalEndDate }: ZeroToLandfillChartProps = {}) => {
  const [groupMap, setGroupMap] = useState<Record<string, WasteGroup>>(loadGroupMap);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterGroup, setFilterGroup] = useState<WasteGroup | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [showTable, setShowTable] = useState(false);

  const now = new Date();
  const maxStartDate = subYears(now, 2);
  const [internalStartDate, setInternalStartDate] = useState<Date>(startOfWeek(subWeeks(now, 51), { weekStartsOn: 1 }));
  const [internalEndDate, setInternalEndDate] = useState<Date>(endOfWeek(now, { weekStartsOn: 1 }));

  const startDate = externalStartDate || internalStartDate;
  const endDate = externalEndDate || internalEndDate;
  const setStartDate = externalStartDate ? () => {} : setInternalStartDate;
  const setEndDate = externalEndDate ? () => {} : setInternalEndDate;
  const hasExternalDates = !!(externalStartDate && externalEndDate);

  useEffect(() => {
    saveGroupMap(groupMap);
  }, [groupMap]);

  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(endDate, { weekStartsOn: 1 });

  const { data: rawJobs, isLoading } = useQuery({
    queryKey: ["ztl-midweigh-all", weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      const startStr = format(weekStart, "yyyy-MM-dd");
      const endStr = format(weekEnd, "yyyy-MM-dd");

      let allJobs: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, weight_t, raw, movement_type")
          .eq("source", "midweigh")
          .in("movement_type", ["OUTWARD", "INWARD"])
          .gte("job_date", startStr)
          .lte("job_date", endStr)
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (data) allJobs = allJobs.concat(data);
        hasMore = data?.length === pageSize;
        from += pageSize;
      }

      return allJobs;
    },
  });

  // Unique waste descriptions
  const wasteDescriptions = useMemo(() => {
    if (!rawJobs) return [];
    const descs = new Set<string>();
    rawJobs.forEach((j: any) => {
      const product = j.raw?.Product;
      if (product) descs.add(product);
    });
    return Array.from(descs).sort();
  }, [rawJobs]);

  // Chart data: group by week, sum by group
  const chartData = useMemo(() => {
    if (!rawJobs?.length) return [];

    const buckets: Record<string, { landfill: number; rdf: number; recycled: number; totalIn: number }> = {};

    if (viewMode === "total") {
      buckets["total"] = { landfill: 0, rdf: 0, recycled: 0, totalIn: 0 };
    } else if (viewMode === "week") {
      const weeks = eachWeekOfInterval({ start: weekStart, end: weekEnd }, { weekStartsOn: 1 });
      weeks.forEach((ws) => {
        const key = format(ws, "yyyy-MM-dd");
        buckets[key] = { landfill: 0, rdf: 0, recycled: 0, totalIn: 0 };
      });
    } else {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      months.forEach((ms) => {
        const key = format(ms, "yyyy-MM-dd");
        buckets[key] = { landfill: 0, rdf: 0, recycled: 0, totalIn: 0 };
      });
    }

    rawJobs.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      const jobDate = parseISO(job.job_date);
      let key: string;
      if (viewMode === "total") {
        key = "total";
      } else {
        const bucketDate = viewMode === "week"
          ? startOfWeek(jobDate, { weekStartsOn: 1 })
          : startOfMonth(jobDate);
        key = format(bucketDate, "yyyy-MM-dd");
      }

      if (!buckets[key]) return;

      const tonnes = (job.weight_t || 0) / 1000;

      if (job.movement_type === "INWARD") {
        buckets[key].totalIn += tonnes;
      } else {
        const desc = job.raw?.Product || "";
        const group: WasteGroup = groupMap[desc] || "recycled";
        buckets[key][group] += tonnes;
      }
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketDate, values]) => {
        const total = values.landfill + values.rdf + values.recycled;
        const landfillPct = total > 0 ? Math.round((values.landfill / total) * 10000) / 100 : 0;
        return {
        week: viewMode === "total"
            ? "Total"
            : viewMode === "week"
              ? format(parseISO(bucketDate), "dd MMM")
              : format(parseISO(bucketDate), "MMM yyyy"),
          weekFull: bucketDate,
          landfill: Math.round(values.landfill * 100) / 100,
          rdf: Math.round(values.rdf * 100) / 100,
          recycled: Math.round(values.recycled * 100) / 100,
          totalIn: Math.round(values.totalIn * 100) / 100,
          landfillPct,
        };
      });
  }, [rawJobs, groupMap, viewMode, startDate, endDate]);

  const chartConfig = {
    totalIn: { label: "Total Waste In", color: "hsl(210, 70%, 50%)" },
    landfill: { label: "Landfill", color: GROUP_COLORS.landfill },
    rdf: { label: "RDF & Waste To RDF", color: GROUP_COLORS.rdf },
    recycled: { label: "All Recycled", color: GROUP_COLORS.recycled },
    landfillPct: { label: "Landfill %", color: "hsl(0, 70%, 35%)" },
  };

  const handleGroupChange = (desc: string, group: WasteGroup) => {
    setGroupMap((prev) => ({ ...prev, [desc]: group }));
  };

  // Counts per group
  const groupCounts = useMemo(() => {
    const counts = { landfill: 0, rdf: 0, recycled: 0 };
    wasteDescriptions.forEach((d) => {
      const g = groupMap[d] || "recycled";
      counts[g]++;
    });
    return counts;
  }, [wasteDescriptions, groupMap]);

  return (
    <>
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Leaf className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Zero To Landfill</CardTitle>
            <p className="text-sm text-muted-foreground">
              {viewMode === "week" ? "Weekly" : viewMode === "month" ? "Monthly" : "Total"} outward waste by Product · Midweigh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!hasExternalDates && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal text-xs")}>
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    {format(startDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    disabled={(d) => d > endDate || d < maxStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal text-xs")}>
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    {format(endDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    disabled={(d) => d < startDate || d > now}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </>
          )}
          <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-0.5">
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setViewMode("week")}
            >
              Week
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setViewMode("month")}
            >
              Month
            </Button>
            <Button
              variant={viewMode === "total" ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setViewMode("total")}
            >
              Total
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-xs" style={{ borderColor: GROUP_COLORS.landfill, color: GROUP_COLORS.landfill }}>
              Landfill ({groupCounts.landfill})
            </Badge>
            <Badge variant="outline" className="text-xs" style={{ borderColor: GROUP_COLORS.rdf, color: GROUP_COLORS.rdf }}>
              RDF ({groupCounts.rdf})
            </Badge>
            <Badge variant="outline" className="text-xs" style={{ borderColor: GROUP_COLORS.recycled, color: GROUP_COLORS.recycled }}>
              Recycled ({groupCounts.recycled})
            </Badge>
          </div>

          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Configure Groups
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Configure Waste Stream Groups</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mb-4">
                Assign each waste description to one of the three groups. Unassigned streams default to "All Recycled".
              </p>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">Show:</span>
                <Select value={filterGroup} onValueChange={(val) => setFilterGroup(val as WasteGroup | "all")}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    <SelectItem value="landfill">Landfill ({groupCounts.landfill})</SelectItem>
                    <SelectItem value="rdf">RDF & Waste To RDF ({groupCounts.rdf})</SelectItem>
                    <SelectItem value="recycled">All Recycled ({groupCounts.recycled})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {wasteDescriptions
                    .filter((desc) => filterGroup === "all" || (groupMap[desc] || "recycled") === filterGroup)
                    .map((desc) => (
                    <div key={desc} className="flex items-center gap-3 py-2 border-b border-border/50">
                      <div className="flex-1 text-sm truncate" title={desc}>
                        {desc}
                      </div>
                      <Select
                        value={groupMap[desc] || "recycled"}
                        onValueChange={(val) => handleGroupChange(desc, val as WasteGroup)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="landfill">Landfill</SelectItem>
                          <SelectItem value="rdf">RDF & Waste To RDF</SelectItem>
                          <SelectItem value="recycled">All Recycled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[350px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ minWidth: "1400px" }}>
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <LineChart data={chartData} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
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
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    label={{ value: "Tonnes", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    label={{ value: "Landfill %", angle: 90, position: "insideRight", style: { fontSize: 12 } }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="totalIn"
                    yAxisId="left"
                    stroke="hsl(210, 70%, 50%)"
                    strokeWidth={2}
                    dot={false}
                    name="Total Waste In"
                  />
                  <Line
                    type="monotone"
                    dataKey="landfill"
                    yAxisId="left"
                    stroke={GROUP_COLORS.landfill}
                    strokeWidth={2}
                    dot={false}
                    name="Landfill"
                  />
                  <Line
                    type="monotone"
                    dataKey="rdf"
                    yAxisId="left"
                    stroke={GROUP_COLORS.rdf}
                    strokeWidth={2}
                    dot={false}
                    name="RDF & Waste To RDF"
                  />
                  <Line
                    type="monotone"
                    dataKey="recycled"
                    yAxisId="left"
                    stroke={GROUP_COLORS.recycled}
                    strokeWidth={2}
                    dot={false}
                    name="All Recycled"
                  />
                  <Line
                    type="monotone"
                    dataKey="landfillPct"
                    yAxisId="right"
                    stroke="hsl(0, 70%, 35%)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    name="Landfill %"
                  />
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

      <ZeroToLandfillPercentChart chartData={chartData} isLoading={isLoading} viewMode={viewMode} />

      {!isLoading && chartData.length > 0 && (
        <Collapsible open={showTable} onOpenChange={setShowTable}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="col-span-2 mt-2 w-full justify-center gap-2 text-xs text-muted-foreground">
              <ChevronDown className={`h-4 w-4 transition-transform ${showTable ? "rotate-180" : ""}`} />
              {showTable ? "Hide data table" : "Show data table"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="col-span-2 mt-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{viewMode === "week" ? "Weekly" : viewMode === "month" ? "Monthly" : "Total"} Tonnage Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">{viewMode === "week" ? "Week" : viewMode === "month" ? "Month" : "Period"}</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: "hsl(210, 70%, 50%)" }}>Total In</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: GROUP_COLORS.landfill }}>Landfill</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: GROUP_COLORS.rdf }}>RDF</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: GROUP_COLORS.recycled }}>Recycled</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Landfill %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row) => (
                        <tr key={row.weekFull} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="py-1.5 px-3 text-muted-foreground">{row.week}</td>
                          <td className="py-1.5 px-3 text-right font-medium">{row.totalIn.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right">{row.landfill.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right">{row.rdf.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right">{row.recycled.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right text-muted-foreground">{row.landfillPct.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td className="py-2 px-3">Total</td>
                        <td className="py-2 px-3 text-right">{chartData.reduce((s, r) => s + r.totalIn, 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{chartData.reduce((s, r) => s + r.landfill, 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{chartData.reduce((s, r) => s + r.rdf, 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{chartData.reduce((s, r) => s + r.recycled, 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {(() => {
                            const totOut = chartData.reduce((s, r) => s + r.landfill + r.rdf + r.recycled, 0);
                            const totLf = chartData.reduce((s, r) => s + r.landfill, 0);
                            return totOut > 0 ? (totLf / totOut * 100).toFixed(2) : "0.00";
                          })()}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
};

export default ZeroToLandfillChart;
