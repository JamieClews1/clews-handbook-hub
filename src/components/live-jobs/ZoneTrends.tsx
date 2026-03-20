import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { TrendingUp, ArrowUp, ArrowDown, Minus, ChevronsUpDown, MapPin, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { PostcodeZone } from "@/hooks/usePostcodeZones";

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

function normalizePostcode(raw: string): string | null {
  const spaced = raw.toUpperCase().replace(/\s+/g, " ").trim();
  if (UK_POSTCODE_RE.test(spaced)) return spaced;
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

function matchZone(prefix: string, zones: PostcodeZone[]): PostcodeZone | null {
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

const ZONE_COLORS: Record<string, string> = {
  "Zone 1": "hsl(142 76% 36%)",
  "Zone 2": "hsl(217 91% 60%)",
  "Zone 3": "hsl(38 92% 50%)",
  "Zone 3 RoRo Only": "hsl(25 95% 53%)",
  "Zone 4 RoRo Only": "hsl(0 84% 60%)",
  "Out of Zones": "hsl(var(--muted-foreground))",
  "Unzoned": "hsl(var(--muted-foreground))",
};

type RawJob = {
  job_date: string | null;
  weight_t: number | null;
  raw: any;
  movement_type?: string | null;
  site?: string | null;
};

interface ZoneTrendsProps {
  jobs: RawJob[];
  zones: PostcodeZone[];
}

export default function ZoneTrends({ jobs, zones }: ZoneTrendsProps) {
  const [newSitesOnly, setNewSitesOnly] = useState(false);
  const [historicalPrefixes, setHistoricalPrefixes] = useState<Set<string> | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const threeMonthsAgo = useMemo(() =>
    format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"),
    []
  );

  useEffect(() => {
    if (!newSitesOnly || historicalPrefixes !== null) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      const prefixes = new Set<string>();
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("raw")
          .eq("source", "skiptrak")
          .eq("movement_type", "delivery")
          .lt("job_date", threeMonthsAgo)
          .range(from, from + pageSize - 1);
        if (error) { console.error(error); break; }
        for (const row of data ?? []) {
          const r = typeof row.raw === "object" && row.raw ? (row.raw as any) : {};
          const pc = r["Location Postc"] || r["Postcode"] || null;
          const prefix = extractPostcodePrefix(pc);
          if (prefix) prefixes.add(prefix);
        }
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      setHistoricalPrefixes(prefixes);
      setLoadingHistory(false);
    };
    fetchHistory();
  }, [newSitesOnly, historicalPrefixes, threeMonthsAgo]);

  const { postcodeTrends, zoneTrends, monthLabels } = useMemo(() => {
    const now = new Date();
    const months = [
      format(startOfMonth(subMonths(now, 2)), "yyyy-MM"),
      format(startOfMonth(subMonths(now, 1)), "yyyy-MM"),
      format(startOfMonth(now), "yyyy-MM"),
    ];
    const labels = months.map(m => {
      const [y, mo] = m.split("-");
      return format(new Date(+y, +mo - 1), "MMM yy");
    });

    const filteredJobs = newSitesOnly
      ? jobs.filter(j => {
          if (j.movement_type !== "delivery") return false;
          const raw = typeof j.raw === "object" && j.raw ? j.raw : {};
          const pc = raw["Location Postc"] || raw["Postcode"] || null;
          const prefix = extractPostcodePrefix(pc);
          if (!prefix) return false;
          return historicalPrefixes ? !historicalPrefixes.has(prefix) : true;
        })
      : jobs;

    const pcMap: Record<string, { prefix: string; zone: string; zoneColor: string; months: number[]; total: number }> = {};
    const zMap: Record<string, { zone: string; zoneColor: string; months: number[]; total: number }> = {};

    for (const job of filteredJobs) {
      if (!job.job_date) continue;
      const monthKey = job.job_date.substring(0, 7);
      const monthIdx = months.indexOf(monthKey);
      if (monthIdx === -1) continue;

      const raw = typeof job.raw === "object" && job.raw ? job.raw : {};
      const postcode = raw["Location Postc"] || raw["Postcode"] || null;
      const prefix = extractPostcodePrefix(postcode);
      if (!prefix) continue;

      const zone = matchZone(prefix, zones);
      const zoneName = zone ? zone.zone_name : "Out of Zones";
      const color = ZONE_COLORS[zoneName] || ZONE_COLORS["Unzoned"];

      if (!pcMap[prefix]) {
        pcMap[prefix] = { prefix, zone: zoneName, zoneColor: color, months: [0, 0, 0], total: 0 };
      }
      pcMap[prefix].months[monthIdx]++;
      pcMap[prefix].total++;

      if (!zMap[zoneName]) {
        zMap[zoneName] = { zone: zoneName, zoneColor: color, months: [0, 0, 0], total: 0 };
      }
      zMap[zoneName].months[monthIdx]++;
      zMap[zoneName].total++;
    }

    const pcTrends = Object.values(pcMap).filter(t => t.total > 0).sort((a, b) => b.total - a.total);
    const zTrends = Object.values(zMap).filter(t => t.total > 0).sort((a, b) => b.total - a.total);

    return { postcodeTrends: pcTrends, zoneTrends: zTrends, monthLabels: labels };
  }, [jobs, zones, newSitesOnly, historicalPrefixes]);

  const postcodeChartData = useMemo(() =>
    postcodeTrends.slice(0, 20).map(t => ({ name: t.prefix, total: t.total, fill: t.zoneColor })),
    [postcodeTrends]
  );

  const zoneChartData = useMemo(() =>
    zoneTrends.map(t => ({ name: t.zone, total: t.total, fill: t.zoneColor })),
    [zoneTrends]
  );

  const chartConfig = { total: { label: "Jobs", color: "hsl(var(--primary))" } };

  if (postcodeTrends.length === 0 && !loadingHistory) {
    return (
      <div className="space-y-4">
        <NewSitesToggle checked={newSitesOnly} onCheckedChange={setNewSitesOnly} loading={loadingHistory} />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {newSitesOnly
              ? "No new delivery sites found in the last 3 months."
              : "No postcode data available for the last 3 months."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NewSitesToggle checked={newSitesOnly} onCheckedChange={setNewSitesOnly} loading={loadingHistory} />

      {loadingHistory ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <Tabs defaultValue="zones">
          <TabsList>
            <TabsTrigger value="zones">
              <MapPin className="h-4 w-4 mr-1.5" /> By Zone
            </TabsTrigger>
            <TabsTrigger value="postcodes">
              <TrendingUp className="h-4 w-4 mr-1.5" /> By Postcode
            </TabsTrigger>
          </TabsList>

          <TabsContent value="zones" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" /> Jobs by Zone — Last 3 Months
                  {newSitesOnly && <Badge variant="secondary" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />New Sites</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="w-full" style={{ height: Math.max(250, zoneChartData.length * 40) }}>
                  <BarChart data={zoneChartData} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={24}>
                      {zoneChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <PostcodeBreakdownTable
              postcodeTrends={zoneTrends.map(z => ({ prefix: z.zone, zone: z.zone, zoneColor: z.zoneColor, months: z.months, total: z.total }))}
              monthLabels={monthLabels}
              label="Zone"
              showZoneColumn={false}
            />
          </TabsContent>

          <TabsContent value="postcodes" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5" />
                  {newSitesOnly ? "New Delivery Sites" : "Top Postcodes"} — Last 3 Months
                  {newSitesOnly && <Badge variant="secondary" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />New Sites</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="w-full" style={{ height: Math.max(300, postcodeChartData.length * 32) }}>
                  <BarChart data={postcodeChartData} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
                      {postcodeChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <PostcodeBreakdownTable postcodeTrends={postcodeTrends} monthLabels={monthLabels} label="Postcode" showZoneColumn />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function NewSitesToggle({ checked, onCheckedChange, loading }: { checked: boolean; onCheckedChange: (v: boolean) => void; loading: boolean }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
      <Sparkles className="h-4 w-4 text-muted-foreground" />
      <Label htmlFor="new-sites-toggle" className="text-sm font-medium cursor-pointer flex-1">
        New Sites Only
        <span className="block text-xs text-muted-foreground font-normal">
          Show only postcodes where we delivered for the first time
        </span>
      </Label>
      <Switch
        id="new-sites-toggle"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={loading}
      />
    </div>
  );
}

type SortField = "total" | "trend";
type SortDir = "asc" | "desc";

function PostcodeBreakdownTable({ postcodeTrends, monthLabels, label = "Postcode", showZoneColumn = true }: { postcodeTrends: { prefix: string; zone: string; zoneColor: string; months: number[]; total: number }[]; monthLabels: string[]; label?: string; showZoneColumn?: boolean }) {
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const withTrend = postcodeTrends.map(t => ({
      ...t,
      trend: t.months[2] - t.months[1],
    }));
    return withTrend.sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      if (sortField === "total") return mul * (a.total - b.total);
      return mul * (a.trend - b.trend);
    });
  }, [postcodeTrends, sortField, sortDir]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{label} Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">{postcodeTrends.length} {label.toLowerCase()}s found</p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>{label}</TableHead>
              {showZoneColumn && <TableHead>Zone</TableHead>}
              {monthLabels.map(ml => (
                <TableHead key={ml} className="text-center">{ml}</TableHead>
              ))}
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs gap-1 hover:bg-transparent" onClick={() => toggleSort("total")}>
                  Total
                  <ChevronsUpDown className={`h-3 w-3 ${sortField === "total" ? "text-foreground" : "text-muted-foreground/50"}`} />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs gap-1 hover:bg-transparent" onClick={() => toggleSort("trend")}>
                  Trend
                  <ChevronsUpDown className={`h-3 w-3 ${sortField === "trend" ? "text-foreground" : "text-muted-foreground/50"}`} />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((t, i) => {
              const diff = t.trend;
              return (
                <TableRow key={t.prefix}>
                  <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                  <TableCell className="font-semibold text-sm">{t.prefix}</TableCell>
                  {showZoneColumn && (
                    <TableCell>
                      <Badge variant="outline" className="text-xs" style={{ borderColor: t.zoneColor, color: t.zoneColor }}>
                        {t.zone}
                      </Badge>
                    </TableCell>
                  )}
                  {t.months.map((m, mi) => (
                    <TableCell key={mi} className="text-center tabular-nums">{m}</TableCell>
                  ))}
                  <TableCell className="text-center font-semibold tabular-nums">{t.total}</TableCell>
                  <TableCell className="text-center">
                    {diff > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-green-600 text-xs font-medium">
                        <ArrowUp className="h-3 w-3" /> {diff}
                      </span>
                    ) : diff < 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-red-500 text-xs font-medium">
                        <ArrowDown className="h-3 w-3" /> {Math.abs(diff)}
                      </span>
                    ) : (
                      <Minus className="h-3 w-3 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
