import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, ResponsiveContainer } from "recharts";
import { Truck, Container, ArrowRightLeft, MapPin, TrendingUp, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
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
  const ct = containerType?.toLowerCase() ?? "";

  // Check container type keywords FIRST — these are the most reliable signal
  const isSkip = ct && settings.skip_container_keywords.some(kw => ct.includes(kw.toLowerCase()));
  const isRoro = ct && settings.roro_container_keywords.some(kw => ct.includes(kw.toLowerCase()));
  const isArticContainer = ct && settings.artic_container_keywords.some(kw => ct.includes(kw.toLowerCase()));

  // If container type clearly identifies skip or roro, use that regardless of vehicle
  if (isRoro) return "roro";
  if (isSkip) return "skip";
  if (isArticContainer) return "artic";

  // Fall back to vehicle reg only when container type is empty or unrecognised
  if (vehicleReg) {
    const vr = vehicleReg.toUpperCase().replace(/\s+/g, "");
    if (settings.artic_vehicle_regs.some(r => r.replace(/\s+/g, "").toUpperCase() === vr)) return "artic";
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
    const siteMap: Record<string, { customers: Set<string>; latestCustomer: string; latestCustomerDate: string | null; site: string; category: ContainerCategory; delivered: number; collected: number; exchanged: number; lastDeliveryOrExchangeDate: string | null; lastCollectionDate: string | null; containerTypes: Set<string>; wasteTypes: Set<string>; containerTypeBreakdown: Record<string, { delivered: number; collected: number; exchanged: number; lastDeliveryOrExchangeDate: string | null; lastCollectionDate: string | null; wasteTypes: Set<string> }> }> = {};

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
          wasteTypes: new Set(),
          containerTypeBreakdown: {},
        };
      }

      siteMap[key].customers.add(customerName);
      // Track the most recent customer name for display
      if (job.job_date && (!siteMap[key].latestCustomerDate || job.job_date > siteMap[key].latestCustomerDate!)) {
        siteMap[key].latestCustomer = customerName;
        siteMap[key].latestCustomerDate = job.job_date;
      }

      if (job.container_type) {
        siteMap[key].containerTypes.add(job.container_type);
        if (!siteMap[key].containerTypeBreakdown[job.container_type]) {
          siteMap[key].containerTypeBreakdown[job.container_type] = { delivered: 0, collected: 0, exchanged: 0, lastDeliveryOrExchangeDate: null, lastCollectionDate: null, wasteTypes: new Set() };
        }
        const ctb = siteMap[key].containerTypeBreakdown[job.container_type];
        if (isDelivery(job.movement_type)) ctb.delivered++;
        if (isCollection(job.movement_type)) ctb.collected++;
        if (isExchange(job.movement_type)) ctb.exchanged++;
        if (job.waste_description) ctb.wasteTypes.add(job.waste_description);
        if (job.job_date && (isDelivery(job.movement_type) || isExchange(job.movement_type))) {
          if (!ctb.lastDeliveryOrExchangeDate || job.job_date > ctb.lastDeliveryOrExchangeDate) {
            ctb.lastDeliveryOrExchangeDate = job.job_date;
          }
        }
        if (job.job_date && isCollection(job.movement_type)) {
          if (!ctb.lastCollectionDate || job.job_date > ctb.lastCollectionDate) {
            ctb.lastCollectionDate = job.job_date;
          }
        }
      }

      if (job.waste_description) siteMap[key].wasteTypes.add(job.waste_description);


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
        const collectionClearedIt = s.lastCollectionDate && s.lastDeliveryOrExchangeDate && s.lastCollectionDate >= s.lastDeliveryOrExchangeDate;
        // Artics (waste trucks) don't stay on-site, so count sites visited instead
        let netOnSite: number;
        if (s.category === "artic") {
          netOnSite = totalMovements; // For artics, this represents visit count
        } else if (collectionClearedIt && netFromDeliveries <= 0) {
          // Last action was a collection and all deliveries are accounted for — site is clear
          netOnSite = 0;
        } else {
          // If there are exchanges and net >= 0, at least 1 container is on-site
          netOnSite = Math.max(netFromDeliveries, netFromDeliveries >= 0 && s.exchanged > 0 ? Math.max(1, netFromDeliveries) : 0);
        }
        const daysSinceDeliveryOrExchange = s.lastDeliveryOrExchangeDate ? differenceInDays(new Date(), new Date(s.lastDeliveryOrExchangeDate)) : null;
        const isOverRental = s.category !== "artic" && daysSinceDeliveryOrExchange !== null && daysSinceDeliveryOrExchange > settings.rental_free_days && netOnSite > 0 && !collectionClearedIt;
        return { ...s, customer: s.latestCustomer, netOnSite, daysSinceActivity: daysSinceDeliveryOrExchange, lastActivityDate: s.lastDeliveryOrExchangeDate, isOverRental, containerTypes: Array.from(s.containerTypes), wasteTypes: Array.from(s.wasteTypes) };
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

    // Over rental — one row per (site × container type) that is genuinely over rental
    const overRental: OverRentalSite[] = [];
    for (const s of live) {
      if (s.category === "artic") continue;
      if (!s.isOverRental) continue;
      for (const [containerType, ctb] of Object.entries(s.containerTypeBreakdown)) {
        const netForType = ctb.delivered - ctb.collected;
        const clearedForType = ctb.lastCollectionDate && ctb.lastDeliveryOrExchangeDate && ctb.lastCollectionDate >= ctb.lastDeliveryOrExchangeDate;
        const onSiteForType = clearedForType && netForType <= 0
          ? 0
          : Math.max(netForType, netForType >= 0 && ctb.exchanged > 0 ? Math.max(1, netForType) : 0);
        if (onSiteForType <= 0) continue;
        const days = ctb.lastDeliveryOrExchangeDate ? differenceInDays(new Date(), new Date(ctb.lastDeliveryOrExchangeDate)) : null;
        if (days === null || days <= settings.rental_free_days) continue;
        overRental.push({
          customer: s.customer,
          site: s.site,
          category: s.category,
          containerType,
          netOnSite: onSiteForType,
          daysSinceActivity: days,
          lastActivityDate: ctb.lastDeliveryOrExchangeDate,
        });
      }
    }
    overRental.sort((a, b) => (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0));

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

  function downloadLiveJobsExcel() {
    const wb = XLSX.utils.book_new();

    const categories: { key: ContainerCategory; label: string }[] = [
      { key: "skip", label: "Skips" },
      { key: "roro", label: "RoRos" },
      { key: "artic", label: "Waste Trucks" },
    ];

    const allRows: Record<string, string | number>[] = [];

    for (const { key, label } of categories) {
      const filtered = liveSites.filter(s => s.category === key);
      const rows: Record<string, string | number>[] = [];
      for (const s of filtered) {
        if (key === "artic") {
          rows.push({
            Customer: s.customer,
            Site: s.site,
            "Container Type": s.containerTypes.join(", "),
            "Waste Type": s.wasteTypes.join(", "),
            Visits: s.netOnSite,
            Delivered: s.delivered,
            Exchanged: s.exchanged,
            Collected: s.collected,
            "Days Since Activity": s.daysSinceActivity ?? "",
            "Last Activity": s.lastActivityDate ? format(new Date(s.lastActivityDate), "dd MMM yyyy") : "",
          });
        } else {
          // Get the breakdown from the original siteMap data
          const breakdownEntries = Object.entries(s.containerTypeBreakdown || {});
          if (breakdownEntries.length === 0) {
            rows.push({
              Customer: s.customer,
              Site: s.site,
              "Container Type": "Unknown",
              "Waste Type": s.wasteTypes.join(", "),
              "Net On-Site": s.netOnSite,
              Delivered: s.delivered,
              Exchanged: s.exchanged,
              Collected: s.collected,
              "Days Since Activity": s.daysSinceActivity ?? "",
              "Last Activity": s.lastActivityDate ? format(new Date(s.lastActivityDate), "dd MMM yyyy") : "",
              "Over Rental": s.isOverRental ? "Yes" : "No",
            });
          } else {
            const rowsBefore = rows.length;
            for (const [ctName, ctCounts] of breakdownEntries) {
              const ctLast = ctCounts.lastDeliveryOrExchangeDate;
              const ctCleared = ctCounts.lastCollectionDate && ctLast && ctCounts.lastCollectionDate >= ctLast;
              const netForType = ctCounts.delivered - ctCounts.collected;
              // Mirror the dashboard's on-site logic: a type with exchanges and net >= 0
              // keeps at least 1 container on-site, and a type cleared by a later
              // collection is treated as empty.
              const onSiteForType = ctCleared && netForType <= 0
                ? 0
                : Math.max(netForType, netForType >= 0 && ctCounts.exchanged > 0 ? Math.max(1, netForType) : 0);
              if (onSiteForType <= 0 && breakdownEntries.length > 1) continue; // skip cleared container types
              const ctDays = ctLast ? differenceInDays(new Date(), new Date(ctLast)) : null;
              const ctOverRental = s.category !== "artic" && ctDays !== null && ctDays > settings.rental_free_days && onSiteForType > 0 && !ctCleared;
              rows.push({
                Customer: s.customer,
                Site: s.site,
                "Container Type": ctName,
                "Waste Type": Array.from(ctCounts.wasteTypes).join(", "),
                "Net On-Site": onSiteForType,
                Delivered: ctCounts.delivered,
                Exchanged: ctCounts.exchanged,
                Collected: ctCounts.collected,
                "Days Since Activity": ctDays ?? "",
                "Last Activity": ctLast ? format(new Date(ctLast), "dd MMM yyyy") : "",
                "Over Rental": ctOverRental ? "Yes" : "No",
              });
            }
            // Guarantee every live site appears, even if no single container type
            // resolved to a positive on-site count (matches the dashboard cards).
            if (rows.length === rowsBefore) {
              rows.push({
                Customer: s.customer,
                Site: s.site,
                "Container Type": s.containerTypes.join(", ") || "Unknown",
                "Waste Type": s.wasteTypes.join(", "),
                "Net On-Site": s.netOnSite,
                Delivered: s.delivered,
                Exchanged: s.exchanged,
                Collected: s.collected,
                "Days Since Activity": s.daysSinceActivity ?? "",
                "Last Activity": s.lastActivityDate ? format(new Date(s.lastActivityDate), "dd MMM yyyy") : "",
                "Over Rental": s.isOverRental ? "Yes" : "No",
              });
            }
          }
        }
      }
      // Add to the combined sheet with a Category column (Visits maps to Net On-Site)
      for (const r of rows) {
        const { Visits, ...rest } = r as Record<string, string | number>;
        allRows.push({
          Category: label,
          ...rest,
          ...(Visits !== undefined ? { "Net On-Site": Visits } : {}),
        });
      }
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
      XLSX.utils.book_append_sheet(wb, ws, label);
    }

    // Combined "All Live Containers" sheet as the first tab so nothing looks missing
    const allWs = XLSX.utils.json_to_sheet(allRows.length > 0 ? allRows : [{}]);
    XLSX.utils.book_append_sheet(wb, allWs, "All Live Containers");
    // Move the combined sheet to the front
    wb.SheetNames = ["All Live Containers", ...wb.SheetNames.filter(n => n !== "All Live Containers")];

    XLSX.writeFile(wb, `Live_Jobs_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="flex items-center justify-between mb-2">
        <div />
        <Button variant="outline" size="sm" onClick={downloadLiveJobsExcel}>
          <Download className="h-4 w-4 mr-1" /> Export All
        </Button>
      </div>
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

type SortField = "customer" | "site" | "netOnSite" | "delivered" | "exchanged" | "collected" | "containerType";
type SortDir = "asc" | "desc";

function extractBinSize(containerType: string): number {
  const match = containerType.match(/(\d+)\s*(?:yard|yd|cu)/i);
  if (match) return parseInt(match[1], 10);
  const numMatch = containerType.match(/^(\d+)/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return 0;
}

function primaryContainerSize(containerTypes: string[]): number {
  if (containerTypes.length === 0) return 0;
  return Math.max(...containerTypes.map(extractBinSize));
}

function SiteTable({ sites, label }: { sites: Array<{ customer: string; site: string; netOnSite: number; delivered: number; collected: number; exchanged: number; containerTypes: string[]; wasteTypes: string[]; containerTypeBreakdown: Record<string, { delivered: number; collected: number; exchanged: number }> }>; label: string }) {
  const [sortField, setSortField] = useState<SortField>("netOnSite");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  // Collect all unique container types across all sites in this tab
  const allContainerTypes = useMemo(() => {
    const types = new Set<string>();
    for (const s of sites) {
      for (const ct of s.containerTypes) types.add(ct);
    }
    return Array.from(types).sort((a, b) => {
      const sizeA = extractBinSize(a);
      const sizeB = extractBinSize(b);
      if (sizeA !== sizeB) return sizeA - sizeB;
      return a.localeCompare(b);
    });
  }, [sites]);

  const toggleType = (ct: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(ct)) next.delete(ct); else next.add(ct);
      return next;
    });
  };

  // Filter sites by selected container types
  const filteredSites = useMemo(() => {
    if (selectedTypes.size === 0) return sites;
    return sites
      .map(s => {
        const matchingTypes = s.containerTypes.filter(ct => selectedTypes.has(ct));
        if (matchingTypes.length === 0) return null;
        // Recalculate net on-site from matching container type breakdowns only
        let delivered = 0, collected = 0, exchanged = 0;
        for (const ct of matchingTypes) {
          const b = s.containerTypeBreakdown[ct];
          if (b) { delivered += b.delivered; collected += b.collected; exchanged += b.exchanged; }
        }
        const netOnSite = Math.max(0, delivered - collected);
        return { ...s, containerTypes: matchingTypes, netOnSite, delivered, collected, exchanged };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null && s.netOnSite > 0);
  }, [sites, selectedTypes]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "customer" || field === "site" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...filteredSites];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case "customer": return dir * a.customer.localeCompare(b.customer);
        case "site": return dir * a.site.localeCompare(b.site);
        case "netOnSite": return dir * (a.netOnSite - b.netOnSite);
        case "delivered": return dir * (a.delivered - b.delivered);
        case "exchanged": return dir * (a.exchanged - b.exchanged);
        case "collected": return dir * (a.collected - b.collected);
        case "containerType": return dir * (primaryContainerSize(a.containerTypes) - primaryContainerSize(b.containerTypes));
        default: return 0;
      }
    });
    return arr;
  }, [filteredSites, sortField, sortDir]);

  if (sites.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No {label} containers currently estimated on-site.
        </CardContent>
      </Card>
    );
  }

  const SortHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none hover:text-foreground ${className ?? ""}`} onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </TableHead>
  );

  return (
    <Card>
      {allContainerTypes.length > 1 && (
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground mr-1">Filter by type:</span>
            <Badge
              variant={selectedTypes.size === 0 ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedTypes(new Set())}
            >
              All ({sites.length})
            </Badge>
            {allContainerTypes.map(ct => (
              <Badge
                key={ct}
                variant={selectedTypes.has(ct) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleType(ct)}
              >
                {ct}
              </Badge>
            ))}
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader field="customer">Customer</SortHeader>
              <SortHeader field="site">Site</SortHeader>
              <SortHeader field="netOnSite" className="text-center">On-Site</SortHeader>
              <SortHeader field="delivered" className="text-center">Delivered</SortHeader>
              <SortHeader field="exchanged" className="text-center">Exchanged</SortHeader>
              <SortHeader field="collected" className="text-center">Collected</SortHeader>
              <SortHeader field="containerType">Container Types</SortHeader>
              <TableHead>Waste Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s, i) => (
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
                <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                  {s.wasteTypes && s.wasteTypes.length > 0 ? s.wasteTypes.join(", ") : "—"}
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
  containerType: string;
  netOnSite: number;
  daysSinceActivity: number | null;
  lastActivityDate: string | null;
};

function downloadOverRentalExcel(sites: OverRentalSite[]) {
  const rows = sites.map(s => ({
    Customer: s.customer,
    Site: s.site,
    Type: s.category.charAt(0).toUpperCase() + s.category.slice(1),
    "Container Type": s.containerType,
    "On-Site": s.netOnSite,
    "Days Since Activity": s.daysSinceActivity ?? "",
    "Last Activity": s.lastActivityDate ? format(new Date(s.lastActivityDate), "dd MMM yyyy") : "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Over Rental");
  XLSX.writeFile(wb, `Over_Rental_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}

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
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Sites Over Free Rental ({sites.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadOverRentalExcel(sites)}>
            <Download className="h-4 w-4 mr-1" /> Download Excel
          </Button>
        </div>
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
              <TableHead>Container Type</TableHead>
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
                  <Badge variant="outline" className="text-xs">{s.containerType}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
