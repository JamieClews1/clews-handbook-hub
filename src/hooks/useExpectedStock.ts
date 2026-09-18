import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, subMonths } from "date-fns";
import { useLiveJobsSettings } from "@/hooks/useLiveJobsSettings";
import { categoriseContainer, containerTypeCap } from "@/lib/overRental";
import { applyEwcReclass, type EwcReclassRule } from "@/lib/stock-check-reclass";

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
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  job_date: string | null;
  ewc: string | null;
  customer: string | null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  containerTypes: ExpectedContainerType[];
  /** In-yard per type, adjusted by completed movements since the last tally. */
  inYardByType: Record<string, number>;
  /** On-site per type, reconciled with the Live Jobs dashboard. */
  onSiteByType: Record<string, number>;
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
  const [latestCheckDateOnly, setLatestCheckDateOnly] = useState<string | null>(null);
  const [excludedSites, setExcludedSites] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reclassRules, setReclassRules] = useState<EwcReclassRule[]>([]);

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
      if (types) setContainerTypes(types as ExpectedContainerType[]);
      if (excluded) setExcludedSites(excluded.map((e) => e.site_name));

      const { data: rules } = await supabase
        .from("stock_check_ewc_reclass_rules")
        .select("id, from_type_id, to_type_id, ewc_codes, is_active")
        .eq("is_active", true);
      setReclassRules((rules ?? []) as EwcReclassRule[]);

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

      // Last 12 months of skiptrak movements (same window/source as Live Jobs).
      const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      const all: JobRow[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("site,container_type,movement_type,job_date,ewc,customer")
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
      const type = bestExpectedTypeFor(job.container_type, containerTypes);
      if (!type) continue;
      const targetId = applyEwcReclass(type.id, job.ewc, reclassRules);
      const key = targetId in map ? targetId : type.id;
      const mt = (job.movement_type || "").toLowerCase();
      if (mt.includes("exchange") || mt.includes("tip")) continue; // net zero
      if (mt.includes("collect")) map[key] += 1;
      else if (mt.includes("deliver")) map[key] -= 1;
    }
    return map;
  }, [containerTypes, latestItems, latestCheckDateOnly, jobs, excludedSites, reclassRules]);

  const { onSiteByType, onSiteOther, siteDetail } = useMemo(() => {
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
    for (const t of containerTypes) byType[t.id] = 0;
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
      const candidates = containerTypes.filter((t) => t.category === p.category);
      const type = bestExpectedTypeFor(p.containerType, candidates);
      if (type) byType[type.id] += count;
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
    return { onSiteByType: byType, onSiteOther: other, siteDetail: detail };
  }, [containerTypes, jobs, excludedSites, liveSettings]);

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
    if (loading || settingsLoading || snapshotWritten) return;
    const total = expectedByCategory.skip + expectedByCategory.roro;
    if (total <= 0) return;
    snapshotWritten = true;
    (async () => {
      const { data: latest } = await supabase
        .from("inventory_expected_snapshot")
        .select("expected_skip, expected_roro, expected_total")
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        latest &&
        latest.expected_skip === expectedByCategory.skip &&
        latest.expected_roro === expectedByCategory.roro &&
        latest.expected_total === total
      )
        return;
      await supabase.from("inventory_expected_snapshot").insert({
        expected_skip: expectedByCategory.skip,
        expected_roro: expectedByCategory.roro,
        expected_total: total,
      });
    })();
  }, [loading, settingsLoading, expectedByCategory]);

  return {
    loading: loading || settingsLoading,
    containerTypes,
    inYardByType,
    onSiteByType,
    onSiteOther,
    siteDetail,
    latestCheckDate,
    expectedByType,
    expectedByCategory,
  };
};
