import { differenceInDays, format, startOfMonth, subMonths } from "date-fns";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

// Faithful copy of the over-rental detection used by the Live Jobs dashboard, so
// the Rentals section stays perfectly consistent with it. See
// src/components/live-jobs/LiveJobsDashboard.tsx for the original, heavily
// commented implementation.

export type OverRentalJob = {
  id: string;
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  waste_description: string | null;
  vehicle_registration: string | null;
  ewc: string | null;
};

export type ContainerCategory = "skip" | "roro" | "artic";

export type OverRentalBin = {
  binKey: string;
  customer: string;
  site: string;
  category: ContainerCategory;
  containerType: string;
  netOnSite: number;
  daysSinceActivity: number | null;
  lastActivityDate: string | null;
  lastJobNumber: string | null;
};

export function categoriseContainer(
  containerType: string | null,
  vehicleReg: string | null,
  settings: LiveJobsSettings
): ContainerCategory | null {
  const ct = containerType?.toLowerCase() ?? "";

  const isSkip = ct && settings.skip_container_keywords.some((kw) => ct.includes(kw.toLowerCase()));
  const isRoro = ct && settings.roro_container_keywords.some((kw) => ct.includes(kw.toLowerCase()));
  const isArticContainer = ct && settings.artic_container_keywords.some((kw) => ct.includes(kw.toLowerCase()));

  if (isRoro) return "roro";
  if (isSkip) return "skip";
  if (isArticContainer) return "artic";

  if (vehicleReg) {
    const vr = vehicleReg.toUpperCase().replace(/\s+/g, "");
    if (settings.artic_vehicle_regs.some((r) => r.replace(/\s+/g, "").toUpperCase() === vr)) return "artic";
  }

  return null;
}

const isDelivery = (m: string | null) => m === "Deliver";
const isCollection = (m: string | null) => m === "Collect";
const isExchange = (m: string | null) => m === "Exchange";
const isTipReturn = (m: string | null) => m === "Tip/Return";
const staysOnSite = (m: string | null) => isDelivery(m) || isExchange(m) || isTipReturn(m);

type PosCounts = {
  delivered: number;
  collected: number;
  exchanged: number;
  tipReturn: number;
  lastKeepDate: string | null;
  lastCollectionDate: string | null;
  ewc: string | null;
  wasteTypes: Set<string>;
};

function positionNetOnSite(p: PosCounts): number {
  const net = p.delivered - p.collected;
  const cleared = !!(p.lastCollectionDate && p.lastKeepDate && p.lastCollectionDate >= p.lastKeepDate);
  if (cleared && net <= 0) return 0;
  return Math.max(net, 0);
}

function typeNetOnSite(positions: Record<string, PosCounts> | undefined): number {
  if (!positions) return 0;
  return Object.values(positions).reduce((sum, p) => sum + positionNetOnSite(p), 0);
}

type CtbBreakdown = {
  delivered: number;
  collected: number;
  exchanged: number;
  lastDeliveryOrExchangeDate: string | null;
  lastTipReturnDate: string | null;
  lastCollectionDate: string | null;
  wasteTypes: Set<string>;
  positions: Record<string, PosCounts>;
};

type SiteAgg = {
  customers: Set<string>;
  latestCustomer: string;
  latestCustomerDate: string | null;
  site: string;
  category: ContainerCategory;
  delivered: number;
  collected: number;
  exchanged: number;
  lastDeliveryOrExchangeDate: string | null;
  lastTipReturnDate: string | null;
  lastCollectionDate: string | null;
  containerTypeBreakdown: Record<string, CtbBreakdown>;
};

