import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer } from "recharts";
import { Truck, Container, ArrowRightLeft, MapPin, TrendingUp, AlertTriangle } from "lucide-react";
import { format, startOfMonth, subMonths, differenceInDays } from "date-fns";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

type Job = {
  id: string;
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  waste_description: string | null;
  vehicle_registration: string | null;
};

type ContainerCategory = "skip" | "roro" | "artic";

function categoriseContainer(
  containerType: string | null,
  vehicleReg: string | null,
  settings: LiveJobsSettings
): ContainerCategory | null {
  // Check vehicle reg first for artic identification
  if (vehicleReg) {
    const vr = vehicleReg.toUpperCase().replace(/\s+/g, "");
    if (settings.artic_vehicle_regs.some(r => r.replace(/\s+/g, "").toUpperCase() === vr)) return "artic";
  }

  if (!containerType) return null;
  const ct = containerType.toLowerCase();

  // Check artic keywords
  if (settings.artic_container_keywords.some(kw => ct.includes(kw.toLowerCase()))) return "artic";

  // Check roro keywords
  if (settings.roro_container_keywords.some(kw => ct.includes(kw.toLowerCase()))) return "roro";

  // Check skip keywords (but roro takes priority)
  if (settings.skip_container_keywords.some(kw => ct.includes(kw.toLowerCase()))) {
    // Double-check it's not actually roro
    if (settings.roro_container_keywords.some(kw => ct.includes(kw.toLowerCase()))) return "roro";
    return "skip";
  }
  return null;
}

function isDelivery(m: string | null) { return m === "Deliver"; }
function isCollection(m: string | null) { return m === "Collect"; }
function isExchange(m: string | null) { return m === "Exchange"; }

