import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Container, Warehouse, MapPin, Calendar } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";

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
}

interface JobRow {
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  job_date: string | null;
  ewc: string | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matchKeyword = (haystack: string, kw: string) => {
  const re = new RegExp(`(^|\\W)${escapeRegex(kw)}(\\W|$)`, "i");
  return re.test(haystack);
};

// Pick the container type whose longest matching keyword wins.
const bestTypeFor = (containerType: string, types: ContainerType[]): ContainerType | null => {
  let bestType: ContainerType | null = null;
  let bestLen = 0;
  for (const type of types) {
    for (const kw of type.data_hub_keywords || []) {
      if (kw.length > bestLen && matchKeyword(containerType, kw)) {
        bestLen = kw.length;
        bestType = type;
      }
    }
  }
  return bestType;
};

export const StockCheckTotalStock = () => {
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [latestItems, setLatestItems] = useState<StockCheckItem[]>([]);
  const [latestCheckDate, setLatestCheckDate] = useState<string | null>(null);
  const [latestCheckDateOnly, setLatestCheckDateOnly] = useState<string | null>(null);
  const [excludedSites, setExcludedSites] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
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

      const { data: latestCheck } = await supabase
        .from("stock_checks")
        .select("id, check_date, updated_at, created_at")
        .eq("status", "submitted")
        .order("check_date", { ascending: false })
        .limit(1)
        .single();

      if (latestCheck) {
        setLatestCheckDate(latestCheck.updated_at || latestCheck.created_at || latestCheck.check_date);
        setLatestCheckDateOnly(latestCheck.check_date);
        const { data: items } = await supabase
          .from("stock_check_items")
          .select("container_type_id, in_yard")
          .eq("stock_check_id", latestCheck.id);
        if (items) setLatestItems(items as StockCheckItem[]);
      }

      // Fetch last 12 months of skiptrak movements (same window/source as Rentals).
      const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      const all: JobRow[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("site,container_type,movement_type,job_date,ewc")
          .eq("source", "skiptrak")
          .gte("job_date", since)
          .in("movement_type", ["Deliver", "Exchange", "Collect", "Tip/Return"])
          .order("job_date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) { console.error(error); break; }
        all.push(...((data ?? []) as JobRow[]));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      setJobs(all);
      setLoading(false);
    };
    load();
  }, []);