export function computeOverRentalBins(
  jobs: OverRentalJob[],
  settings: LiveJobsSettings,
  // Only flag containers whose most recent keep movement (deliver/exchange/tip-return)
  // falls on/after this date. The `jobs` array should contain the FULL movement history
  // so net on-site is accurate even when the establishing delivery is years old (e.g. a
  // long-standing RoRo serviced only by exchanges). This gate then excludes ancient
  // "ghost" deliveries that were never collected and have had no activity since.
  // Format: yyyy-MM-dd. Defaults to 11 calendar months ago.
  activityWindowStart?: string
): OverRentalBin[] {
  const windowStart =
    activityWindowStart ?? format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
  const siteMap: Record<string, SiteAgg> = {};

  for (const job of jobs) {
    const cat = categoriseContainer(job.container_type, job.vehicle_registration, settings);
    if (!cat) continue;

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
        lastTipReturnDate: null,
        lastCollectionDate: null,
        containerTypeBreakdown: {},
      };
    }

    siteMap[key].customers.add(customerName);
    if (job.job_date && (!siteMap[key].latestCustomerDate || job.job_date > siteMap[key].latestCustomerDate!)) {
      siteMap[key].latestCustomer = customerName;
      siteMap[key].latestCustomerDate = job.job_date;
    }

    if (job.container_type) {
      if (!siteMap[key].containerTypeBreakdown[job.container_type]) {
        siteMap[key].containerTypeBreakdown[job.container_type] = {
          delivered: 0,
          collected: 0,
          exchanged: 0,
          lastDeliveryOrExchangeDate: null,
          lastTipReturnDate: null,
          lastCollectionDate: null,
          wasteTypes: new Set(),
          positions: {},
        };
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
      if (job.job_date && isTipReturn(job.movement_type)) {
        if (!ctb.lastTipReturnDate || job.job_date > ctb.lastTipReturnDate) {
          ctb.lastTipReturnDate = job.job_date;
        }
      }
      if (job.job_date && isCollection(job.movement_type)) {
        if (!ctb.lastCollectionDate || job.job_date > ctb.lastCollectionDate) {
          ctb.lastCollectionDate = job.job_date;
        }
      }

      const posKey = (job.ewc && job.ewc.trim()) || "__none__";
      if (!ctb.positions[posKey]) {
        ctb.positions[posKey] = {
          delivered: 0,
          collected: 0,
          exchanged: 0,
          tipReturn: 0,
          lastKeepDate: null,
          lastCollectionDate: null,
          ewc: (job.ewc && job.ewc.trim()) || null,
          wasteTypes: new Set(),
        };
      }
      const pos = ctb.positions[posKey];
      if (job.waste_description) pos.wasteTypes.add(job.waste_description);
      if (isDelivery(job.movement_type)) pos.delivered++;
      if (isCollection(job.movement_type)) pos.collected++;
      if (isExchange(job.movement_type)) pos.exchanged++;
      if (isTipReturn(job.movement_type)) pos.tipReturn++;
      if (job.job_date && staysOnSite(job.movement_type)) {
        if (!pos.lastKeepDate || job.job_date > pos.lastKeepDate) pos.lastKeepDate = job.job_date;
      }
      if (job.job_date && isCollection(job.movement_type)) {
        if (!pos.lastCollectionDate || job.job_date > pos.lastCollectionDate) pos.lastCollectionDate = job.job_date;
      }
    }

    if (isDelivery(job.movement_type)) siteMap[key].delivered++;
    if (isCollection(job.movement_type)) siteMap[key].collected++;
    if (isExchange(job.movement_type)) siteMap[key].exchanged++;

    if (job.job_date && (isDelivery(job.movement_type) || isExchange(job.movement_type))) {
      if (!siteMap[key].lastDeliveryOrExchangeDate || job.job_date > siteMap[key].lastDeliveryOrExchangeDate!) {
        siteMap[key].lastDeliveryOrExchangeDate = job.job_date;
      }
    }
    if (job.job_date && isTipReturn(job.movement_type)) {
      if (!siteMap[key].lastTipReturnDate || job.job_date > siteMap[key].lastTipReturnDate!) {
        siteMap[key].lastTipReturnDate = job.job_date;
      }
    }
    if (job.job_date && isCollection(job.movement_type)) {
      if (!siteMap[key].lastCollectionDate || job.job_date > siteMap[key].lastCollectionDate!) {
        siteMap[key].lastCollectionDate = job.job_date;
      }
    }
  }

  const overRental: OverRentalBin[] = [];

  for (const s of Object.values(siteMap)) {
    if (s.category === "artic") continue;

    const lastKeepDate = [s.lastDeliveryOrExchangeDate, s.lastTipReturnDate]
      .filter((d): d is string => !!d)
      .sort()
      .pop() ?? null;
    const collectionClearedIt = s.lastCollectionDate && lastKeepDate && s.lastCollectionDate >= lastKeepDate;
    const daysSinceLastKeep = lastKeepDate ? differenceInDays(new Date(), new Date(lastKeepDate)) : null;
    const netDeliveredOnSite = Object.values(s.containerTypeBreakdown).reduce(
      (sum, ctb) => sum + typeNetOnSite(ctb.positions),
      0
    );
    const isOverRental =
      daysSinceLastKeep !== null &&
      daysSinceLastKeep > settings.rental_free_days &&
      netDeliveredOnSite > 0 &&
      !collectionClearedIt &&
      // Exclude ancient ghost deliveries with no recent activity
      lastKeepDate !== null &&
      lastKeepDate >= windowStart;

    if (!isOverRental) continue;

    for (const [containerType, ctb] of Object.entries(s.containerTypeBreakdown)) {
      const onSiteForType = typeNetOnSite(ctb.positions);
      if (onSiteForType <= 0) continue;
      const ctbLastKeep = [ctb.lastDeliveryOrExchangeDate, ctb.lastTipReturnDate]
        .filter((d): d is string => !!d)
        .sort()
        .pop() ?? null;
      const days = ctbLastKeep ? differenceInDays(new Date(), new Date(ctbLastKeep)) : null;
      if (days === null || days <= settings.rental_free_days) continue;
      // This container type must itself have had recent activity (not an old ghost)
      if (ctbLastKeep < windowStart) continue;

      const binKey = `${s.site.toLowerCase().trim()}|||${containerType.toLowerCase().trim()}`;
      overRental.push({
        binKey,
        customer: s.latestCustomer,
        site: s.site,
        category: s.category,
        containerType,
        netOnSite: onSiteForType,
        daysSinceActivity: days,
        lastActivityDate: ctbLastKeep,
        lastJobNumber: null,
      });
    }
  }

  overRental.sort((a, b) => (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0));
  return overRental;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate-based path (Rentals dashboard)
