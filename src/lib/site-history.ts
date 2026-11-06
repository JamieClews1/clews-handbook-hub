import type { OverRentalJob, ClampPos } from "./overRental";
import { categoriseContainer, containerTypeCap } from "./overRental";
import { isCompletedRentalMovement } from "./rental-open-movements";
import { withStandingBins, type StandingBinRule } from "./standing-bins";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

export type HistoryJob = OverRentalJob & { source: string; address?: string | null; address2?: string | null; address3?: string | null; driver?: string | null; weight_t?: number | null };
export const HISTORY_FIELDS = "id,source,job_number,job_date,customer,site,postcode,container_type,movement_type,waste_description,vehicle_registration,ewc,weight_t,driver,rental_status:raw->>Status,address:raw->>Location Postc_1,address2:raw->>Address 2nd LIne,address3:raw->>Address 3";
export function historySearchText(job: HistoryJob) {
  return [job.customer, job.site, job.postcode, job.address, job.address2, job.address3].filter(Boolean).join(" ");
}
export function historyStatus(job: HistoryJob, today: string) {
  if (isCompletedRentalMovement(job, today)) return "Completed";
  if (job.job_date && job.job_date > today) return "Booked";
  return "Not completed";
}

/** Same window, completed movements, per-waste estimate and type clamp as Live Jobs. */
export function currentSiteContainers(jobs: HistoryJob[], rules: StandingBinRule[], settings: LiveJobsSettings, since: string, today: string) {
  const recent = jobs.filter(j => j.job_date && j.job_date >= since && ["Deliver", "Exchange", "Collect", "Tip/Return"].includes(j.movement_type ?? "") && isCompletedRentalMovement(j, today));
  const types = new Map<string, { container: string; category: string; wastes: Set<string>; positions: Map<string, ClampPos> }>();
  for (const j of withStandingBins(recent, rules, today)) {
    const category = categoriseContainer(j.container_type, j.vehicle_registration, settings);
    if (!j.container_type || !category || category === "artic") continue;
    const t = types.get(j.container_type) ?? { container: j.container_type, category, wastes: new Set<string>(), positions: new Map<string, ClampPos>() };
    const key = j.ewc?.trim() || "__none__";
    const p = t.positions.get(key) ?? { delivered: 0, collected: 0, exchanged: 0, tipReturn: 0, lastKeepDate: null, lastCollectionDate: null };
    if (j.movement_type === "Deliver") p.delivered++;
    if (j.movement_type === "Collect") p.collected++;
    if (j.movement_type === "Exchange") p.exchanged++;
    if (j.movement_type === "Tip/Return") p.tipReturn++;
    if (["Deliver", "Exchange", "Tip/Return"].includes(j.movement_type ?? "") && j.job_date && (!p.lastKeepDate || j.job_date > p.lastKeepDate)) p.lastKeepDate = j.job_date;
    if (j.movement_type === "Collect" && j.job_date && (!p.lastCollectionDate || j.job_date > p.lastCollectionDate)) p.lastCollectionDate = j.job_date;
    if (j.waste_description) t.wastes.add(j.waste_description);
    t.positions.set(key, p); types.set(j.container_type, t);
  }
  return [...types.values()].map(t => {
    const positions = [...t.positions.values()];
    const estimate = positions.reduce((n, p) => {
      const net = p.delivered - p.collected;
      const cleared = p.lastCollectionDate && p.lastKeepDate && p.lastCollectionDate >= p.lastKeepDate;
      return n + (cleared && net <= 0 ? 0 : Math.max(net, net >= 0 && (p.exchanged > 0 || p.tipReturn > 0) ? Math.max(1, net) : 0));
    }, 0);
    return { container: t.container, category: t.category, wastes: [...t.wastes], count: Math.min(estimate, containerTypeCap(positions)) };
  }).filter(t => t.count > 0);
}