  // Adjusted In Yard per type — matches "Current Stock Overview": in_yard at last
  // tally + completed movements between the tally date and today.
  const inYardByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of containerTypes) {
      const item = latestItems.find((i) => i.container_type_id === t.id);
      map[t.id] = item?.in_yard ?? 0;
    }
    if (!latestCheckDateOnly) return map;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (latestCheckDateOnly >= todayStr) return map;

    for (const job of jobs) {
      if (!job.container_type || !job.job_date) continue;
      if (job.job_date <= latestCheckDateOnly || job.job_date >= todayStr) continue;
      if (excludedSites.some((s) => job.site?.toLowerCase().includes(s.toLowerCase()))) continue;
      const type = bestTypeFor(job.container_type, containerTypes);
      if (!type) continue;
      const mt = (job.movement_type || "").toLowerCase();
      if (mt.includes("exchange") || mt.includes("tip")) continue; // net zero
      if (mt.includes("collect")) map[type.id] += 1;
      else if (mt.includes("deliver")) map[type.id] -= 1;
    }
    return map;
  }, [containerTypes, latestItems, latestCheckDateOnly, jobs, excludedSites]);

  // Out-on-site per type — net delivered across all positions (site + EWC) over the
  // movement history. Deliver +1, Collect -1; Exchange / Tip&Return are neutral.
  const onSiteByType = useMemo(() => {
    type Pos = { delivered: number; collected: number };
    const positions: Record<string, { typeId: string; counts: Pos }> = {};
    for (const job of jobs) {
      if (!job.container_type) continue;
      if (excludedSites.some((s) => job.site?.toLowerCase().includes(s.toLowerCase()))) continue;
      const type = bestTypeFor(job.container_type, containerTypes);
      if (!type) continue;
      const posKey = `${(job.site || "Unknown").toLowerCase().trim()}|||${type.id}|||${(job.ewc || "__none__").trim()}`;
      if (!positions[posKey]) positions[posKey] = { typeId: type.id, counts: { delivered: 0, collected: 0 } };
      const mt = (job.movement_type || "").toLowerCase();
      if (mt.includes("collect")) positions[posKey].counts.collected += 1;
      else if (mt.includes("deliver")) positions[posKey].counts.delivered += 1;
    }
    const map: Record<string, number> = {};
    for (const t of containerTypes) map[t.id] = 0;
    for (const p of Object.values(positions)) {
      const net = Math.max(p.counts.delivered - p.counts.collected, 0);
      map[p.typeId] += net;
    }
    return map;
  }, [containerTypes, jobs, excludedSites]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (containerTypes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No container types configured yet.</p>
        </CardContent>
      </Card>
    );
  }

  const skips = containerTypes.filter((t) => t.category === "skip");
  const roros = containerTypes.filter((t) => t.category === "roro");

  const sumFor = (types: ContainerType[], src: Record<string, number>) =>
    types.reduce((acc, t) => acc + (src[t.id] || 0), 0);

  const skipYard = sumFor(skips, inYardByType);
  const skipSite = sumFor(skips, onSiteByType);
  const roroYard = sumFor(roros, inYardByType);
  const roroSite = sumFor(roros, onSiteByType);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Total Stock</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Total fleet owned by type — what is out on site plus what is In Yard from the Current Stock Overview.
        </p>
        {latestCheckDate && (
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <Calendar className="h-3.5 w-3.5" />
            Based on last check: {format(new Date(latestCheckDate), "dd MMM yyyy 'at' HH:mm")}
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-5 w-5 text-primary" />
              Total Skips Owned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{skipYard + skipSite}</div>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Warehouse className="h-3.5 w-3.5" /> {skipYard} In Yard</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {skipSite} On Site</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Container className="h-5 w-5 text-primary" />
              Total RoRos Owned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{roroYard + roroSite}</div>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Warehouse className="h-3.5 w-3.5" /> {roroYard} In Yard</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {roroSite} On Site</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By type breakdown */}
      <TotalStockTable title="Skips" icon={<Truck className="h-5 w-5 text-primary" />} types={skips} inYard={inYardByType} onSite={onSiteByType} />
      <TotalStockTable title="RoRos" icon={<Container className="h-5 w-5 text-primary" />} types={roros} inYard={inYardByType} onSite={onSiteByType} />
    </div>
  );
};

const TotalStockTable = ({
  title,
  icon,
  types,
  inYard,
  onSite,
}: {
  title: string;
  icon: React.ReactNode;
  types: ContainerType[];
  inYard: Record<string, number>;
  onSite: Record<string, number>;
}) => {
  if (types.length === 0) return null;
  const totalYard = types.reduce((a, t) => a + (inYard[t.id] || 0), 0);
  const totalSite = types.reduce((a, t) => a + (onSite[t.id] || 0), 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left font-medium py-2 px-3">Type</th>
              <th className="text-right font-medium py-2 px-3">In Yard</th>
              <th className="text-right font-medium py-2 px-3">On Site</th>
              <th className="text-right font-medium py-2 px-3">Total Owned</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const yard = inYard[t.id] || 0;
              const site = onSite[t.id] || 0;
              return (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-foreground">{t.name}</td>
                  <td className="py-2 px-3 text-right">{yard}</td>
                  <td className="py-2 px-3 text-right">{site}</td>
                  <td className="py-2 px-3 text-right font-bold text-foreground">{yard + site}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-border font-bold">
              <td className="py-2 px-3 text-foreground">Total</td>
              <td className="py-2 px-3 text-right">{totalYard}</td>
              <td className="py-2 px-3 text-right">{totalSite}</td>
              <td className="py-2 px-3 text-right">
                <Badge variant="secondary" className="text-sm">{totalYard + totalSite}</Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
