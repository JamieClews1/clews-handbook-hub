import { recordedContainerBooking } from "./recorded-container-booking";

/** Skiptrak movement wording → Route One job type, for repeating a previous job as-is. */
const MOVEMENT_JOB_TYPES: Record<string, string> = {
  deliver: "delivery", collect: "collection", exchange: "exchange", wastetruck: "waste_truck", "tip/return": "tip_return",
};
export function skiptrakMovementJobType(movement: string | null | undefined): string | null {
  return MOVEMENT_JOB_TYPES[(movement ?? "").toLowerCase().replace(/\s+/g, "")] ?? null;
}

/** Trailer work (curtain side, walking floor, ejector) — same wording rules as the booking form. */
export function isArticContainer(container: string | null | undefined) {
  return recordedContainerBooking(container).container_type === "Artic";
}

type ArticSourceJob = { id: string; job_number: string; job_date: string | null; site?: string | null; container_type?: string | null; movement_type?: string | null; waste_description?: string | null; ewc?: string | null };
export type ArticSiteJob = {
  key: string; site: string; container: string; waste: string | null; ewc: string | null;
  /** Movement counts over the period, e.g. { "Waste Truck": 93, Exchange: 6 }. */
  movements: Record<string, number>;
  total: number;
  last: { id: string; jobNumber: string; date: string; movement: string; jobType: string };
  /** A trailer has been left on site (delivered/exchanged), so an exchange swaps it. */
  standing: boolean;
};

const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const movementLabel = (m: string) => m === "WasteTruck" ? "Waste Truck" : m;

/**
 * Previous trailer jobs on a site, one entry per trailer stream (site name + trailer + EWC),
 * so staff can repeat the last job or book an exchange of a standing trailer. Rental charge
 * lines (Other1) and future bookings are ignored; nothing here is saved.
 */
export function previousArticJobs(jobs: ArticSourceJob[], today: string): ArticSiteJob[] {
  const groups = new Map<string, ArticSiteJob>();
  for (const j of jobs) {
    if (!j.job_date || j.job_date > today || !isArticContainer(j.container_type)) continue;
    const jobType = skiptrakMovementJobType(j.movement_type);
    if (!jobType) continue;
    const ewc = j.ewc?.trim() || null;
    const key = `${norm(j.site)}|||${norm(j.container_type)}|||${norm(ewc)}`;
    const movement = movementLabel(j.movement_type ?? "");
    const g = groups.get(key) ?? { key, site: (j.site ?? "").trim(), container: (j.container_type ?? "").trim(), waste: null, ewc, movements: {}, total: 0, last: { id: j.id, jobNumber: j.job_number, date: j.job_date, movement, jobType }, standing: false };
    g.movements[movement] = (g.movements[movement] ?? 0) + 1;
    g.total++;
    if (["delivery", "exchange", "tip_return"].includes(jobType)) g.standing = true;
    if (j.job_date > g.last.date || (j.job_date === g.last.date && j.job_number.localeCompare(g.last.jobNumber, undefined, { numeric: true }) > 0)) {
      g.last = { id: j.id, jobNumber: j.job_number, date: j.job_date, movement, jobType };
      if (j.waste_description) g.waste = j.waste_description;
    }
    if (!g.waste && j.waste_description) g.waste = j.waste_description;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.last.date.localeCompare(a.last.date));
}
