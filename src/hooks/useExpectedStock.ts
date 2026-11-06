import { withStandingBins, type StandingBinRule } from "@/lib/standing-bins";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, subMonths } from "date-fns";
import { useLiveJobsSettings } from "@/hooks/useLiveJobsSettings";
import { categoriseContainer, containerTypeCap } from "@/lib/overRental";
import { applyEwcReclass, type EwcReclassRule } from "@/lib/stock-check-reclass";
import { movementAfterTally, stockMovementDelta, uniqueStockMovements, type StockMovement } from "@/lib/stock-check-availability";
import { londonCalendarKey } from "@/lib/ui-calendar";
import { fetchAllRows } from "@/lib/fetch-all";
import { containerSize } from "@/lib/container-taxonomy";
import { bestStockType } from "@/lib/stock-check-matching";
import { isCompletedRentalMovement } from "@/lib/rental-open-movements";

export interface ExpectedContainerType {
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
  id: string;
  job_number: string;
  raw: unknown;
  updated_at: string;
  rental_status?: string | null;
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  job_date: string | null;
  ewc: string | null;
  customer: string | null;
}

// All Stock Check consumers use the same container spelling and name fallback.
export const bestExpectedTypeFor = bestStockType;

// A single physical on-site position (site + container_type + EWC/waste stream).
type Pos = {
  category: "skip" | "roro";
  site: string;
  containerType: string;
  ewc: string | null;
  customer: string | null;
  delivered: number;
  collected: number;
  exchanged: number;
  tipReturn: number;
  lastKeepDate: string | null;
  lastCollectionDate: string | null;
};

export type SiteDetailRow = {
  site: string;
  customer: string | null;
  category: "skip" | "roro";
  typeName: string;
  containerType: string;
  ewc: string;
  count: number;
  own: boolean;
  lastKeepDate: string | null;
  lastCollectionDate: string | null;
};

// Identical to LiveJobsDashboard.positionOnSite — net delivered, with a present
// container synthesised from a lone exchange/tip-return, and cleared positions zeroed.
const positionOnSite = (p: Pos): number => {
  const net = p.delivered - p.collected;
  const cleared = !!(p.lastCollectionDate && p.lastKeepDate && p.lastCollectionDate >= p.lastKeepDate);
  if (cleared && net <= 0) return 0;
  const present = p.exchanged > 0 || p.tipReturn > 0;
  return Math.max(net, net >= 0 && present ? Math.max(1, net) : 0);
};

export interface ExpectedStock {
  loading: boolean;
  error: string | null;
  containerTypes: ExpectedContainerType[];
  /** In-yard per type, adjusted by completed movements since the last tally. */
  inYardByType: Record<string, number>;
  /** On-site per type, reconciled with the Live Jobs dashboard. */
  onSiteByType: Record<string, number>;
  /** Of onSiteByType, containers marked "Own Skip" in Rentals (customer-owned). */
  ownOnSiteByType: Record<string, number>;
  /** On-site containers that match no Stock Check type, per category. */
  onSiteOther: { skip: number; roro: number };
  clewsOnSiteByType: Record<string, number>;
  clewsOnSiteOther: { skip: number; roro: number };
  refresh: () => void;
  siteDetail: SiteDetailRow[];
  latestCheckDate: string | null;
  /** Total expected (in yard + on site) per type id. */
  expectedByType: Record<string, number>;
  /** Grand total expected per category (incl. unclassified on-site). */
  expectedByCategory: { skip: number; roro: number };
}

