import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Truck, Container, TrendingUp, TrendingDown, Calendar } from "lucide-react";
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
  const [projections, setProjections] = useState<Record<string, { toCollect: number; toDeliver: number }>>({});
  const [loading, setLoading] = useState(true);
  const [latestCheckDate, setLatestCheckDate] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (dataHubSync && containerTypes.length > 0) {
      loadProjections();
    } else {
      setProjections({});
    }
  }, [dataHubSync, containerTypes, excludedSites]);

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
    const endDate = addDays(today, 4);

    // Query data_hub_jobs for upcoming movements
    const { data: jobs } = await supabase
      .from("data_hub_jobs")
      .select("container_type, movement_type, site, job_date")
      .gte("job_date", format(today, "yyyy-MM-dd"))
      .lte("job_date", format(endDate, "yyyy-MM-dd"))
      .in("source", ["skiptrak"]);

    if (!jobs) return;

    const filteredJobs = jobs.filter(
      (j) => !excludedSites.some((s) => j.site?.toLowerCase().includes(s.toLowerCase()))
    );

    const projMap: Record<string, { toCollect: number; toDeliver: number }> = {};

    for (const type of containerTypes) {
      const keywords = type.data_hub_keywords || [];
      const matchingJobs = filteredJobs.filter((j) =>
        keywords.some((kw) =>
          j.container_type?.toLowerCase().includes(kw.toLowerCase())
        )
      );

      const toCollect = matchingJobs.filter(
        (j) => j.movement_type?.toLowerCase().includes("collection") || j.movement_type?.toLowerCase().includes("collect")
      ).length;

      const toDeliver = matchingJobs.filter(
        (j) => j.movement_type?.toLowerCase().includes("deliver") || j.movement_type?.toLowerCase().includes("exchange")
      ).length;

      projMap[type.id] = { toCollect, toDeliver };
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
  const getProjection = (typeId: string) => projections[typeId] || { toCollect: 0, toDeliver: 0 };

  const calcBookingsAllowed = (typeId: string) => {
    const item = getItem(typeId);
    const proj = getProjection(typeId);
    if (!item) return 0;
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
        <div className="flex items-center gap-2">
          <Label htmlFor="dataHubSync" className="text-sm">Data Hub Sync</Label>
          <Switch
            id="dataHubSync"
            checked={dataHubSync}
            onCheckedChange={setDataHubSync}
          />
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
  getProjection: (typeId: string) => { toCollect: number; toDeliver: number };
  calcBookingsAllowed: (typeId: string) => number;
  showProjections: boolean;
}

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
                  <td className="py-3 px-2 text-center text-green-600 font-medium">{proj.toCollect}</td>
                  <td className="py-3 px-2 text-center text-red-600 font-medium">{proj.toDeliver}</td>
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