export default function LiveJobsDashboard({ settings }: { settings: LiveJobsSettings }) {
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
          .select("id,job_number,job_date,customer,site,container_type,movement_type,waste_description,vehicle_registration")
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
  const { liveSites, liveCounts, monthlyData, recentActivity, overRentalSites } = useMemo(() => {
    // Track net containers per site+category (ignoring customer name variations)
    const siteMap: Record<string, { customers: Set<string>; latestCustomer: string; latestCustomerDate: string | null; site: string; category: ContainerCategory; delivered: number; collected: number; exchanged: number; lastDeliveryOrExchangeDate: string | null; lastCollectionDate: string | null; containerTypes: Set<string> }> = {};

    const monthlyMap: Record<string, { month: string; deliveries: number; exchanges: number; collections: number }> = {};
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 30);

    const recentJobs: Job[] = [];

    for (const job of jobs) {
      const cat = categoriseContainer(job.container_type, job.vehicle_registration, settings);
      if (!cat) continue;

      // Group by site+category only, merging all customer name variants
      const key = `${(job.site || "Unknown").toLowerCase().trim()}|||${cat}`;
      const customerName = job.customer || "Unknown";

      if (!siteMap[key]) {
        siteMap[key] = {
          customers: new Set(),
          latestCustomer: customerName,
          latestCustomerDate: job.job_date,
          site: job.site || "Unknown",
          category: cat,
          delivered: 0,
          collected: 0,
          exchanged: 0,
          lastDeliveryOrExchangeDate: null,
          lastCollectionDate: null,
          containerTypes: new Set(),
        };
      }

      siteMap[key].customers.add(customerName);
      // Track the most recent customer name for display
      if (job.job_date && (!siteMap[key].latestCustomerDate || job.job_date > siteMap[key].latestCustomerDate!)) {
        siteMap[key].latestCustomer = customerName;
        siteMap[key].latestCustomerDate = job.job_date;
      }

      if (job.container_type) siteMap[key].containerTypes.add(job.container_type);

      if (isDelivery(job.movement_type)) siteMap[key].delivered++;
      if (isCollection(job.movement_type)) siteMap[key].collected++;
      if (isExchange(job.movement_type)) siteMap[key].exchanged++;

      // Track last delivery/exchange date (rental clock starts here)
      if (job.job_date && (isDelivery(job.movement_type) || isExchange(job.movement_type))) {
        if (!siteMap[key].lastDeliveryOrExchangeDate || job.job_date > siteMap[key].lastDeliveryOrExchangeDate!) {
          siteMap[key].lastDeliveryOrExchangeDate = job.job_date;
        }
      }
      // Track last collection date
      if (job.job_date && isCollection(job.movement_type)) {
        if (!siteMap[key].lastCollectionDate || job.job_date > siteMap[key].lastCollectionDate!) {
          siteMap[key].lastCollectionDate = job.job_date;
        }
      }

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
    const live = Object.values(siteMap)
      .map(s => {
        const netFromDeliveries = s.delivered - s.collected;
        const totalMovements = s.delivered + s.collected + s.exchanged;
        // Artics (waste trucks) don't stay on-site, so count sites visited instead
        const netOnSite = s.category === "artic"
          ? totalMovements  // For artics, this represents visit count
          : Math.max(netFromDeliveries, netFromDeliveries >= 0 && s.exchanged > 0 ? Math.max(1, netFromDeliveries) : 0);
        const daysSinceDeliveryOrExchange = s.lastDeliveryOrExchangeDate ? differenceInDays(new Date(), new Date(s.lastDeliveryOrExchangeDate)) : null;
        const collectionClearedIt = s.lastCollectionDate && s.lastDeliveryOrExchangeDate && s.lastCollectionDate >= s.lastDeliveryOrExchangeDate;
        const isOverRental = s.category !== "artic" && daysSinceDeliveryOrExchange !== null && daysSinceDeliveryOrExchange > settings.rental_free_days && netOnSite > 0 && !collectionClearedIt;
        return { ...s, customer: s.latestCustomer, netOnSite, daysSinceActivity: daysSinceDeliveryOrExchange, lastActivityDate: s.lastDeliveryOrExchangeDate, isOverRental, containerTypes: Array.from(s.containerTypes) };
      })
      .filter(s => s.category === "artic" ? s.netOnSite > 0 : s.netOnSite > 0)
      .sort((a, b) => b.netOnSite - a.netOnSite);

    // Counts by category
    const counts = { skip: 0, roro: 0, artic: 0, totalSites: new Set<string>() };
    for (const s of live) {
      if (s.category === "artic") {
        counts.artic++; // Count sites visited, not containers
      } else {
        counts[s.category] += s.netOnSite;
      }
      counts.totalSites.add(s.site);
    }

    // Monthly sorted
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

    // Over rental sites
    const overRental = live
      .filter(s => s.isOverRental)
      .sort((a, b) => (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0));

    return {
      liveSites: live,
      liveCounts: { skip: counts.skip, roro: counts.roro, artic: counts.artic, totalSites: counts.totalSites.size },
      monthlyData: monthly,
      recentActivity: recentJobs.slice(0, 100),
      overRentalSites: overRental,
    };
  }, [jobs, settings]);

  const skipSites = useMemo(() => liveSites.filter(s => s.category === "skip"), [liveSites]);
  const roroSites = useMemo(() => liveSites.filter(s => s.category === "roro"), [liveSites]);
  const sixMonthsAgo = useMemo(() => format(subMonths(new Date(), settings.waste_truck_months), "yyyy-MM-dd"), [settings.waste_truck_months]);
  const wasteTruckSites = useMemo(() => liveSites.filter(s => s.category === "artic" && s.lastActivityDate && s.lastActivityDate >= sixMonthsAgo), [liveSites, sixMonthsAgo]);

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <ArrowRightLeft className="h-4 w-4" /> Waste Truck Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{wasteTruckSites.length}</p>
            <p className="text-xs text-muted-foreground">Visited in last {settings.waste_truck_months} months</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Over Rental
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{overRentalSites.length}</p>
            <p className="text-xs text-muted-foreground">Sites over {settings.rental_free_days} days</p>
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
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="skips">Skips ({skipSites.length})</TabsTrigger>
          <TabsTrigger value="roros">RoRos ({roroSites.length})</TabsTrigger>
          <TabsTrigger value="artics">Waste Truck ({wasteTruckSites.length})</TabsTrigger>
          <TabsTrigger value="over-rental" className="text-destructive">
            Over Rental ({overRentalSites.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skips">
          <SiteTable sites={skipSites} label="Skip" />
        </TabsContent>
        <TabsContent value="roros">
          <SiteTable sites={roroSites} label="RoRo" />
        </TabsContent>
        <TabsContent value="artics">
          <SiteTable sites={wasteTruckSites} label="Waste Truck" />
        </TabsContent>
        <TabsContent value="over-rental">
          <OverRentalTable sites={overRentalSites} />
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

type OverRentalSite = {
  customer: string;
  site: string;
  category: ContainerCategory;
  netOnSite: number;
  daysSinceActivity: number | null;
  lastActivityDate: string | null;
  containerTypes: string[];
};

function OverRentalTable({ sites }: { sites: OverRentalSite[] }) {
  if (sites.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No sites are currently over the rental free period. 🎉
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Sites Over Free Rental ({sites.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          These sites have not had a collection or exchange within the rental free period. Rental charges may apply.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">On-Site</TableHead>
              <TableHead className="text-center">Days Since Activity</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Container Types</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map((s, i) => (
              <TableRow key={i} className="bg-destructive/5">
                <TableCell className="font-medium">{s.customer}</TableCell>
                <TableCell>{s.site}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{s.category}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="default">{s.netOnSite}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="destructive">{s.daysSinceActivity} days</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.lastActivityDate ? format(new Date(s.lastActivityDate), "dd MMM yyyy") : "—"}
                </TableCell>
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