// Shared "expected stock" computation used by Total Stock (fleet owned) and by
// the Inventory tab (% of expected bins catalogued). Single source so both
// views always agree.
export const useExpectedStock = (): ExpectedStock => {
  const { settings: liveSettings, loading: settingsLoading } = useLiveJobsSettings();
  const [containerTypes, setContainerTypes] = useState<ExpectedContainerType[]>([]);
  const [latestItems, setLatestItems] = useState<StockCheckItem[]>([]);
  const [latestCheckDate, setLatestCheckDate] = useState<string | null>(null);
  const [excludedSites, setExcludedSites] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nativeMovements, setNativeMovements] = useState<StockMovement[]>([]);
  const [reclassRules, setReclassRules] = useState<EwcReclassRule[]>([]);
  // Bins manually marked collected in Rentals — excluded from Live Jobs counts,
  // so they must be excluded here too (same site|||container_type key).
  const [collectedBinKeys, setCollectedBinKeys] = useState<Set<string>>(new Set());
  const [ownBinKeys, setOwnBinKeys] = useState<Set<string>>(new Set());
  const [standingRules, setStandingRules] = useState<StandingBinRule[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(n => n + 1);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
      const [types, excluded, rules, markings, standing] = await Promise.all([
        fetchAllRows<ExpectedContainerType>("stock_check_container_types", "*", "id", q => q.eq("is_active",true)),
        fetchAllRows<{site_name:string}>("stock_check_excluded_sites", "id,site_name", "id"),
        fetchAllRows<EwcReclassRule>("stock_check_ewc_reclass_rules", "id,from_type_id,to_type_id,ewc_codes,is_active", "id", q => q.eq("is_active",true)),
        fetchAllRows<{bin_key:string;collected:boolean|null;own_skip:boolean|null}>("rental_chases", "id,bin_key,collected,own_skip", "id"),
        fetchAllRows<StandingBinRule>("site_standing_bins", "id,customer,site,container_type,ewc,bin_count,active,notes", "id", q => q.eq("active",true)),
      ]);
      if (cancelled) return;
      setContainerTypes(types.sort((a,b)=>a.display_order-b.display_order));
      setExcludedSites(excluded.map(e=>e.site_name));
      setReclassRules(rules); setStandingRules(standing);
      setCollectedBinKeys(new Set(markings.filter(r=>r.collected).map(r=>r.bin_key)));
      setOwnBinKeys(new Set(markings.filter(r=>r.own_skip).map(r=>r.bin_key)));

      const { data: latestCheck, error: checkError } = await supabase
        .from("stock_checks")
        .select("id, check_date, updated_at, created_at")
        .eq("status", "submitted")
        .order("check_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (checkError) throw checkError;
      if (cancelled) return;

      if (latestCheck) {
        setLatestCheckDate(latestCheck.updated_at || latestCheck.created_at || latestCheck.check_date);
        const { data: items, error: itemError } = await supabase
          .from("stock_check_items")
          .select("container_type_id, in_yard")
          .eq("stock_check_id", latestCheck.id);
        if (itemError) throw itemError;
        if (items) setLatestItems(items as StockCheckItem[]);
      }

      // Last 12 months of skiptrak movements (same window/source as Live Jobs).
      const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      const all: JobRow[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("id,job_number,raw,updated_at,site,container_type,movement_type,job_date,ewc,customer")
          .eq("source", "skiptrak")
          .gte("job_date", since)
          .in("movement_type", ["Deliver", "Exchange", "Collect", "Tip/Return"])
          .order("job_date", { ascending: false })
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...((data ?? []) as JobRow[]));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      if (latestCheck) {
        const baseline = latestCheck.updated_at || latestCheck.created_at || latestCheck.check_date;
        const native = await fetchAllRows<{ id: string; job_number: string; container_type: string | null; container_size: string | null; job_type: string; site_name: string | null; scheduled_date: string; customer_name: string | null; ewc_code: string | null; status: string; completed_at: string | null; updated_at: string; own_container: boolean | null }>(
          "route_one_jobs", "id, job_number, container_type, container_size, job_type, site_name, scheduled_date, customer_name, ewc_code, status, completed_at, updated_at, own_container", "id",
          q => q.eq("is_test", false).eq("status", "completed").gt("completed_at", baseline),
        );
        setNativeMovements(native.filter(j => !j.own_container).map((j): StockMovement => ({ id: j.id, job_number: j.job_number, source: "routeone", container_type: [containerSize(j.container_size ?? "")?.label ?? j.container_size, j.container_type].filter(Boolean).join(" "), movement_type: j.job_type, site: j.site_name, customer: j.customer_name, job_date: j.scheduled_date, ewc: j.ewc_code, completed: j.status === "completed", completedAt: j.completed_at, updatedAt: j.updated_at })));
      }
      if (cancelled) return;
      setJobs(all); setError(null);
      } catch (cause) {
        if (cancelled) return;
        console.error(cause);
        setError("Stock estimates could not be loaded in full. Refresh to try again.");
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const inYardByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of containerTypes) {
      const item = latestItems.find((i) => i.container_type_id === t.id);
      map[t.id] = item?.in_yard ?? 0;
    }
    if (!latestCheckDate) return map;
    const baselineDay = londonCalendarKey(new Date(latestCheckDate));
    const movements = uniqueStockMovements([
      ...jobs.map((j): StockMovement => ({ ...j, source: "skiptrak", completed: String((j.raw as { Status?: string } | null)?.Status ?? "").trim().toUpperCase() === "Y" && Boolean(j.job_date && j.job_date <= londonCalendarKey()), completedAt: null, updatedAt: j.updated_at })),
      ...nativeMovements,
    ]);
    for (const job of movements) {
      if (!job.container_type || !job.job_date) continue;
      if (!movementAfterTally(job, latestCheckDate, baselineDay)) continue;
      if (excludedSites.some((s) => job.site?.toLowerCase().includes(s.toLowerCase()))) continue;
      const type = bestExpectedTypeFor(job.container_type, containerTypes);
      if (!type) continue;
      const targetId = applyEwcReclass(type.id, job.ewc, reclassRules);
      const key = targetId in map ? targetId : type.id;
      map[key] += stockMovementDelta(job.movement_type);
    }
    return map;
  }, [containerTypes, latestItems, latestCheckDate, jobs, nativeMovements, excludedSites, reclassRules]);

  const { onSiteByType, ownOnSiteByType, onSiteOther, clewsOnSiteOther, siteDetail } = useMemo(() => {
    const positions: Record<string, Pos> = {};
    for (const job of withStandingBins(jobs, standingRules)) {
      if (!isCompletedRentalMovement({ ...job, rental_status: job.rental_status ?? (job.raw as { Status?: string } | null)?.Status, waste_description: null, vehicle_registration: null })) continue;
      if (!job.container_type) continue;
      if (excludedSites.some((s) => job.site?.toLowerCase().includes(s.toLowerCase()))) continue;
      const cat = categoriseContainer(job.container_type, null, liveSettings);
      if (cat !== "skip" && cat !== "roro") continue; // ignore artic / unrecognised
      const posKey = `${(job.site || "Unknown").toLowerCase().trim()}|||${job.container_type.toLowerCase().trim()}|||${(job.ewc || "__none__").trim()}`;
      if (!positions[posKey]) {
        positions[posKey] = {
          category: cat,
          site: job.site || "Unknown",
          containerType: job.container_type,
          ewc: job.ewc,
          customer: job.customer,
          delivered: 0,
          collected: 0,
          exchanged: 0,
          tipReturn: 0,
          lastKeepDate: null,
          lastCollectionDate: null,
        };
      }
      const pos = positions[posKey];
      const mt = (job.movement_type || "").toLowerCase();
      const staysOnSite = mt.includes("deliver") || mt.includes("exchange") || mt.includes("tip");
      if (mt.includes("collect")) pos.collected += 1;
      else if (mt.includes("exchange")) pos.exchanged += 1;
      else if (mt.includes("tip")) pos.tipReturn += 1;
      else if (mt.includes("deliver")) pos.delivered += 1;
      if (job.job_date && staysOnSite && (!pos.lastKeepDate || job.job_date > pos.lastKeepDate)) {
        pos.lastKeepDate = job.job_date;
      }
      if (job.job_date && mt.includes("collect") && (!pos.lastCollectionDate || job.job_date > pos.lastCollectionDate)) {
        pos.lastCollectionDate = job.job_date;
      }
    }

    const byType: Record<string, number> = {};
    const ownByType: Record<string, number> = {};
    for (const t of containerTypes) { byType[t.id] = 0; ownByType[t.id] = 0; }
    const other = { skip: 0, roro: 0 };
    const clewsOther = { skip: 0, roro: 0 };
    const detail: SiteDetailRow[] = [];

    // Clamp each site + container type to its plain delivered−collected balance so a
    // collection logged under a different EWC clears its delivery (matches Live Jobs).
    const byTypeGroup: Record<string, Pos[]> = {};
    for (const p of Object.values(positions)) {
      const k = `${p.site.toLowerCase().trim()}|||${p.containerType.toLowerCase().trim()}`;
      (byTypeGroup[k] ||= []).push(p);
    }
    const allowed = new Map<Pos, number>();
    for (const group of Object.values(byTypeGroup)) {
      const ordered = [...group].sort((a, b) =>
        (b.lastKeepDate ?? "").localeCompare(a.lastKeepDate ?? "")
      );
      let remaining = containerTypeCap(group);
      for (const p of ordered) {
        const take = Math.min(positionOnSite(p), Math.max(remaining, 0));
        allowed.set(p, take);
        remaining -= take;
      }
    }

    for (const p of Object.values(positions)) {
      const count = allowed.get(p) ?? 0;
      if (count <= 0) continue;
      const binKey = `${p.site.toLowerCase().trim()}|||${p.containerType.toLowerCase().trim()}`;
      if (collectedBinKeys.has(binKey)) continue;
      const candidates = containerTypes.filter((t) => t.category === p.category);
      const matched = bestExpectedTypeFor(p.containerType, candidates);
      const target = matched ? applyEwcReclass(matched.id, p.ewc, reclassRules) : null;
      const type = candidates.find(t => t.id === target) ?? matched;
      if (type) {
        byType[type.id] += count;
        if (ownBinKeys.has(binKey)) ownByType[type.id] += count;
      }
      else { other[p.category] += count; if (!ownBinKeys.has(binKey)) clewsOther[p.category] += count; }
      detail.push({
        site: p.site,
        customer: p.customer,
        category: p.category,
        typeName: type?.name ?? "Other / unclassified",
        containerType: p.containerType,
        ewc: p.ewc && p.ewc !== "__none__" ? p.ewc : "",
        count,
        own: ownBinKeys.has(binKey),
        lastKeepDate: p.lastKeepDate,
        lastCollectionDate: p.lastCollectionDate,
      });
    }
    detail.sort((a, b) =>
      a.site.localeCompare(b.site) || a.typeName.localeCompare(b.typeName)
    );
    return { onSiteByType: byType, ownOnSiteByType: ownByType, onSiteOther: other, clewsOnSiteOther: clewsOther, siteDetail: detail };
  }, [containerTypes, jobs, excludedSites, liveSettings, collectedBinKeys, ownBinKeys, standingRules, reclassRules]);

  const clewsOnSiteByType = useMemo(() => Object.fromEntries(containerTypes.map(t => [t.id, Math.max(0,(onSiteByType[t.id] ?? 0)-(ownOnSiteByType[t.id] ?? 0))])), [containerTypes,onSiteByType,ownOnSiteByType]);

  const expectedByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of containerTypes) {
      map[t.id] = (inYardByType[t.id] || 0) + (clewsOnSiteByType[t.id] || 0);
    }
    return map;
  }, [containerTypes, inYardByType, clewsOnSiteByType]);

  const expectedByCategory = useMemo(() => {
    const sum = (cat: string) =>
      containerTypes
        .filter((t) => t.category === cat)
        .reduce((a, t) => a + (expectedByType[t.id] || 0), 0);
    return {
      skip: sum("skip") + clewsOnSiteOther.skip,
      roro: sum("roro") + clewsOnSiteOther.roro,
    };
  }, [containerTypes, expectedByType, clewsOnSiteOther]);

  // Persist the latest expected totals so the public inventory share page can
  // show "% of expected bins catalogued". Writes at most once per browser
  // session, and only when the figures changed.
  useEffect(() => {
    if (loading || error || settingsLoading) return;
    const total = expectedByCategory.skip + expectedByCategory.roro;
    if (total <= 0) return;
    (async () => {
      // Working tallies already exclude out-of-service bins.
      const adjSkip = Math.max(0, expectedByCategory.skip);
      const adjRoro = Math.max(0, expectedByCategory.roro);
      const adjTotal = adjSkip + adjRoro;
      const { data: latest } = await supabase
        .from("inventory_expected_snapshot")
        .select("expected_skip, expected_roro, expected_total")
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        latest &&
        latest.expected_skip === adjSkip &&
        latest.expected_roro === adjRoro &&
        latest.expected_total === adjTotal
      )
        return;
      await supabase.from("inventory_expected_snapshot").insert({
        expected_skip: adjSkip,
        expected_roro: adjRoro,
        expected_total: adjTotal,
      });
    })();
  }, [loading, error, settingsLoading, expectedByCategory]);

  return {
    loading: loading || settingsLoading,
    error,
    refresh,
    clewsOnSiteByType,
    clewsOnSiteOther,
    containerTypes,
    inYardByType,
    onSiteByType,
    ownOnSiteByType,
    onSiteOther,
    siteDetail,
    latestCheckDate,
    expectedByType,
    expectedByCategory,
  };
};
