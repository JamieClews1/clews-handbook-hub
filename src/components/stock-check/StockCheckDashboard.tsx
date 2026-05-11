import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Truck, Container, TrendingUp, TrendingDown, Calendar, ArrowLeftRight } from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";

interface ContainerType {
  id: string;
  name: string;
  category: string;
  display_order: number;
  data_hub_keywords: string[];
}

interface StockCheckItem {
  container_type_id: string;
  in_yard: number;
  runner: number;
  notes: string | null;
}

interface ProjectionJob {
  site: string | null;
  container_type: string | null;
  job_date: string | null;
  movement_type: string | null;
  customer: string | null;
}

interface DailyEntry {
  container_type_id: string;
  entry_date: string;
  projected_in: number;
  projected_out: number;
  actual_in: number | null;
  actual_out: number | null;
}

export const StockCheckDashboard = () => {
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [latestItems, setLatestItems] = useState<StockCheckItem[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [dataHubSync, setDataHubSync] = useState(true);
  const [excludedSites, setExcludedSites] = useState<string[]>([]);
  const [projections, setProjections] = useState<Record<string, { toCollect: number; toDeliver: number; toExchange: number; collectJobs: ProjectionJob[]; deliverJobs: ProjectionJob[]; exchangeJobs: ProjectionJob[] }>>({});
  const [loading, setLoading] = useState(true);
  const [latestCheckDate, setLatestCheckDate] = useState<string | null>(null);
  const [outlookDays, setOutlookDays] = useState<number>(5);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (dataHubSync && containerTypes.length > 0) {
      loadProjections();
    } else {
      setProjections({});
    }
  }, [dataHubSync, containerTypes, excludedSites, outlookDays]);

  const loadData = async () => {
    const [{ data: types }, { data: excluded }] = await Promise.all([
      supabase
        .from("stock_check_container_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("stock_check_excluded_sites").select("site_name"),
    ]);

    if (types) setContainerTypes(types as ContainerType[]);
    if (excluded) setExcludedSites(excluded.map((e) => e.site_name));

    // Get latest stock check
    const { data: latestCheck } = await supabase
      .from("stock_checks")
      .select("id, check_date, data_hub_sync_enabled")
      .eq("status", "submitted")
      .order("check_date", { ascending: false })
      .limit(1)
      .single();

    if (latestCheck) {
      setDataHubSync(latestCheck.data_hub_sync_enabled);
      setLatestCheckDate(latestCheck.check_date);

      const [{ data: items }, { data: entries }] = await Promise.all([
        supabase
          .from("stock_check_items")
          .select("container_type_id, in_yard, runner, notes")
          .eq("stock_check_id", latestCheck.id),
        supabase
          .from("stock_check_daily_entries")
          .select("*")
          .eq("stock_check_id", latestCheck.id),
      ]);

      if (items) setLatestItems(items);
      if (entries) setDailyEntries(entries as DailyEntry[]);
    }

    setLoading(false);
  };

  const loadProjections = async () => {
    const today = startOfDay(new Date());
    const endDate = addDays(today, outlookDays - 1);

    // Query data_hub_jobs for upcoming movements (include raw to filter completed jobs)
    const { data: jobs } = await supabase
      .from("data_hub_jobs")
      .select("container_type, movement_type, site, job_date, customer, raw")
      .gte("job_date", format(today, "yyyy-MM-dd"))
      .lte("job_date", format(endDate, "yyyy-MM-dd"))
      .in("source", ["skiptrak"]);

    if (!jobs) return;

    const filteredJobs = jobs.filter((j) => {
      if (excludedSites.some((s) => j.site?.toLowerCase().includes(s.toLowerCase()))) return false;
      // Exclude completed jobs (Skiptrak Status 'Y' = completed) — keep only outstanding work
      const status = (j.raw as any)?.Status;
      if (status === "Y") return false;
      return true;
    });

    const projMap: Record<string, { toCollect: number; toDeliver: number; toExchange: number; collectJobs: ProjectionJob[]; deliverJobs: ProjectionJob[]; exchangeJobs: ProjectionJob[] }> = {};
    for (const t of containerTypes) {
      projMap[t.id] = { toCollect: 0, toDeliver: 0, toExchange: 0, collectJobs: [], deliverJobs: [], exchangeJobs: [] };
    }

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchKeyword = (haystack: string, kw: string) => {
      const re = new RegExp(`(^|\\W)${escapeRegex(kw)}(\\W|$)`, "i");
      return re.test(haystack);
    };

    // For each job, pick the type whose longest-matching keyword wins
    // (so "12 Yard Enc" beats "12 Yard" for an Enclosed job).
    for (const job of filteredJobs) {
      if (!job.container_type) continue;
      let bestType: ContainerType | null = null;
      let bestLen = 0;
      for (const type of containerTypes) {
        for (const kw of type.data_hub_keywords || []) {
          if (kw.length > bestLen && matchKeyword(job.container_type, kw)) {
            bestLen = kw.length;
            bestType = type;
          }
        }
      }
      if (!bestType) continue;
      const bucket = projMap[bestType.id];
      const mt = (job.movement_type || "").toLowerCase();
      if (mt.includes("exchange")) {
        bucket.toExchange++;
        bucket.exchangeJobs.push(job);
      } else if (mt.includes("collect")) {
        bucket.toCollect++;
        bucket.collectJobs.push(job);
      } else if (mt.includes("deliver")) {
        bucket.toDeliver++;
        bucket.deliverJobs.push(job);
      }
    }

    setProjections(projMap);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (latestItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No stock checks yet. Complete a tally to see your dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  const skips = containerTypes.filter((t) => t.category === "skip");
  const roros = containerTypes.filter((t) => t.category === "roro");

  const getItem = (typeId: string) => latestItems.find((i) => i.container_type_id === typeId);
  const getProjection = (typeId: string) => projections[typeId] || { toCollect: 0, toDeliver: 0, toExchange: 0, collectJobs: [], deliverJobs: [], exchangeJobs: [] };

  const calcBookingsAllowed = (typeId: string) => {
    const item = getItem(typeId);
    const proj = getProjection(typeId);
    if (!item) return 0;
    // Exchanges are self-fulfilling (runner returns with the swap), so they
    // don't affect availability. Reserve declared runners only.
    return item.in_yard + proj.toCollect - proj.toDeliver - item.runner;
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Current Stock Overview</h2>
          {latestCheckDate && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="h-3.5 w-3.5" />
              Last check: {format(new Date(latestCheckDate), "dd MMM yyyy")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {dataHubSync && (
            <div className="flex items-center gap-1.5">
              <Label className="text-sm text-muted-foreground">Outlook:</Label>
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                {[2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setOutlookDays(d)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      outlookDays === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label htmlFor="dataHubSync" className="text-sm">Data Hub Sync</Label>
            <Switch
              id="dataHubSync"
              checked={dataHubSync}
              onCheckedChange={setDataHubSync}
            />
          </div>
        </div>
      </div>

      {/* Skips */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Skips</h3>
        </div>
        <div className="overflow-x-auto">
          <StockTable
            types={skips}
            getItem={getItem}
            getProjection={getProjection}
            calcBookingsAllowed={calcBookingsAllowed}
            showProjections={dataHubSync}
          />
        </div>
      </div>

      {/* RoRos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Container className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">RoRos</h3>
        </div>
        <div className="overflow-x-auto">
          <StockTable
            types={roros}
            getItem={getItem}
            getProjection={getProjection}
            calcBookingsAllowed={calcBookingsAllowed}
            showProjections={dataHubSync}
          />
        </div>
      </div>
    </div>
  );
};

interface StockTableProps {
  types: ContainerType[];
  getItem: (typeId: string) => StockCheckItem | undefined;
  getProjection: (typeId: string) => { toCollect: number; toDeliver: number; toExchange: number; collectJobs: ProjectionJob[]; deliverJobs: ProjectionJob[]; exchangeJobs: ProjectionJob[] };
  calcBookingsAllowed: (typeId: string) => number;
  showProjections: boolean;
}

const JobsPopover = ({ jobs, label, colorClass }: { jobs: ProjectionJob[]; label: string; colorClass: string }) => {
  if (jobs.length === 0) return <span className={colorClass}>0</span>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`${colorClass} underline decoration-dotted underline-offset-2 cursor-pointer hover:opacity-80`}>
          {jobs.length}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-64 overflow-y-auto p-0" align="center">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold text-sm text-foreground">{label} ({jobs.length})</h4>
        </div>
        <div className="divide-y divide-border/50">
          {jobs.map((job, i) => (
            <div key={i} className="px-3 py-2 text-xs space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground truncate max-w-[180px]">{job.customer || "—"}</span>
                {job.job_date && (
                  <span className="text-muted-foreground">{format(new Date(job.job_date), "dd MMM")}</span>
                )}
              </div>
              <div className="text-muted-foreground truncate">{job.site || "—"}</div>
              <div className="text-muted-foreground">{job.container_type} · {job.movement_type}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const StockTable = ({ types, getItem, getProjection, calcBookingsAllowed, showProjections }: StockTableProps) => {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-3 px-2 font-semibold text-foreground">Type</th>
          <th className="text-center py-3 px-2 font-semibold text-foreground">In Yard</th>
          {showProjections && (
            <>
              <th className="text-center py-3 px-2 font-semibold text-foreground">
                <span className="flex items-center justify-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                  To Collect
                </span>
              </th>
              <th className="text-center py-3 px-2 font-semibold text-foreground">
                <span className="flex items-center justify-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  To Deliver
                </span>
              </th>
              <th className="text-center py-3 px-2 font-semibold text-foreground">
                <span className="flex items-center justify-center gap-1">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-amber-500" />
                  Exchange
                </span>
              </th>
            </>
          )}
          <th className="text-center py-3 px-2 font-semibold text-foreground">Runner</th>
          <th className="text-center py-3 px-2 font-semibold text-foreground">
            <Badge variant="outline" className="font-semibold">
              Bookings Allowed
            </Badge>
          </th>
          <th className="text-left py-3 px-2 font-semibold text-foreground">Notes</th>
        </tr>
      </thead>
      <tbody>
        {types.map((type) => {
          const item = getItem(type.id);
          const proj = getProjection(type.id);
          const bookings = calcBookingsAllowed(type.id);

          return (
            <tr key={type.id} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-3 px-2 font-medium text-foreground">{type.name}</td>
              <td className="py-3 px-2 text-center font-bold text-foreground">{item?.in_yard ?? 0}</td>
              {showProjections && (
                <>
                  <td className="py-3 px-2 text-center font-medium">
                    <JobsPopover jobs={proj.collectJobs} label="To Collect" colorClass="text-green-600 font-medium" />
                  </td>
                  <td className="py-3 px-2 text-center font-medium">
                    <JobsPopover jobs={proj.deliverJobs} label="To Deliver" colorClass="text-red-600 font-medium" />
                  </td>
                  <td className="py-3 px-2 text-center font-medium">
                    <JobsPopover jobs={proj.exchangeJobs} label="Exchange" colorClass="text-amber-600 font-medium" />
                  </td>
                </>
              )}
              <td className="py-3 px-2 text-center text-muted-foreground">{item?.runner ?? 0}</td>
              <td className="py-3 px-2 text-center">
                <Badge
                  variant={bookings > 0 ? "default" : "destructive"}
                  className="text-sm font-bold min-w-[2rem]"
                >
                  {bookings}
                </Badge>
              </td>
              <td className="py-3 px-2 text-muted-foreground text-xs">{item?.notes || "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
