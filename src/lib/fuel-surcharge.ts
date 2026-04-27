// Fuel Surcharge calculation utilities
// Rules (from business spec + screenshot rate card):
//  - Apply only to jobs dated >= effective_from of any active rate (>= 2026-04-01)
//  - Movement type must be Deliver / Wait & Load / Exchange (Skiptrak) — Weighbridge Tip
//    midweigh records are also chargeable as a flat per-tip fee.
//  - Vehicle category derived from Skiptrak `raw.Category` (Skips / Roll on Roll off /
//    Artic Curtain Side) or source=midweigh => Weighbridge Tip.
//  - Zone derived from Skiptrak `raw.Location Postc` matched against postcode_zones.
//    Anything outside Zone 1/2/3 (or no postcode) falls back to Zone 3 (max).
//  - Weighbridge Tip ignores zone — uses 'NA'.

export type VehicleCategory = "Weighbridge Tip" | "Skips" | "RoRo" | "Artic";
export type SurchargeZone = "NA" | "Zone 1" | "Zone 2" | "Zone 3";

export interface FuelSurchargeRate {
  id: string;
  effective_from_date: string; // YYYY-MM-DD
  vehicle_category: VehicleCategory;
  zone: SurchargeZone;
  surcharge_amount: number;
  active: boolean;
  notes?: string | null;
  customer_match?: string | null; // optional case-insensitive substring of customer name
}

export interface PostcodeZoneRow {
  zone_name: string;
  postcodes: string[];
}

export interface RawJob {
  id: string;
  job_number: string | null;
  source: string | null;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  movement_type: string | null;
  job_type: string | null;
  container_type: string | null;
  vehicle_registration: string | null;
  raw: Record<string, any> | null;
}

export interface SurchargeCalc {
  applied: boolean;
  reason?: string;
  vehicle_category: VehicleCategory | null;
  zone: SurchargeZone | null;
  zone_was_fallback: boolean;
  postcode: string | null;
  surcharge_amount: number;
  rate_id: string | null;
}

const ELIGIBLE_MOVEMENTS = ["deliver", "exchange", "wait/load", "wait and load", "wait & load"];

export function classifyVehicle(job: RawJob): VehicleCategory | null {
  if (job.source === "midweigh") return "Weighbridge Tip";

  const cat = (job.raw?.["Category"] ?? "").toString().toLowerCase();
  const container = (job.container_type ?? "").toLowerCase();
  const blob = `${cat} ${container}`;

  if (/artic|curtain/.test(blob)) return "Artic";
  if (/roll on roll off|roro|ro ro|ro-ro/.test(blob)) return "RoRo";
  if (/skip/.test(blob)) return "Skips";
  return null;
}

export function isEligibleMovement(job: RawJob): boolean {
  // Weighbridge tips (midweigh) are always eligible per the rate card
  if (job.source === "midweigh") return true;
  const m = (job.movement_type ?? "").toLowerCase().trim();
  return ELIGIBLE_MOVEMENTS.includes(m);
}

export function extractPostcode(job: RawJob): string | null {
  const raw = job.raw ?? {};
  const candidates = [
    raw["Location Postc"],
    raw["Location Postcode"],
    raw["Postcode"],
    raw["Site Postcode"],
  ].filter(Boolean) as string[];
  if (candidates.length === 0) return null;
  return candidates[0].toString().trim().toUpperCase();
}

/**
 * Match a postcode against zones. Returns Zone 1/2/3 or null if not found.
 * Treats "Zone 3 RoRo Only" / "Zone 4 RoRo Only" as Zone 3 (max) for surcharge purposes.
 * "Out of Zones" → null (will fallback to Zone 3 by caller).
 */
export function zoneForPostcode(
  postcode: string | null,
  zones: PostcodeZoneRow[]
): SurchargeZone | null {
  if (!postcode) return null;
  const pc = postcode.toUpperCase().replace(/\s+/g, " ").trim();
  // Try full postcode then progressively shorter prefixes
  const variants = new Set<string>();
  variants.add(pc);
  variants.add(pc.replace(/\s+/g, ""));
  // outward + first digit of inward (e.g. "CV23 8")
  const m = pc.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d)/);
  if (m) variants.add(`${m[1]} ${m[2]}`);

  for (const z of zones) {
    const setU = new Set(z.postcodes.map((p) => p.toUpperCase().trim()));
    for (const v of variants) {
      if (setU.has(v) || setU.has(v.replace(/\s+/g, ""))) {
        if (/^zone\s*1/i.test(z.zone_name)) return "Zone 1";
        if (/^zone\s*2/i.test(z.zone_name)) return "Zone 2";
        if (/^zone\s*3/i.test(z.zone_name)) return "Zone 3";
        if (/^zone\s*4/i.test(z.zone_name)) return "Zone 3"; // RoRo Zone 4 → Zone 3 max
        if (/out of zones/i.test(z.zone_name)) return null;
      }
    }
  }
  return null;
}

