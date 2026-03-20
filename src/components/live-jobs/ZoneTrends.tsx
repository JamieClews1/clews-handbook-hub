import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { TrendingUp, ArrowUp, ArrowDown, Minus, ArrowUpDown, ChevronsUpDown } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
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

// Zone colours
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
};

interface ZoneTrendsProps {
  jobs: RawJob[];
  zones: PostcodeZone[];
}

export default function ZoneTrends({ jobs, zones }: ZoneTrendsProps) {
  const { postcodeTrends, monthLabels } = useMemo(() => {
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

    // Collect per-postcode-prefix, per-month
    const map: Record<string, { prefix: string; zone: string; zoneColor: string; months: number[]; total: number }> = {};

    for (const job of jobs) {
      if (!job.job_date) continue;
      const monthKey = job.job_date.substring(0, 7);
      const monthIdx = months.indexOf(monthKey);
      if (monthIdx === -1) continue;

      const raw = typeof job.raw === "object" && job.raw ? job.raw : {};
      const postcode = raw["Location Postc"] || raw["Postcode"] || null;
      const prefix = extractPostcodePrefix(postcode);
      if (!prefix) continue;

      if (!map[prefix]) {
        const zone = matchZone(prefix, zones);
        const zoneName = zone ? zone.zone_name : "Out of Zones";
        map[prefix] = {
          prefix,
          zone: zoneName,
          zoneColor: ZONE_COLORS[zoneName] || ZONE_COLORS["Unzoned"],
          months: [0, 0, 0],
          total: 0,
        };
      }
      map[prefix].months[monthIdx]++;
      map[prefix].total++;
    }

    // Sort by total descending
    const trends = Object.values(map)
      .filter(t => t.total > 0)
      .sort((a, b) => b.total - a.total);

    return { postcodeTrends: trends, monthLabels: labels };
  }, [jobs, zones]);

  // Top 20 for chart
  const chartData = useMemo(() =>
    postcodeTrends.slice(0, 20).map(t => ({
      prefix: t.prefix,
      total: t.total,
      fill: t.zoneColor,
    })),
    [postcodeTrends]
  );

  const chartConfig = { total: { label: "Jobs", color: "hsl(var(--primary))" } };

  if (postcodeTrends.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No postcode data available for the last 3 months.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Horizontal bar chart — top 20 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" /> Top Postcodes — Last 3 Months
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="w-full" style={{ height: Math.max(300, chartData.length * 32) }}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="prefix" width={55} tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Full table */}
      <PostcodeBreakdownTable postcodeTrends={postcodeTrends} monthLabels={monthLabels} />
    </div>
  );
}

type SortField = "total" | "trend";
type SortDir = "asc" | "desc";

function PostcodeBreakdownTable({ postcodeTrends, monthLabels }: { postcodeTrends: ZoneTrendsProps["jobs"] extends any ? typeof postcodeTrends : never; monthLabels: string[] }) {
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
        <CardTitle className="text-lg">Postcode Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">{postcodeTrends.length} postcodes found</p>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Zone</TableHead>
              {monthLabels.map(ml => (
                <TableHead key={ml} className="text-center">{ml}</TableHead>
              ))}
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-semibold text-xs gap-1 hover:bg-transparent"
                  onClick={() => toggleSort("total")}
                >
                  Total
                  <ChevronsUpDown className={`h-3 w-3 ${sortField === "total" ? "text-foreground" : "text-muted-foreground/50"}`} />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-semibold text-xs gap-1 hover:bg-transparent"
                  onClick={() => toggleSort("trend")}
                >
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
                  <TableCell className="font-mono font-semibold text-sm">{t.prefix}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: t.zoneColor, color: t.zoneColor }}
                    >
                      {t.zone}
                    </Badge>
                  </TableCell>
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
    </div>
  );
}
