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
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  job_date: string | null;
  ewc: string | null;
  customer: string | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Module-level guard so the expected-stock snapshot is written at most once
// per browser session, no matter how many components use this hook.
let snapshotWritten = false;
const matchKeyword = (haystack: string, kw: string) => {
  const re = new RegExp(`(^|\\W)${escapeRegex(kw)}(\\W|$)`, "i");
  return re.test(haystack);
};

// Pick the container type whose longest matching keyword wins. Optionally the
// caller restricts the candidate types first (e.g. only one category).
export const bestExpectedTypeFor = (
  containerType: string,
  types: ExpectedContainerType[],
): ExpectedContainerType | null => {
  let bestType: ExpectedContainerType | null = null;
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

  useEffect(() => {
    const load = async () => {
      try {
      const [{ data: types }, { data: excluded }] = await Promise.all([
        supabase
          .from("stock_check_container_types")
          .select("*")
          .eq("is_active", true)
          .order("display_order"),
        supabase.from("stock_check_excluded_sites").select("site_name"),
      ]);
      if (types) setContainerTypes(types as ExpectedContainerType[]);
      if (excluded) setExcludedSites(excluded.map((e) => e.site_name));

      const { data: rules } = await supabase
        .from("stock_check_ewc_reclass_rules")
        .select("id, from_type_id, to_type_id, ewc_codes, is_active")
        .eq("is_active", true);
      setReclassRules((rules ?? []) as EwcReclassRule[]);

      const { data: collected } = await supabase
        .from("rental_chases")
        .select("bin_key")
        .eq("collected", true);
      setCollectedBinKeys(new Set((collected ?? []).map((r: { bin_key: string }) => r.bin_key)));

      const { data: own } = await supabase
        .from("rental_chases")
        .select("bin_key")
        .eq("own_skip", true);
      setOwnBinKeys(new Set((own ?? []).map((r: { bin_key: string }) => r.bin_key)));

      const { data: latestCheck } = await supabase
        .from("stock_checks")
        .select("id, check_date, updated_at, created_at")
        .eq("status", "submitted")
        .order("check_date", { ascending: false })
        .limit(1)
        .single();

      if (latestCheck) {
        setLatestCheckDate(latestCheck.updated_at || latestCheck.created_at || latestCheck.check_date);
        const { data: items } = await supabase
          .from("stock_check_items")
          .select("container_type_id, in_yard")
          .eq("stock_check_id", latestCheck.id);
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
      setJobs(all);
      } catch (cause) {
        console.error(cause);
        setError("Stock estimates could not be loaded in full. Refresh to try again.");
      }
      setLoading(false);
    };
    load();
  }, []);

  const inYardByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of containerTypes) {
      const item = latestItems.find((i) => i.container_type_id === t.id);
      map[t.id] = item?.in_yard ?? 0;
    }
    if (!latestCheckDate) return map;
    const baselineDay = londonCalendarKey(new Date(latestCheckDate));
    const movements = uniqueStockMovements([
      ...jobs.map((j): StockMovement => ({ ...j, source: "skiptrak", completed: String((j.raw as { Status?: string } | null)?.Status ?? "").trim().toUpperCase() === "Y", completedAt: null, updatedAt: j.updated_at })),
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

  const { onSiteByType, ownOnSiteByType, onSiteOther, siteDetail } = useMemo(() => {
    const positions: Record<string, Pos> = {};
    for (const job of jobs) {
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
      const type = bestExpectedTypeFor(p.containerType, candidates);
      if (type) {
        byType[type.id] += count;
        if (ownBinKeys.has(binKey)) ownByType[type.id] += count;
      }
      else other[p.category] += count;
      detail.push({
        site: p.site,
        customer: p.customer,
        category: p.category,
        typeName: type?.name ?? "Other / unclassified",
        containerType: p.containerType,
        ewc: p.ewc && p.ewc !== "__none__" ? p.ewc : "",
        count,
        lastKeepDate: p.lastKeepDate,
        lastCollectionDate: p.lastCollectionDate,
      });
    }
    detail.sort((a, b) =>
      a.site.localeCompare(b.site) || a.typeName.localeCompare(b.typeName)
    );
    return { onSiteByType: byType, ownOnSiteByType: ownByType, onSiteOther: other, siteDetail: detail };
  }, [containerTypes, jobs, excludedSites, liveSettings, collectedBinKeys, ownBinKeys]);

  const expectedByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of containerTypes) {
      map[t.id] = (inYardByType[t.id] || 0) + (onSiteByType[t.id] || 0);
    }
    return map;
  }, [containerTypes, inYardByType, onSiteByType]);

  const expectedByCategory = useMemo(() => {
    const sum = (cat: string) =>
      containerTypes
        .filter((t) => t.category === cat)
        .reduce((a, t) => a + (expectedByType[t.id] || 0), 0);
    return {
      skip: sum("skip") + onSiteOther.skip,
      roro: sum("roro") + onSiteOther.roro,
    };
  }, [containerTypes, expectedByType, onSiteOther]);

  // Persist the latest expected totals so the public inventory share page can
  // show "% of expected bins catalogued". Writes at most once per browser
  // session, and only when the figures changed.
  useEffect(() => {
    if (loading || error || settingsLoading || snapshotWritten) return;
    const total = expectedByCategory.skip + expectedByCategory.roro;
    if (total <= 0) return;
    snapshotWritten = true;
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
