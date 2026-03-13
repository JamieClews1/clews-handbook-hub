import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { MapPin, AlertCircle, Loader2, Container, Truck, ArrowRightLeft } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import type { PostcodeZone } from "@/hooks/usePostcodeZones";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

type RawJob = {
  job_date: string | null;
  weight_t: number | null;
  container_type: string | null;
  vehicle_registration: string | null;
  raw: any;
};

type ContainerCategory = "skip" | "roro" | "artic";
type CategoryFilter = "all" | ContainerCategory;

function categoriseContainer(
  containerType: string | null,
  vehicleReg: string | null,
  settings: LiveJobsSettings
): ContainerCategory | null {
  if (vehicleReg) {
    const vr = vehicleReg.toUpperCase().replace(/\s+/g, "");
    if (settings.artic_vehicle_regs.some(r => r.replace(/\s+/g, "").toUpperCase() === vr)) return "artic";
  }
  if (!containerType) return null;
  const ct = containerType.toLowerCase();
  if (settings.artic_container_keywords.some(kw => ct.includes(kw.toLowerCase()))) return "artic";
  if (settings.roro_container_keywords.some(kw => ct.includes(kw.toLowerCase()))) return "roro";
  if (settings.skip_container_keywords.some(kw => ct.includes(kw.toLowerCase()))) return "skip";
  return null;
}

// Zone colours matching the Excel spreadsheet styling
const ZONE_COLORS: Record<string, { bg: string; text: string; chart: string }> = {
  "Zone 1":            { bg: "bg-green-600",  text: "text-white",            chart: "hsl(142 76% 36%)" },
  "Zone 2":            { bg: "bg-blue-600",   text: "text-white",            chart: "hsl(217 91% 60%)" },
  "Zone 3":            { bg: "bg-amber-500",  text: "text-white",            chart: "hsl(38 92% 50%)" },
  "Zone 3 RoRo Only":  { bg: "bg-orange-500", text: "text-white",            chart: "hsl(25 95% 53%)" },
  "Zone 4 RoRo Only":  { bg: "bg-red-500",    text: "text-white",            chart: "hsl(0 84% 60%)" },
  "Unzoned":           { bg: "bg-muted",      text: "text-muted-foreground", chart: "hsl(var(--muted-foreground))" },
};

