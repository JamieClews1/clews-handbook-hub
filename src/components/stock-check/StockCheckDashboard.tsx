import { useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Truck, Container, TrendingUp, TrendingDown, Calendar, ArrowLeftRight, Pencil } from "lucide-react";
import { format, addDays, startOfDay } from "date-fns";
import { applyEwcReclass, type EwcReclassRule } from "@/lib/stock-check-reclass";
import { stockCheckAvailability, stockMovementDelta, movementAfterTally, uniqueStockMovements, stockContainerKey, type StockMovement } from "@/lib/stock-check-availability";
import { fetchAllRows } from "@/lib/fetch-all";
import { londonCalendarKey } from "@/lib/ui-calendar";
import { containerSize } from "@/lib/container-taxonomy";
import { SizeFilter } from "@/components/stock-check/SizeFilter";
import { filterTypesBySize, type SizeFilterOption } from "@/lib/stock-check-size-filter";

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

export const StockCheckDashboard = ({ onEditLast, headerAction }: { onEditLast?: (checkId: string) => void; headerAction?: ReactNode } = {}) => {
  const [latestCheckId, setLatestCheckId] = useState<string | null>(null);
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [latestItems, setLatestItems] = useState<StockCheckItem[]>([]);
  const [yardDeltas, setYardDeltas] = useState<Record<string, number>>({});
  const [movementError, setMovementError] = useState<string | null>(null);
  const refreshBusy = useRef(false);
  const requestVersion = useRef(0);
  const [excludedSites, setExcludedSites] = useState<string[]>([]);
  const [projections, setProjections] = useState<Record<string, { toCollect: number; toDeliver: number; toExchange: number; collectJobs: ProjectionJob[]; deliverJobs: ProjectionJob[]; exchangeJobs: ProjectionJob[] }>>({});
  const [loading, setLoading] = useState(true);
  const [latestCheckDate, setLatestCheckDate] = useState<string | null>(null);
  const [outlookDays, setOutlookDays] = useState<number>(5);
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [reclassRules, setReclassRules] = useState<EwcReclassRule[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (containerTypes.length > 0) {
      loadProjections();
    } else {
      setProjections({});
    }
  }, [containerTypes, latestItems, excludedSites, outlookDays, reclassRules, latestCheckDate]);

  useEffect(() => {
    const refresh = () => {
      if (!refreshBusy.current && document.visibilityState === "visible") {
        refreshBusy.current = true;
        void loadData().finally(() => { refreshBusy.current = false; });
      }
    };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, []);

  const loadData = async () => {
    const [{ data: types }, { data: excluded }] = await Promise.all([
      supabase
        .from("stock_check_container_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order"),
      supabase.from("stock_check_excluded_sites").select("site_name"),
    ]);

    const { data: rules } = await supabase
      .from("stock_check_ewc_reclass_rules")
      .select("id, from_type_id, to_type_id, ewc_codes, is_active")
      .eq("is_active", true);
    setReclassRules((rules ?? []) as EwcReclassRule[]);

    if (types) setContainerTypes(types as ContainerType[]);
    if (excluded) setExcludedSites(excluded.map((e) => e.site_name));

    // Get latest stock check
    const { data: latestCheck } = await supabase
      .from("stock_checks")
      .select("id, check_date, data_hub_sync_enabled, updated_at, created_at")
      .eq("status", "submitted")
      .order("check_date", { ascending: false })
      .limit(1)
      .single();

    if (latestCheck) {
      setLatestCheckId(latestCheck.id);
      setLatestCheckDate(latestCheck.updated_at || latestCheck.created_at || latestCheck.check_date);

      const { data: items } = await supabase
        .from("stock_check_items")
        .select("container_type_id, in_yard, runner, notes")
        .eq("stock_check_id", latestCheck.id);
      if (items) setLatestItems(items);

    }

    setLoading(false);
  };

  const loadProjections = async () => {
    if (!latestCheckDate) return;
    const version = ++requestVersion.current;
    const todayKey = londonCalendarKey();
    const endKey = format(addDays(startOfDay(new Date()), outlookDays - 1), "yyyy-MM-dd");
    const baselineDay = londonCalendarKey(new Date(latestCheckDate));
    try {
      const [imports, native] = await Promise.all([
        fetchAllRows<{ id: string; job_number: string; container_type: string | null; movement_type: string | null; site: string | null; job_date: string | null; customer: string | null; ewc: string | null; raw: unknown; updated_at: string }>(
          "data_hub_jobs", "id, job_number, container_type, movement_type, site, job_date, customer, ewc, raw, updated_at", "id",
          q => q.eq("source", "skiptrak").gte("job_date", baselineDay < todayKey ? baselineDay : todayKey).lte("job_date", endKey)),
        fetchAllRows<{ id: string; job_number: string; container_type: string | null; container_size: string | null; job_type: string; site_name: string | null; scheduled_date: string; customer_name: string | null; ewc_code: string | null; status: string; completed_at: string | null; updated_at: string; own_container: boolean | null }>(
          "route_one_jobs", "id, job_number, container_type, container_size, job_type, site_name, scheduled_date, customer_name, ewc_code, status, completed_at, updated_at, own_container", "id",
          q => q.eq("is_test", false).or(`and(scheduled_date.gte.${baselineDay < todayKey ? baselineDay : todayKey},scheduled_date.lte.${endKey}),completed_at.gt.${latestCheckDate}`)),
      ]);
      if (version !== requestVersion.current) return;
      const jobs = uniqueStockMovements([
        ...imports.map((j): StockMovement => ({ ...j, source: "skiptrak", completed: String((j.raw as { Status?: string } | null)?.Status ?? "").trim().toUpperCase() === "Y", completedAt: null, updatedAt: j.updated_at })),
        ...native.filter(j => !j.own_container).map((j): StockMovement => ({ id: j.id, job_number: j.job_number, source: "routeone", container_type: [containerSize(j.container_size ?? "")?.label ?? j.container_size, j.container_type].filter(Boolean).join(" "), movement_type: j.job_type, site: j.site_name, customer: j.customer_name, job_date: j.scheduled_date, ewc: j.ewc_code, completed: j.status === "completed", completedAt: j.completed_at, updatedAt: j.updated_at })),
      ]);
      const projMap: typeof projections = {};
      const deltas: Record<string, number> = {};
      for (const t of containerTypes) {
        projMap[t.id] = { toCollect: 0, toDeliver: 0, toExchange: 0, collectJobs: [], deliverJobs: [], exchangeJobs: [] };
        deltas[t.id] = 0;
      }
      const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      for (const job of jobs) {
        if (!job.container_type || excludedSites.some(s => job.site?.toLowerCase().includes(s.toLowerCase()))) continue;
        let bestType: ContainerType | undefined;
        let bestLen = 0;
        for (const type of containerTypes) {
          for (const kw of [...(type.data_hub_keywords || []), type.name]) {
            const key = stockContainerKey(kw);
            if (key.length > bestLen && new RegExp(`(^|\\W)${escapeRegex(key)}(\\W|$)`, "i").test(stockContainerKey(job.container_type))) {
              bestType = type;
              bestLen = key.length;
            }
          }
        }
        if (!bestType) continue;
        const target = applyEwcReclass(bestType.id, job.ewc, reclassRules);
        const key = projMap[target] ? target : bestType.id;
        if (movementAfterTally(job, latestCheckDate, baselineDay)) deltas[key] += stockMovementDelta(job.movement_type);
        if (job.completed || !job.job_date || job.job_date < todayKey || job.job_date > endKey) continue;
        const bucket = projMap[key];
        const movement = (job.movement_type ?? "").toLowerCase();
        if (movement.includes("exchange")) { bucket.toExchange++; bucket.exchangeJobs.push(job); }
        else if (movement.includes("collect")) { bucket.toCollect++; bucket.collectJobs.push(job); }
        else if (movement.includes("deliver")) { bucket.toDeliver++; bucket.deliverJobs.push(job); }
      }
      setProjections(projMap);
      setYardDeltas(deltas);
      setMovementError(null);
    } catch {
      if (version === requestVersion.current) setMovementError("Live stock could not be refreshed.");
    }
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

  const skips = filterTypesBySize(containerTypes.filter((t) => t.category === "skip"), sizeFilter);
  const roros = filterTypesBySize(containerTypes.filter((t) => t.category === "roro"), sizeFilter);
  const sizeOptions: SizeFilterOption[] = containerTypes.map((t) => ({
    id: t.id,
    name: t.name,
    group: t.category === "roro" ? "RoRos" : "Skips",
  }));

  const getItem = (typeId: string) => latestItems.find((i) => i.container_type_id === typeId);
  const getProjection = (typeId: string) => projections[typeId] || { toCollect: 0, toDeliver: 0, toExchange: 0, collectJobs: [], deliverJobs: [], exchangeJobs: [] };
  const getInYard = (typeId: string) => stockCheckAvailability(getItem(typeId), 0, yardDeltas[typeId] ?? 0).inYard;
  const calcBookingsAllowed = (typeId: string) => {
    const item = getItem(typeId);
    const proj = getProjection(typeId);
    return stockCheckAvailability(item, proj.toDeliver, yardDeltas[typeId] ?? 0, proj.toCollect).bookingsAllowed;
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Current Stock Overview</h2>
          {latestCheckDate && (
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Last check: {format(new Date(latestCheckDate), "dd MMM yyyy 'at' HH:mm")}
              </p>
              {latestCheckId && onEditLast && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => onEditLast(latestCheckId)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit last tally
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {headerAction}
          <SizeFilter options={sizeOptions} selected={sizeFilter} onChange={setSizeFilter} />
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
            <span className="text-xs text-muted-foreground ml-1">
              ({format(new Date(), "dd MMM")} – {format(addDays(new Date(), outlookDays - 1), "dd MMM")})
            </span>
          </div>
        </div>
      </div>

      {movementError && (
        <div role="alert" className="flex items-center gap-3 text-destructive">
          <span>{movementError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadProjections()}>Try again</Button>
        </div>
      )}
      {/* Skips */}
      <div hidden={Boolean(movementError)}>
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Skips</h3>
        </div>
        <div className="overflow-x-auto">
          <StockTable
            types={skips}
            getItem={getItem}
            getInYard={getInYard}
            getProjection={getProjection}
            calcBookingsAllowed={calcBookingsAllowed}
            showProjections={true}
          />
        </div>
      </div>

      {/* RoRos */}
      <div hidden={Boolean(movementError)}>
        <div className="flex items-center gap-2 mb-3">
          <Container className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">RoRos</h3>
        </div>
        <div className="overflow-x-auto">
          <StockTable
            types={roros}
            getItem={getItem}
            getInYard={getInYard}
            getProjection={getProjection}
            calcBookingsAllowed={calcBookingsAllowed}
            showProjections={true}
          />
        </div>
      </div>
    </div>
  );
};

interface StockTableProps {
  types: ContainerType[];
  getItem: (typeId: string) => StockCheckItem | undefined;
  getInYard: (typeId: string) => number;
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

const StockTable = ({ types, getItem, getInYard, getProjection, calcBookingsAllowed, showProjections }: StockTableProps) => {
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
          const inYard = getInYard(type.id);

          return (
            <tr key={type.id} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-3 px-2 font-medium text-foreground">{type.name}</td>
              <td className="py-3 px-2 text-center font-bold text-foreground">
                {inYard}
              </td>
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