//
// Computing over-rental from raw rows requires the FULL movement history so that a
// container delivered years ago (and only serviced by exchanges since) still shows a
// positive net on-site. Fetching ~40k raw rows to the client is too slow, so the DB
// function `get_skiptrak_rental_positions()` pre-aggregates one row per
// site+container_type+EWC. This function reproduces the exact over-rental math from
// `computeOverRentalBins` on top of those aggregates.
// ─────────────────────────────────────────────────────────────────────────────

export type RentalPositionRow = {
  site: string;
  container_type: string;
  ewc: string;
  customer: string | null;
  delivered: number;
  collected: number;
  exchanged: number;
  tipreturn: number;
  last_keep_date: string | null;
  last_collection_date: string | null;
  last_job_number: string | null;
};

function positionNetFromRow(r: RentalPositionRow): number {
  const net = r.delivered - r.collected;
  const cleared = !!(r.last_collection_date && r.last_keep_date && r.last_collection_date >= r.last_keep_date);
  if (cleared && net <= 0) return 0;
  return Math.max(net, 0);
}

const maxDate = (a: string | null, b: string | null): string | null => {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
};

export function computeOverRentalBinsFromPositions(
  rows: RentalPositionRow[],
  settings: LiveJobsSettings,
  activityWindowStart?: string
): OverRentalBin[] {
  const windowStart =
    activityWindowStart ?? format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

  type Agg = {
    site: string;
    category: ContainerCategory;
    latestCustomer: string;
    latestCustomerDate: string | null;
    siteLastKeep: string | null;
    siteLastCollection: string | null;
    netOnSite: number;
    byContainer: Record<string, { net: number; lastKeep: string | null; lastJobNumber: string | null }>;
  };
  const siteMap: Record<string, Agg> = {};

  for (const r of rows) {
    const cat = categoriseContainer(r.container_type, null, settings);
    if (!cat || cat === "artic") continue;

    const key = `${(r.site || "Unknown").toLowerCase().trim()}|||${cat}`;
    const posNet = positionNetFromRow(r);
    const customerName = r.customer || "Unknown";
    // Treat the more recent of keep/collection as this position's activity date.
    const activityDate = maxDate(r.last_keep_date, r.last_collection_date);

    if (!siteMap[key]) {
      siteMap[key] = {
        site: r.site || "Unknown",
        category: cat,
        latestCustomer: customerName,
        latestCustomerDate: activityDate,
        siteLastKeep: null,
        siteLastCollection: null,
        netOnSite: 0,
        byContainer: {},
      };
    }
    const agg = siteMap[key];

    if (activityDate && (!agg.latestCustomerDate || activityDate > agg.latestCustomerDate)) {
      agg.latestCustomer = customerName;
      agg.latestCustomerDate = activityDate;
    }

    agg.siteLastKeep = maxDate(agg.siteLastKeep, r.last_keep_date);
    agg.siteLastCollection = maxDate(agg.siteLastCollection, r.last_collection_date);
    agg.netOnSite += posNet;

    if (!agg.byContainer[r.container_type]) {
      agg.byContainer[r.container_type] = { net: 0, lastKeep: null, lastJobNumber: null };
    }
    agg.byContainer[r.container_type].net += posNet;
    const prevKeep = agg.byContainer[r.container_type].lastKeep;
    const newKeep = r.last_keep_date;
    agg.byContainer[r.container_type].lastKeep = maxDate(prevKeep, newKeep);
    if (newKeep && (!prevKeep || newKeep > prevKeep)) {
      agg.byContainer[r.container_type].lastJobNumber = r.last_job_number;
    }
  }

  const overRental: OverRentalBin[] = [];

  for (const s of Object.values(siteMap)) {
    const collectionClearedIt =
      !!(s.siteLastCollection && s.siteLastKeep && s.siteLastCollection >= s.siteLastKeep);
    const daysSinceLastKeep = s.siteLastKeep
      ? differenceInDays(new Date(), new Date(s.siteLastKeep))
      : null;

    const isOverRental =
      daysSinceLastKeep !== null &&
      daysSinceLastKeep > settings.rental_free_days &&
      s.netOnSite > 0 &&
      !collectionClearedIt &&
      s.siteLastKeep !== null &&
      s.siteLastKeep >= windowStart;

    if (!isOverRental) continue;

    for (const [containerType, ctb] of Object.entries(s.byContainer)) {
      if (ctb.net <= 0) continue;
      const ctbLastKeep = ctb.lastKeep;
      const days = ctbLastKeep ? differenceInDays(new Date(), new Date(ctbLastKeep)) : null;
      if (days === null || days <= settings.rental_free_days) continue;
      if (ctbLastKeep < windowStart) continue;

      const binKey = `${s.site.toLowerCase().trim()}|||${containerType.toLowerCase().trim()}`;
      overRental.push({
        binKey,
        customer: s.latestCustomer,
        site: s.site,
        category: s.category,
        containerType,
        netOnSite: ctb.net,
        daysSinceActivity: days,
        lastActivityDate: ctbLastKeep,
      });
    }
  }

  overRental.sort((a, b) => (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0));
  return overRental;
}