/**
 * Find the active rate for a vehicle/zone effective on a given job date.
 * Customer-specific rates (customer_match set & matches the job customer) take precedence
 * over generic rates and ignore zone (treated as flat fees).
 * Picks the most recent effective_from_date <= job_date among active rows.
 */
export function findRate(
  rates: FuelSurchargeRate[],
  vehicle: VehicleCategory,
  zone: SurchargeZone,
  jobDate: string,
  customer?: string | null
): FuelSurchargeRate | null {
  const cust = (customer ?? "").toLowerCase();
  const sameDateDesc = (a: FuelSurchargeRate, b: FuelSurchargeRate) =>
    a.effective_from_date < b.effective_from_date ? 1 : -1;

  // 1. Customer-specific override (zone ignored — flat fee)
  if (cust) {
    const customerCandidates = rates
      .filter(
        (r) =>
          r.active &&
          r.vehicle_category === vehicle &&
          r.effective_from_date <= jobDate &&
          r.customer_match &&
          cust.includes(r.customer_match.toLowerCase())
      )
      .sort(sameDateDesc);
    if (customerCandidates.length > 0) return customerCandidates[0];
  }

  // 2. Generic zone-based rate
  const candidates = rates
    .filter(
      (r) =>
        r.active &&
        !r.customer_match &&
        r.vehicle_category === vehicle &&
        r.zone === zone &&
        r.effective_from_date <= jobDate
    )
    .sort(sameDateDesc);
  return candidates[0] ?? null;
}

/**
 * Build a set of midweigh ticket numbers (job_number) that are already represented
 * by a Skiptrak job (via raw->>'Weighbridge'). These midweigh records are duplicates
 * and should be excluded from surcharge calculation/reporting.
 */
export function buildLinkedMidweighTickets(jobs: RawJob[]): Set<string> {
  const linked = new Set<string>();
  for (const j of jobs) {
    if (j.source !== "skiptrak") continue;
    const wb = j.raw?.["Weighbridge"];
    if (wb === null || wb === undefined || wb === "") continue;
    linked.add(String(wb).trim());
  }
  return linked;
}

export function calculateSurcharge(
  job: RawJob,
  rates: FuelSurchargeRate[],
  zones: PostcodeZoneRow[],
  linkedMidweighTickets?: Set<string>
): SurchargeCalc {
  const empty: SurchargeCalc = {
    applied: false,
    vehicle_category: null,
    zone: null,
    zone_was_fallback: false,
    postcode: null,
    surcharge_amount: 0,
    rate_id: null,
  };

  if (!job.job_date) return { ...empty, reason: "No job date" };

  // De-dupe: midweigh ticket already represented by a Skiptrak job
  if (
    job.source === "midweigh" &&
    linkedMidweighTickets &&
    job.job_number &&
    linkedMidweighTickets.has(String(job.job_number).trim())
  ) {
    return { ...empty, reason: "Duplicate of Skiptrak job (weighbridge ticket linked)" };
  }

  // Earliest possible effective date guard — anything before any rate exists won't apply
  const minEffective = rates.reduce<string | null>(
    (acc, r) => (acc === null || r.effective_from_date < acc ? r.effective_from_date : acc),
    null
  );
  if (minEffective && job.job_date < minEffective)
    return { ...empty, reason: `Before fuel surcharge effective date (${minEffective})` };

  if (!isEligibleMovement(job))
    return { ...empty, reason: `Movement type not chargeable (${job.movement_type ?? "n/a"})` };

  const vehicle = classifyVehicle(job);
  if (!vehicle) return { ...empty, reason: "Vehicle category not classified" };

  const postcode = extractPostcode(job);
  let zone: SurchargeZone;
  let fallback = false;

  if (vehicle === "Weighbridge Tip") {
    zone = "NA";
  } else {
    const matched = zoneForPostcode(postcode, zones);
    if (matched) {
      zone = matched;
    } else {
      zone = "Zone 3"; // fallback for outside / missing
      fallback = true;
    }
  }

  const rate = findRate(rates, vehicle, zone, job.job_date);
  if (!rate)
    return {
      ...empty,
      vehicle_category: vehicle,
      zone,
      zone_was_fallback: fallback,
      postcode,
      reason: "No active rate configured",
    };

  return {
    applied: true,
    vehicle_category: vehicle,
    zone,
    zone_was_fallback: fallback,
    postcode,
    surcharge_amount: Number(rate.surcharge_amount),
    rate_id: rate.id,
  };
}

export function formatGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