function getZoneStyle(zoneName: string) {
  return ZONE_COLORS[zoneName] || ZONE_COLORS["Unzoned"];
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

function normalizePostcode(raw: string): string | null {
  // UK postcodes: outcode (2-4 chars) + incode (always 3 chars: digit + 2 letters)
  // Try with space first
  const spaced = raw.toUpperCase().replace(/\s+/g, " ").trim();
  if (UK_POSTCODE_RE.test(spaced)) return spaced;
  // No space — insert space before last 3 characters (the incode is always 3 chars)
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  if (compact.length >= 5 && /^\d[A-Z]{2}$/.test(compact.slice(-3))) {
    const withSpace = compact.slice(0, -3) + " " + compact.slice(-3);
    if (UK_POSTCODE_RE.test(withSpace)) return withSpace;
  }
  return null;
}

function extractPostcodePrefix(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const normalized = normalizePostcode(postcode);
  if (!normalized) return null;
  const parts = normalized.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1].charAt(0)}`;
  }
  return parts[0];
}

function matchZone(postcode: string | null | undefined, zones: PostcodeZone[]): PostcodeZone | null {
  const prefix = extractPostcodePrefix(postcode);
  if (!prefix) return null;

  for (const zone of zones) {
    if (zone.postcodes.some(zp => {
      const norm = zp.toUpperCase().replace(/\s+/g, " ").trim();
      return prefix === norm || prefix.startsWith(norm);
    })) {
      return zone;
    }
  }
  return null;
}

interface ZoneReportProps {
  zones: PostcodeZone[];
  onAssignZone: (zoneId: string, postcode: string) => Promise<void>;
}

export default function ZoneReport({ zones, onAssignZone }: ZoneReportProps) {
  const [jobs, setJobs] = useState<RawJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      const since = format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd");
      let allJobs: RawJob[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date,weight_t,raw")
          .eq("source", "skiptrak")
          .gte("job_date", since)
          .order("job_date", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) { console.error(error); break; }
        allJobs = allJobs.concat((data ?? []) as RawJob[]);
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }

      setJobs(allJobs);
      setLoading(false);
    };
    fetchJobs();
  }, []);

  // Compute zone data + unzoned postcodes
  const { zoneData, monthLabels, unzonedPostcodes } = useMemo(() => {
    const now = new Date();
    const months = [
      format(startOfMonth(subMonths(now, 2)), "yyyy-MM"),
      format(startOfMonth(subMonths(now, 1)), "yyyy-MM"),
      format(startOfMonth(now), "yyyy-MM"),
    ];
    const labels = months.map(m => {
      const [y, mo] = m.split("-");
      return format(new Date(+y, +mo - 1), "MMM yyyy");
    });

    const map: Record<string, Record<string, { jobs: number; revenue: number; tonnes: number }>> = {};
    const allZoneNames = [...zones.map(z => z.zone_name), "Unzoned"];
    for (const name of allZoneNames) {
      map[name] = {};
      for (const m of months) {
        map[name][m] = { jobs: 0, revenue: 0, tonnes: 0 };
      }
    }

    // Track unzoned postcodes with counts
    const unzonedMap: Record<string, { prefix: string; fullExample: string; jobCount: number; revenue: number; customer: string }> = {};

    for (const job of jobs) {
      if (!job.job_date) continue;
      const monthKey = job.job_date.substring(0, 7);
      if (!months.includes(monthKey)) continue;

      const raw = typeof job.raw === "object" && job.raw ? job.raw : {};
      const postcode = raw["Location Postc"] || raw["Postcode"] || null;
      const cost = parseFloat(raw["Cost"] || raw["Price"] || "0") || 0;
      const tonnes = Math.abs(job.weight_t ?? 0);

      const zone = matchZone(postcode, zones);
      const zoneName = zone ? zone.zone_name : "Unzoned";

      if (!map[zoneName]) {
        map[zoneName] = {};
        for (const m of months) map[zoneName][m] = { jobs: 0, revenue: 0, tonnes: 0 };
      }

      map[zoneName][monthKey].jobs++;
      map[zoneName][monthKey].revenue += Math.abs(cost);
      map[zoneName][monthKey].tonnes += tonnes;

      // Track unzoned postcodes
      if (!zone && postcode) {
        const prefix = extractPostcodePrefix(postcode);
        if (prefix) {
          if (!unzonedMap[prefix]) {
            unzonedMap[prefix] = { prefix, fullExample: postcode, jobCount: 0, revenue: 0, customer: raw["Customer"] || "Unknown" };
          }
          unzonedMap[prefix].jobCount++;
          unzonedMap[prefix].revenue += Math.abs(cost);
        }
      }
    }

    const data = Object.entries(map).map(([zoneName, monthData]) => {
      const totalJobs = Object.values(monthData).reduce((s, v) => s + v.jobs, 0);
      const totalRevenue = Object.values(monthData).reduce((s, v) => s + v.revenue, 0);
      const totalTonnes = Object.values(monthData).reduce((s, v) => s + v.tonnes, 0);
      return {
        zone: zoneName,
        ...Object.fromEntries(months.map((m, i) => [`month${i}_jobs`, monthData[m]?.jobs ?? 0])),
        ...Object.fromEntries(months.map((m, i) => [`month${i}_revenue`, +(monthData[m]?.revenue ?? 0).toFixed(2)])),
        ...Object.fromEntries(months.map((m, i) => [`month${i}_tonnes`, +(monthData[m]?.tonnes ?? 0).toFixed(2)])),
        totalJobs,
        totalRevenue: +totalRevenue.toFixed(2),
        totalTonnes: +totalTonnes.toFixed(2),
      };
    }).filter(d => d.totalJobs > 0)
      .sort((a, b) => {
        if (a.zone === "Unzoned") return 1;
        if (b.zone === "Unzoned") return -1;
        const aOrder = zones.find(z => z.zone_name === a.zone)?.display_order ?? 999;
        const bOrder = zones.find(z => z.zone_name === b.zone)?.display_order ?? 999;
        return aOrder - bOrder;
      });

    const unzoned = Object.values(unzonedMap).sort((a, b) => b.jobCount - a.jobCount);

    return { zoneData: data, monthLabels: labels, unzonedPostcodes: unzoned };
  }, [jobs, zones]);

  const chartData = useMemo(() =>
    zoneData.map(d => ({
      zone: d.zone,
      jobs: d.totalJobs,
      fill: getZoneStyle(d.zone).chart,
    })), [zoneData]);

  const chartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {};
    cfg.jobs = { label: "Total Jobs", color: "hsl(var(--primary))" };
    return cfg;
  }, []);

  if (loading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  if (zones.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No postcode zones configured. Add zones in Settings to see zone-based reporting.
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">
          <MapPin className="h-4 w-4 mr-1.5" /> Overview
        </TabsTrigger>
        <TabsTrigger value="unzoned" className="gap-1.5">
          <AlertCircle className="h-4 w-4" /> Unzoned Postcodes
          {unzonedPostcodes.length > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{unzonedPostcodes.length}</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {zoneData.map(d => {
              const style = getZoneStyle(d.zone);
              return (
                <Card key={d.zone} className="overflow-hidden">
                  <div className={`h-1.5 ${style.bg}`} />
                  <CardHeader className="pb-1 pt-3">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{d.zone}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-2xl font-bold text-foreground">{d.totalJobs}</p>
                    <p className="text-sm font-semibold text-green-600">£{d.totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-muted-foreground">{d.totalTonnes.toFixed(1)}t</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" /> Jobs by Zone — Last 3 Months
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="zone" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="jobs" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Zone Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    {monthLabels.map(ml => (
                      <TableHead key={ml} className="text-center" colSpan={3}>{ml}</TableHead>
                    ))}
                    <TableHead className="text-center" colSpan={3}>Total</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead />
                    {monthLabels.map(ml => (
                      <React.Fragment key={`sub-${ml}`}>
                        <TableHead className="text-center text-xs">Jobs</TableHead>
                        <TableHead className="text-center text-xs">Revenue</TableHead>
                        <TableHead className="text-center text-xs">Tonnes</TableHead>
                      </React.Fragment>
                    ))}
                    <TableHead className="text-center text-xs">Jobs</TableHead>
                    <TableHead className="text-center text-xs">Revenue</TableHead>
                    <TableHead className="text-center text-xs">Tonnes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zoneData.map((d, i) => {
                    const style = getZoneStyle(d.zone);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${style.bg} ${style.text}`}>
                            {d.zone}
                          </span>
                        </TableCell>
                        {[0, 1, 2].map(mi => (
                          <React.Fragment key={mi}>
                            <TableCell className="text-center">{(d as any)[`month${mi}_jobs`]}</TableCell>
                            <TableCell className="text-center text-muted-foreground">£{((d as any)[`month${mi}_revenue`] || 0).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{((d as any)[`month${mi}_tonnes`] || 0).toFixed(1)}</TableCell>
                          </React.Fragment>
                        ))}
                        <TableCell className="text-center font-semibold">{d.totalJobs}</TableCell>
                        <TableCell className="text-center font-semibold text-green-600">£{d.totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-center font-semibold text-muted-foreground">{d.totalTonnes.toFixed(1)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="unzoned">
        <UnzonedPostcodesTable
          postcodes={unzonedPostcodes}
          zones={zones}
          onAssignZone={onAssignZone}
        />
      </TabsContent>
    </Tabs>
  );
}

