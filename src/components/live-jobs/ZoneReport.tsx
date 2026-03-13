import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { MapPin } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import type { PostcodeZone } from "@/hooks/usePostcodeZones";

type Job = {
  job_date: string | null;
  tipping_location: string | null;
  raw: any;
  movement_type: string | null;
  weight_t: number | null;
};

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
const POSTCODE_PREFIX_RE = /^([A-Z]{1,2}\d+\s*\d?)/i;

function extractPostcodePrefix(location: string | null | undefined): string | null {
  if (!location) return null;
  const match = location.match(UK_POSTCODE_RE);
  if (!match) return null;
  const full = match[1].toUpperCase().replace(/\s+/g, " ").trim();
  // Return the district-level prefix e.g. "CV21 1" from "CV21 1AB"
  // Match the format used in zones: letter(s) + digits + space + digit
  const parts = full.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1].charAt(0)}`;
  }
  return parts[0];
}

function matchZone(location: string | null | undefined, rawLocation: string | null | undefined, zones: PostcodeZone[]): PostcodeZone | null {
  const prefix = extractPostcodePrefix(location) || extractPostcodePrefix(rawLocation);
  if (!prefix) return null;

  for (const zone of zones) {
    if (zone.postcodes.some(zp => prefix.toUpperCase().startsWith(zp.toUpperCase().replace(/\s+/g, " ").trim()))) {
      return zone;
    }
  }
  return null;
}

export default function ZoneReport({ zones }: { zones: PostcodeZone[] }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      const since = format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd");
      let allJobs: Job[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date,tipping_location,raw,movement_type,weight_t")
          .eq("source", "skiptrak")
          .gte("job_date", since)
          .order("job_date", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) { console.error(error); break; }
        allJobs = allJobs.concat((data ?? []) as Job[]);
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }

      setJobs(allJobs);
      setLoading(false);
    };
    fetchJobs();
  }, []);

  const { zoneData, monthLabels } = useMemo(() => {
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

    // Zone -> month -> { jobs, value }
    const map: Record<string, Record<string, { jobs: number; value: number }>> = {};
    // Include "Unzoned" for unmatched
    const allZoneNames = [...zones.map(z => z.zone_name), "Unzoned"];
    for (const name of allZoneNames) {
      map[name] = {};
      for (const m of months) {
        map[name][m] = { jobs: 0, value: 0 };
      }
    }

    for (const job of jobs) {
      if (!job.job_date) continue;
      const monthKey = job.job_date.substring(0, 7);
      if (!months.includes(monthKey)) continue;

      const rawLoc = typeof job.raw === "object" && job.raw ? (job.raw as any).Location : null;
      const zone = matchZone(job.tipping_location, rawLoc, zones);
      const zoneName = zone ? zone.zone_name : "Unzoned";

      if (!map[zoneName]) {
        map[zoneName] = {};
        for (const m of months) map[zoneName][m] = { jobs: 0, value: 0 };
      }

      map[zoneName][monthKey].jobs++;
      map[zoneName][monthKey].value += Math.abs(job.weight_t ?? 0);
    }

    const data = Object.entries(map).map(([zoneName, monthData]) => {
      const totalJobs = Object.values(monthData).reduce((s, v) => s + v.jobs, 0);
      const totalValue = Object.values(monthData).reduce((s, v) => s + v.value, 0);
      return {
        zone: zoneName,
        ...Object.fromEntries(months.map((m, i) => [`month${i}_jobs`, monthData[m]?.jobs ?? 0])),
        ...Object.fromEntries(months.map((m, i) => [`month${i}_value`, +(monthData[m]?.value ?? 0).toFixed(2)])),
        totalJobs,
        totalValue: +totalValue.toFixed(2),
      };
    }).filter(d => d.totalJobs > 0)
      .sort((a, b) => b.totalJobs - a.totalJobs);

    return { zoneData: data, monthLabels: labels };
  }, [jobs, zones]);

  const chartData = useMemo(() =>
    zoneData.map(d => ({
      zone: d.zone,
      [monthLabels[0]]: (d as any).month0_jobs,
      [monthLabels[1]]: (d as any).month1_jobs,
      [monthLabels[2]]: (d as any).month2_jobs,
    })), [zoneData, monthLabels]);

  const chartConfig = useMemo(() => ({
    [monthLabels[0]]: { label: monthLabels[0], color: "hsl(var(--primary))" },
    [monthLabels[1]]: { label: monthLabels[1], color: "hsl(var(--accent))" },
    [monthLabels[2]]: { label: monthLabels[2], color: "hsl(var(--secondary))" },
  }), [monthLabels]);

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
    <div className="space-y-6">
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
              {monthLabels.map((ml, i) => (
                <Bar key={ml} dataKey={ml} fill={`var(--color-${ml.replace(/\s/g, "-")})`} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Zone Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                {monthLabels.map(ml => (
                  <TableHead key={ml} className="text-center" colSpan={2}>{ml}</TableHead>
                ))}
                <TableHead className="text-center" colSpan={2}>Total</TableHead>
              </TableRow>
              <TableRow>
                <TableHead />
                {monthLabels.map(ml => (
                  <>
                    <TableHead key={`${ml}-j`} className="text-center text-xs">Jobs</TableHead>
                    <TableHead key={`${ml}-t`} className="text-center text-xs">Tonnes</TableHead>
                  </>
                ))}
                <TableHead className="text-center text-xs">Jobs</TableHead>
                <TableHead className="text-center text-xs">Tonnes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zoneData.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">
                    <Badge variant={d.zone === "Unzoned" ? "outline" : "default"}>{d.zone}</Badge>
                  </TableCell>
                  {[0, 1, 2].map(mi => (
                    <>
                      <TableCell key={`${mi}-j`} className="text-center">{(d as any)[`month${mi}_jobs`]}</TableCell>
                      <TableCell key={`${mi}-v`} className="text-center text-muted-foreground">{(d as any)[`month${mi}_value`]?.toFixed(1)}</TableCell>
                    </>
                  ))}
                  <TableCell className="text-center font-semibold">{d.totalJobs}</TableCell>
                  <TableCell className="text-center font-semibold text-muted-foreground">{d.totalValue.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
