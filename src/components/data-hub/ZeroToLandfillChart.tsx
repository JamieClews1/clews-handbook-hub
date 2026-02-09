import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Settings2, Leaf } from "lucide-react";
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
import { startOfWeek, endOfWeek, format, subWeeks, parseISO } from "date-fns";

type WasteGroup = "landfill" | "rdf" | "recycled";

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

const ZeroToLandfillChart = () => {
  const [groupMap, setGroupMap] = useState<Record<string, WasteGroup>>(loadGroupMap);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterGroup, setFilterGroup] = useState<WasteGroup | "all">("all");

  useEffect(() => {
    saveGroupMap(groupMap);
  }, [groupMap]);

  // Calculate 52 weeks range
  const now = new Date();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStart = startOfWeek(subWeeks(now, 51), { weekStartsOn: 1 });

  const { data: rawJobs, isLoading } = useQuery({
    queryKey: ["ztl-midweigh-outward", weekStart.toISOString(), weekEnd.toISOString()],
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
          .select("job_date, weight_t, raw")
          .eq("source", "midweigh")
          .eq("movement_type", "OUTWARD")
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

    const weekBuckets: Record<string, { landfill: number; rdf: number; recycled: number }> = {};

    // Pre-populate 52 weeks
    for (let i = 0; i < 52; i++) {
      const ws = startOfWeek(subWeeks(now, 51 - i), { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      weekBuckets[key] = { landfill: 0, rdf: 0, recycled: 0 };
    }

    rawJobs.forEach((job: any) => {
      if (!job.job_date || job.weight_t == null) return;
      const jobDate = parseISO(job.job_date);
      const ws = startOfWeek(jobDate, { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");

      if (!weekBuckets[key]) return;

      const desc = job.raw?.Product || "";
      const group: WasteGroup = groupMap[desc] || "recycled";
      // Midweigh weight is in KG, convert to tonnes
      const tonnes = (job.weight_t || 0) / 1000;
      weekBuckets[key][group] += tonnes;
    });

    return Object.entries(weekBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekDate, values]) => ({
        week: format(parseISO(weekDate), "dd MMM"),
        weekFull: weekDate,
        landfill: Math.round(values.landfill * 100) / 100,
        rdf: Math.round(values.rdf * 100) / 100,
        recycled: Math.round(values.recycled * 100) / 100,
      }));
  }, [rawJobs, groupMap]);

  const chartConfig = {
    landfill: { label: "Landfill", color: GROUP_COLORS.landfill },
    rdf: { label: "RDF & Waste To RDF", color: GROUP_COLORS.rdf },
    recycled: { label: "All Recycled", color: GROUP_COLORS.recycled },
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
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Leaf className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Zero To Landfill</CardTitle>
            <p className="text-sm text-muted-foreground">
              Weekly outward waste by Product · Midweigh · Last 52 weeks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                  <Line
                    type="monotone"
                    dataKey="landfill"
                    stroke={GROUP_COLORS.landfill}
                    strokeWidth={2}
                    dot={false}
                    name="Landfill"
                  />
                  <Line
                    type="monotone"
                    dataKey="rdf"
                    stroke={GROUP_COLORS.rdf}
                    strokeWidth={2}
                    dot={false}
                    name="RDF & Waste To RDF"
                  />
                  <Line
                    type="monotone"
                    dataKey="recycled"
                    stroke={GROUP_COLORS.recycled}
                    strokeWidth={2}
                    dot={false}
                    name="All Recycled"
                  />
                </LineChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ZeroToLandfillChart;