// ── Unzoned Postcodes Sub-component ──

type UnzonedEntry = { prefix: string; fullExample: string; jobCount: number; revenue: number; customer: string };

function UnzonedPostcodesTable({
  postcodes,
  zones,
  onAssignZone,
}: {
  postcodes: UnzonedEntry[];
  zones: PostcodeZone[];
  onAssignZone: (zoneId: string, postcode: string) => Promise<void>;
}) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const handleAssign = useCallback(async (prefix: string) => {
    const zoneId = selections[prefix];
    if (!zoneId) return;
    setAssigning(prefix);
    try {
      await onAssignZone(zoneId, prefix);
      toast.success(`${prefix} assigned to zone`);
      // Remove from selections
      setSelections(prev => {
        const next = { ...prev };
        delete next[prefix];
        return next;
      });
    } catch {
      toast.error("Failed to assign postcode");
    }
    setAssigning(null);
  }, [selections, onAssignZone]);

  if (postcodes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          🎉 All postcodes from the last 3 months are assigned to a zone.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Unzoned Postcodes ({postcodes.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          These postcode prefixes appeared in Skiptrak data but don't match any zone. Assign them to a zone to include them in reporting.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Postcode Prefix</TableHead>
              <TableHead>Example</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-center">Jobs</TableHead>
              <TableHead className="text-center">Revenue</TableHead>
              <TableHead>Assign to Zone</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {postcodes.map(pc => (
              <TableRow key={pc.prefix}>
                <TableCell className="font-mono font-semibold">{pc.prefix}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{pc.fullExample}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{pc.customer}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{pc.jobCount}</Badge>
                </TableCell>
                <TableCell className="text-center text-sm">
                  £{pc.revenue.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell>
                  <Select
                    value={selections[pc.prefix] || ""}
                    onValueChange={v => setSelections(prev => ({ ...prev, [pc.prefix]: v }))}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Select zone..." />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map(z => {
                        const style = getZoneStyle(z.zone_name);
                        return (
                          <SelectItem key={z.id} value={z.id}>
                            <span className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${style.bg}`} />
                              {z.zone_name}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs"
                    disabled={!selections[pc.prefix] || assigning === pc.prefix}
                    onClick={() => handleAssign(pc.prefix)}
                  >
                    {assigning === pc.prefix ? <Loader2 className="h-3 w-3 animate-spin" /> : "Assign"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
