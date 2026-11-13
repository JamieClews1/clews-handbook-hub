import type { OverRentalJob, ClampPos } from "./overRental";
import { categoriseContainer, containerTypeCap } from "./overRental";
import { isCompletedRentalMovement } from "./rental-open-movements";
import { withStandingBins, isStandingBinJob, type StandingBinRule } from "./standing-bins";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

export type HistoryJob = OverRentalJob & { source: string; address?: string | null; address2?: string | null; address3?: string | null; driver?: string | null; weight_t?: number | null };
export const HISTORY_FIELDS = "id,source,job_number,job_date,customer,site,postcode,container_type,movement_type,waste_description,vehicle_registration,ewc,weight_t,driver,rental_status:raw->>Status,address:raw->>Location Postc_1,address2:raw->>Address 2nd LIne,address3:raw->>Address 3";
// Search only needs site identity; load full ticket evidence after choosing a site.
export const HISTORY_SEARCH_FIELDS = "id,customer,site,postcode,address:raw->>Location Postc_1,address2:raw->>Address 2nd LIne,address3:raw->>Address 3";
export type HistorySource = "skiptrak" | "midweigh";
export const historySourceLabel = (source: HistorySource) => source === "skiptrak" ? "Skip" : "Weighbridge";
export function historySiteIdentity(job: Pick<HistoryJob, "customer" | "site">, source: HistorySource) {
  if (!job.site && (source === "skiptrak" || !job.customer)) return null;
  const site = job.site || "Site not recorded";
  const key = source === "midweigh" ? `${job.customer?.toLowerCase().trim() ?? ""}|||${site.toLowerCase().trim()}` : site.toLowerCase().trim();
  return { key, site };
}
export function siteHistorySearchFilters(term: string) {
  const pattern = `%${term.trim().replace(/[,%_()"\\]/g, " ").trim().replace(/\s+/g, "%")}%`;
  const match = (fields: string[]) => fields.map(field => `${field}.ilike.${pattern}`).join(",");
  return {
    jobs: match(["customer", "site", "postcode", "raw->>Location Postc_1", "raw->>Address 2nd LIne", "raw->>Address 3"]),
    mappings: match(["site_name", "data_hub_customer", "data_hub_site", "data_hub_site_2", "data_hub_site_3", "data_hub_site_4", "data_hub_site_5", "address_1", "address_2", "postcode"]),
  };
}
export function historySearchText(job: HistoryJob) {
  return [job.customer, job.site, job.postcode, job.address, job.address2, job.address3].filter(Boolean).join(" ");
}
export function historyStatus(job: HistoryJob, today: string) {
  if (job.source === "midweigh") return "Recorded";
  if (isCompletedRentalMovement(job, today)) return "Completed";
  if (job.job_date && job.job_date > today) return "Booked";
  return "Not completed";
}

/** Most recent completed physical movement for one container type on a site. */
export type LastMovement = { date: string; movement: string; jobId: string; jobNumber: string; waste: string | null; ewc: string | null };
/** One estimated bin position: a Skiptrak site name + container type + EWC. */
export type SiteBin = { site: string; ewc: string | null; waste: string | null; count: number; lastMoved: LastMovement | null };

type GroupPos = ClampPos & { ewc: string | null; waste: string | null; lastMoved: LastMovement | null };

/**
 * Same window, completed movements, per-waste estimate and type clamp as Live Jobs.
 * Live Jobs clamps each Skiptrak site name separately, so a customer site mapped to
 * several Skiptrak names keeps one clamp per name instead of collapsing to one bin.
 */
