import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer } from "recharts";
import { Truck, Container, ArrowRightLeft, MapPin, TrendingUp } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";

type Job = {
  id: string;
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  waste_description: string | null;
};

type ContainerCategory = "skip" | "roro" | "artic";

function categoriseContainer(containerType: string | null): ContainerCategory | null {
  if (!containerType) return null;
  const ct = containerType.toLowerCase();
  if (
    ct.includes("curtain side") ||
    ct.includes("walking floor") ||
    ct.includes("bulk ejector") ||
    ct.includes("artic haulage")
  ) return "artic";
  if (ct.includes("ro ro") || ct.includes("roll on roll off") || ct.includes("ro ro haulage")) return "roro";
  if (
    ct.includes("skip") ||
    ct.includes("yard") ||
    ct.includes("yd") ||
    ct.includes("chain lift")
  ) {
    // Exclude if it's actually a RoRo
    if (ct.includes("ro ro") || ct.includes("roll on")) return "roro";
    return "skip";
  }
  return null;
}

function isDelivery(m: string | null) { return m === "Deliver"; }
function isCollection(m: string | null) { return m === "Collect"; }
function isExchange(m: string | null) { return m === "Exchange"; }

export default function LiveJobsDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      // Fetch last 12 months of skiptrak data
      const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      let allJobs: Job[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("id,job_number,job_date,customer,site,container_type,movement_type,waste_description")
          .eq("source", "skiptrak")
          .gte("job_date", since)
          .in("movement_type", ["Deliver", "Exchange", "Collect"])
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

  // ── Compute live containers (net on-site per customer+site) ──
  const { liveSites, liveCounts, monthlyData, recentActivity } = useMemo(() => {
    // Track net containers per customer+site+category
    const siteMap: Record<string, { customer: string; site: string; category: ContainerCategory; delivered: number; collected: number; exchanged: number; containerTypes: Set<string> }> = {};

    const monthlyMap: Record<string, { month: string; deliveries: number; exchanges: number; collections: number }> = {};
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 30);

    const recentJobs: Job[] = [];

    for (const job of jobs) {
      const cat = categoriseContainer(job.container_type);
      if (!cat) continue;

      const key = `${job.customer || "Unknown"}|||${job.site || "Unknown"}|||${cat}`;

      if (!siteMap[key]) {
        siteMap[key] = {
          customer: job.customer || "Unknown",
          site: job.site || "Unknown",
          category: cat,
          delivered: 0,
          collected: 0,
          exchanged: 0,
          containerTypes: new Set(),
        };
      }

      if (job.container_type) siteMap[key].containerTypes.add(job.container_type);

      if (isDelivery(job.movement_type)) siteMap[key].delivered++;
      if (isCollection(job.movement_type)) siteMap[key].collected++;
      if (isExchange(job.movement_type)) siteMap[key].exchanged++;

      // Monthly chart data
      if (job.job_date) {
        const monthKey = job.job_date.substring(0, 7);
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { month: monthKey, deliveries: 0, exchanges: 0, collections: 0 };
        }
        if (isDelivery(job.movement_type)) monthlyMap[monthKey].deliveries++;
        if (isExchange(job.movement_type)) monthlyMap[monthKey].exchanges++;
        if (isCollection(job.movement_type)) monthlyMap[monthKey].collections++;
      }

      // Recent activity
      if (job.job_date && new Date(job.job_date) >= recentCutoff) {
        recentJobs.push(job);
      }
    }

    // Sites with net containers on-site
    // A site is "live" if it has net deliveries > collections OR has had exchanges (container swap = still on-site)
    const live = Object.values(siteMap)
      .map(s => {
        const netFromDeliveries = s.delivered - s.collected;
        // If a site only has exchanges (no standalone deliver/collect), it's still live
        const isLive = netFromDeliveries > 0 || (s.exchanged > 0 && netFromDeliveries >= 0);
        const netOnSite = Math.max(netFromDeliveries, netFromDeliveries >= 0 && s.exchanged > 0 ? Math.max(1, netFromDeliveries) : 0);
        return { ...s, netOnSite, containerTypes: Array.from(s.containerTypes) };
      })
      .filter(s => s.netOnSite > 0)
      .sort((a, b) => b.netOnSite - a.netOnSite);

    // Counts by category
    const counts = { skip: 0, roro: 0, artic: 0, totalSites: new Set<string>() };
    for (const s of live) {
      counts[s.category] += s.netOnSite;
      counts.totalSites.add(`${s.customer}|||${s.site}`);
    }

    // Monthly sorted
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    return {
      liveSites: live,
      liveCounts: { skip: counts.skip, roro: counts.roro, artic: counts.artic, totalSites: counts.totalSites.size },
      monthlyData: monthly,
      recentActivity: recentJobs.slice(0, 100),
    };
  }, [jobs]);

  const skipSites = useMemo(() => liveSites.filter(s => s.category === "skip"), [liveSites]);
  const roroSites = useMemo(() => liveSites.filter(s => s.category === "roro"), [liveSites]);
  const articSites = useMemo(() => liveSites.filter(s => s.category === "artic"), [liveSites]);

  const chartConfig = {
    deliveries: { label: "Deliveries", color: "hsl(var(--primary))" },
    exchanges: { label: "Exchanges", color: "hsl(var(--accent))" },
    collections: { label: "Collections", color: "hsl(var(--destructive))" },
  };

  const barConfig = {
    skip: { label: "Skips", color: "hsl(142 76% 36%)" },
    roro: { label: "RoRos", color: "hsl(217 91% 60%)" },
    artic: { label: "Artics", color: "hsl(45 93% 47%)" },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Live Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{liveCounts.totalSites}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Container className="h-4 w-4" /> Skips On-Site
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{liveCounts.skip}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" /> RoRos On-Site
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{liveCounts.roro}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Artics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{liveCounts.artic}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly Line Chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" /> Monthly Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={(v: string) => {
                const [y, m] = v.split("-");
                return format(new Date(+y, +m - 1), "MMM yy");
              }} />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="deliveries" stroke="var(--color-deliveries)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="exchanges" stroke="var(--color-exchanges)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="collections" stroke="var(--color-collections)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ── Detail Tabs ── */}
      <Tabs defaultValue="skips" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="skips">Skips ({skipSites.length})</TabsTrigger>
          <TabsTrigger value="roros">RoRos ({roroSites.length})</TabsTrigger>
          <TabsTrigger value="artics">Artics ({articSites.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="skips">
          <SiteTable sites={skipSites} label="Skip" />
        </TabsContent>
        <TabsContent value="roros">
          <SiteTable sites={roroSites} label="RoRo" />
        </TabsContent>
        <TabsContent value="artics">
          <SiteTable sites={articSites} label="Artic" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SiteTable({ sites, label }: { sites: Array<{ customer: string; site: string; netOnSite: number; delivered: number; collected: number; exchanged: number; containerTypes: string[] }>; label: string }) {
  if (sites.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No {label} containers currently estimated on-site.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-center">On-Site</TableHead>
              <TableHead className="text-center">Delivered</TableHead>
              <TableHead className="text-center">Exchanged</TableHead>
              <TableHead className="text-center">Collected</TableHead>
              <TableHead>Container Types</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{s.customer}</TableCell>
                <TableCell>{s.site}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="default">{s.netOnSite}</Badge>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">{s.delivered}</TableCell>
                <TableCell className="text-center text-muted-foreground">{s.exchanged}</TableCell>
                <TableCell className="text-center text-muted-foreground">{s.collected}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {s.containerTypes.slice(0, 3).map(ct => (
                      <Badge key={ct} variant="outline" className="text-xs">{ct}</Badge>
                    ))}
                    {s.containerTypes.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{s.containerTypes.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
