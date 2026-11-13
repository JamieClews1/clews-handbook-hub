import { recordedContainerBooking } from "./recorded-container-booking";

/** Calendar maths on yyyy-MM-dd keys in UTC so London calendar dates never shift. */
const toDate = (key: string) => new Date(`${key}T00:00:00Z`);
const toKey = (date: Date) => date.toISOString().slice(0, 10);
export const addDaysKey = (key: string, days: number) => { const d = toDate(key); d.setUTCDate(d.getUTCDate() + days); return toKey(d); };
const dayGap = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);

export type ScheduleRule = { start_date: string; interval_weeks: number; end_date?: string | null };

export const scheduleFrequencyLabel = (weeks: number) => weeks === 1 ? "Every week" : `Every ${weeks} weeks`;

/** Occurrences of a repeating schedule between two dates (inclusive). */
export function scheduleOccurrences(rule: ScheduleRule, from: string, to: string): string[] {
  const step = Math.max(1, Math.round(rule.interval_weeks)) * 7;
  const end = rule.end_date && rule.end_date < to ? rule.end_date : to;
  const first = from > rule.start_date ? from : rule.start_date;
  let d = addDaysKey(rule.start_date, step * Math.ceil(dayGap(rule.start_date, first) / step));
  const out: string[] = [];
  while (d <= end) { out.push(d); d = addDaysKey(d, step); }
  return out;
}

export const nextScheduleDate = (rule: ScheduleRule, today: string) => scheduleOccurrences(rule, today, addDaysKey(today, 7 * 53))[0] ?? null;

/**
 * Repeat interval in weeks from a bin's movement dates (completed and already booked).
 * Uses the latest four gaps; ties go to the most recent gap so a change of pattern wins.
 */
export function detectCadenceWeeks(dates: (string | null | undefined)[]): number | null {
  const sorted = [...new Set(dates.filter((d): d is string => Boolean(d)))].sort();
  const days = sorted.slice(1).map((d, i) => dayGap(sorted[i], d)).slice(-4);
  // Several runs a week (e.g. daily trailers) are not a weekly repeat.
  if (days.length < 2 || days.some(g => g < 5)) return null;
  const gaps = days.map(g => Math.round(g / 7)).filter(w => w >= 1 && w <= 26);
  if (gaps.length < 2) return null;
  const counts = new Map<number, number>();
  for (const g of gaps) counts.set(g, (counts.get(g) ?? 0) + 1);
  const best = Math.max(...counts.values());
  if (best < 2) return null;
  for (let i = gaps.length - 1; i >= 0; i--) if (counts.get(gaps[i]) === best) return gaps[i];
  return null;
}

const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const ewcKey = (v: string | null | undefined) => (v ?? "").replace(/[\s*]/g, "");

export type BinPosition = { site: string; container: string; ewc: string | null };
export type FutureBooking = { key: string; date: string; type: string; source: "Skip" | "Route One"; scheduleId?: string | null };
type SkipJob = { job_number: string; job_date: string | null; site: string | null; container_type: string | null; ewc: string | null; movement_type: string | null };
type NativeJob = { job_number: string | null; id: string; scheduled_date: string; site_name: string | null; container_type: string | null; container_size: string | null; ewc_code: string | null; job_type: string; schedule_id?: string | null };

/** Future bookings already made for one bin position (e.g. 51520 booked after exchange 51518). */
export function binFutureBookings(bin: BinPosition, skip: SkipJob[], native: NativeJob[], isOpenFuture: (j: SkipJob) => boolean): FutureBooking[] {
  const booking = recordedContainerBooking(bin.container);
  const rows = new Map<string, FutureBooking>();
  for (const j of skip) {
    if (!j.job_date || !isOpenFuture(j)) continue;
    if (norm(j.site) !== norm(bin.site) || norm(j.container_type) !== norm(bin.container) || ewcKey(j.ewc) !== ewcKey(bin.ewc)) continue;
    rows.set(j.job_number, { key: j.job_number, date: j.job_date, type: j.movement_type ?? "Job", source: "Skip" });
  }
  for (const j of native) {
    const key = j.job_number || j.id;
    if (rows.has(key) || norm(j.site_name) !== norm(bin.site) || ewcKey(j.ewc_code) !== ewcKey(bin.ewc)) continue;
    const sameContainer = booking.container_size
      ? j.container_size === booking.container_size
      : norm(j.container_type) === norm(bin.container);
    if (!sameContainer) continue;
    rows.set(key, { key, date: j.scheduled_date, type: j.job_type, source: "Route One", scheduleId: j.schedule_id ?? null });
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Date for the next exchange of a bin. With bookings already made, it follows the last one by the
 * bin's repeat interval (one week when unknown); otherwise the booking-window date stands.
 */
export function nextExchangeAfterBookings(lastBooked: string | null, cadenceWeeks: number | null, windowDate: string | null): string | null {
  if (!lastBooked) return windowDate;
  const after = addDaysKey(lastBooked, 7 * (cadenceWeeks ?? 1));
  return windowDate && windowDate > after ? windowDate : after;
}

export type ScheduleRow = {
  id: string; customer_name: string; site_name: string | null; site_address: string | null; site_address_2: string | null; site_postcode: string | null;
  site_contact_name: string | null; site_contact_phone: string | null; match_site: string | null; match_container: string | null;
  job_type: string; container_type: string | null; container_size: string | null; waste_type: string | null; ewc_code: string | null;
  po_number: string | null; notes: string | null; haulage_cost: number | null; charge_per_tonne: number | null; min_weight_charge: number | null;
  weight_included_t: number | null; cost_items: unknown; vat_rate: number; own_container: boolean; interval_weeks: number; start_date: string;
  end_date: string | null; book_ahead_days: number; booked_until: string | null; active: boolean; source_job_number: string | null;
};

/** Whether a saved schedule covers a bin position shown in the site pop-up. */
export const scheduleCoversBin = (s: Pick<ScheduleRow, "match_site" | "match_container" | "ewc_code">, bin: BinPosition) =>
  norm(s.match_site) === norm(bin.site) && norm(s.match_container) === norm(bin.container) && ewcKey(s.ewc_code) === ewcKey(bin.ewc);