export function currentSiteContainers(jobs: HistoryJob[], rules: StandingBinRule[], settings: LiveJobsSettings, since: string, today: string) {
  const recent = jobs.filter(j => j.job_date && j.job_date >= since && ["Deliver", "Exchange", "Collect", "Tip/Return"].includes(j.movement_type ?? "") && isCompletedRentalMovement(j, today));
  const groups = new Map<string, { site: string; container: string; category: string; positions: Map<string, GroupPos> }>();
  for (const j of withStandingBins(recent, rules, today)) {
    const category = categoriseContainer(j.container_type, j.vehicle_registration, settings);
    if (!j.container_type || !category || category === "artic") continue;
    const site = (j.site ?? "").trim();
    const groupKey = `${site.toLowerCase()}|||${j.container_type}`;
    const g = groups.get(groupKey) ?? { site, container: j.container_type, category, positions: new Map<string, GroupPos>() };
    const key = j.ewc?.trim() || "__none__";
    const p = g.positions.get(key) ?? { delivered: 0, collected: 0, exchanged: 0, tipReturn: 0, lastKeepDate: null, lastCollectionDate: null, ewc: j.ewc?.trim() || null, waste: null, lastMoved: null };
    if (j.movement_type === "Deliver") p.delivered++;
    if (j.movement_type === "Collect") p.collected++;
    if (j.movement_type === "Exchange") p.exchanged++;
    if (j.movement_type === "Tip/Return") p.tipReturn++;
    if (["Deliver", "Exchange", "Tip/Return"].includes(j.movement_type ?? "") && j.job_date && (!p.lastKeepDate || j.job_date > p.lastKeepDate)) p.lastKeepDate = j.job_date;
    if (j.movement_type === "Collect" && j.job_date && (!p.lastCollectionDate || j.job_date > p.lastCollectionDate)) p.lastCollectionDate = j.job_date;
    // Virtual standing-bin deliveries only restore counts; they are never a real movement date.
    if (!isStandingBinJob(j) && j.job_date && (!p.lastMoved || j.job_date > p.lastMoved.date)) {
      p.lastMoved = { date: j.job_date, movement: j.movement_type ?? "", jobId: j.id, jobNumber: j.job_number, waste: j.waste_description ?? null, ewc: j.ewc ?? null };
      if (j.waste_description) p.waste = j.waste_description;
    }
    if (!p.waste && j.waste_description) p.waste = j.waste_description;
    g.positions.set(key, p); groups.set(groupKey, g);
  }
  const types = new Map<string, { container: string; category: string; count: number; bins: SiteBin[] }>();
  for (const g of groups.values()) {
    const positions = [...g.positions.values()];
    const each = positions.map(p => {
      const net = p.delivered - p.collected;
      const cleared = p.lastCollectionDate && p.lastKeepDate && p.lastCollectionDate >= p.lastKeepDate;
      return cleared && net <= 0 ? 0 : Math.max(net, net >= 0 && (p.exchanged > 0 || p.tipReturn > 0) ? Math.max(1, net) : 0);
    });
    let remaining = Math.min(each.reduce((n, c) => n + c, 0), containerTypeCap(positions));
    const t = types.get(g.container) ?? { container: g.container, category: g.category, count: 0, bins: [] };
    t.count += remaining;
    // When the clamp trims positions (e.g. a waste code changed), the most recently kept code is the bin still there.
    const order = positions.map((p, i) => ({ p, c: each[i] })).sort((a, b) => (b.p.lastKeepDate ?? "").localeCompare(a.p.lastKeepDate ?? ""));
    for (const { p, c } of order) {
      const count = Math.min(c, remaining);
      if (count <= 0) continue;
      remaining -= count;
      t.bins.push({ site: g.site, ewc: p.ewc, waste: p.waste, count, lastMoved: p.lastMoved });
    }
    types.set(g.container, t);
  }
  return [...types.values()].filter(t => t.count > 0).map(t => {
    const bins = t.bins.sort((a, b) => (b.lastMoved?.date ?? "").localeCompare(a.lastMoved?.date ?? ""));
    return { container: t.container, category: t.category, count: t.count, wastes: [...new Set(bins.map(b => b.waste).filter((w): w is string => Boolean(w)))], lastMoved: bins[0]?.lastMoved ?? null, bins };
  });
}
