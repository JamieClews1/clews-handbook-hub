import { parseLoadReportDate } from "./load-report-dates";
import { londonCalendarKey } from "./ui-calendar";
import type { OverRentalBin, OverRentalJob } from "./overRental";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

/** Match physical sizes, not spelling or a pricing 'Inc 3t' suffix. */
export function rentalContainerKey(value: string): string {
  return value.toLowerCase()
    .replace(/\binc(?:luded)?\s*\d+(?:\.\d+)?\s*(?:t|tonnes?|tons?)?\b/g, "")
    .replace(/roll\s*on\s*roll\s*off|ro\s*-?\s*ro|roro/g, "roro")
    .replace(/yards?|yds?/g, "yd")
    .replace(/enclosed|\benc\b/g, "enclosed")
    .replace(/skip|chain\s*lift/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function isCompletedRentalMovement(job: OverRentalJob, today = londonCalendarKey()): boolean {
  if (!job.job_date || !parseLoadReportDate(job.job_date) || job.job_date > today) return false;
  const status = String(job.rental_status ?? "").trim().toUpperCase();
  // Older uploads omitted Status. Retain their historical movements, but never
  // count explicitly uncompleted/query/void bookings as physical movements.
  return status === "" || status === "Y";
}

type Slot = { job: OverRentalJob; date: string; ewc: string };

/** Replay physical movements so collections consume stock and exchanges replace
 * the old ticket, even when its EWC or container spelling changed. */
export function openRentalBins(
  jobs: OverRentalJob[], settings: LiveJobsSettings, windowStart: string,
  categorise: (container: string | null, reg: string | null, settings: LiveJobsSettings) => OverRentalBin["category"] | null,
  today = londonCalendarKey(),
): OverRentalBin[] {
  const groups = new Map<string, { category: OverRentalBin["category"]; slots: Slot[] }>();
  const movements = jobs.filter(j => isCompletedRentalMovement(j, today))
    .sort((a, b) => (a.job_date ?? "").localeCompare(b.job_date ?? "") || a.job_number.localeCompare(b.job_number, undefined, { numeric: true }) || a.id.localeCompare(b.id));
  for (const job of movements) {
    const category = categorise(job.container_type, job.vehicle_registration, settings);
    if (!category || category === "artic" || !job.container_type || !job.job_date) continue;
    const key = `${(job.site ?? "Unknown").trim().toLowerCase().replace(/\s+/g, " ")}|||${category}|||${rentalContainerKey(job.container_type)}`;
    const group = groups.get(key) ?? { category, slots: [] };
    groups.set(key, group);
    const ewc = (job.ewc ?? "").replace(/\s/g, "");
    const matching = group.slots.findIndex(s => s.ewc === ewc);
    const index = matching >= 0 ? matching : 0;
    const slot = { job, date: job.job_date, ewc };
    if (job.movement_type === "Deliver") group.slots.push(slot);
    if (job.movement_type === "Collect" && group.slots.length) group.slots.splice(index, 1);
    if (job.movement_type === "Exchange" || job.movement_type === "Tip/Return") {
      if (group.slots.length) group.slots.splice(index, 1, slot);
      else group.slots.push(slot); // establishing delivery may predate the read window
    }
    group.slots.sort((a, b) => a.date.localeCompare(b.date));
  }
  const todayDate = parseLoadReportDate(today);
  if (!todayDate) return [];
  const bins: OverRentalBin[] = [];
  for (const { category, slots } of groups.values()) {
    const overdue = slots.filter(s => {
      const date = parseLoadReportDate(s.date);
      return date && s.date >= windowStart && (todayDate.getTime() - date.getTime()) / 86400000 > settings.rental_free_days;
    });
    const oldest = overdue[0];
    if (!oldest) continue;
    const date = parseLoadReportDate(oldest.date);
    if (!date) continue;
    const job = oldest.job;
    const site = job.site ?? "Unknown";
    const containerType = job.container_type ?? "";
    bins.push({ binKey: `${site.toLowerCase().trim()}|||${containerType.toLowerCase().trim()}`, customer: job.customer ?? "Unknown", site, category, containerType,
      netOnSite: overdue.length, daysSinceActivity: (todayDate.getTime() - date.getTime()) / 86400000,
      lastActivityDate: oldest.date, lastJobNumber: job.job_number });
  }
  return bins.sort((a, b) => (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0));
}