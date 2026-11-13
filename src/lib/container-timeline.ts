import { addDaysKey } from "./route-job-schedules";

/**
 * Presentation-only timeline of one container (or trailer stream) on a site: each job in its
 * exchange chain becomes a dot, plus warning flags. Nothing here books, moves or saves jobs.
 */
export type DotKind = "completed" | "booked" | "scheduled" | "collection";
export type TimelineDot = {
  key: string; jobNumber: string; date: string; kind: DotKind; movement: string; status: string;
  source: "Skip" | "Route One"; nativeId: string | null;
};
export type TimelineFlag = { date: string; label: string; tone: "warn" | "info" };

export type SkipDotJob = { id: string; job_number: string; job_date: string | null; movement_type: string | null };
export type NativeDotJob = { id: string; job_number: string | null; scheduled_date: string; job_type: string; status: string | null; assigned_driver_id?: string | null; schedule_id?: string | null };

const dayMs = 86_400_000;
const toDate = (key: string) => new Date(`${key}T00:00:00Z`);
export const dayGap = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / dayMs);
export const weekday = (key: string) => toDate(key).getUTCDay();
/** Monday on or before a date. */
export const mondayOf = (key: string) => addDaysKey(key, -((weekday(key) + 6) % 7));
export const dotDay = (key: string) => toDate(key).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
export const dotDate = (key: string) => toDate(key).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const fullDate = (key: string) => toDate(key).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const shortFrequency = (weeks: number) => weeks === 1 ? "Weekly" : `Every ${weeks} weeks`;
const tagFrequency = (weeks: number) => weeks === 1 ? "Weekly" : `every ${weeks} wks`;

const MOVEMENTS: Record<string, string> = { Deliver: "Delivery", Exchange: "Exchange", Collect: "Collection", "Tip/Return": "Tip & return", WasteTruck: "Waste truck" };
const NATIVE_STATUS: Record<string, string> = { unassigned: "Booked, no driver yet", assigned: "Booked, driver assigned", in_progress: "In progress", completed: "Completed", query: "Queried" };

export function skipDot(job: SkipDotJob, completed: boolean, today: string): TimelineDot | null {
  if (!job.job_date) return null;
  const movement = MOVEMENTS[job.movement_type ?? ""] ?? job.movement_type ?? "Job";
  const collection = job.movement_type === "Collect";
  const status = completed ? "Completed" : job.job_date >= today ? "Booked in Skiptrak" : "Not completed in Skiptrak";
  return { key: `skip:${job.job_number}`, jobNumber: job.job_number, date: job.job_date, kind: collection ? "collection" : completed ? "completed" : "booked", movement, status, source: "Skip", nativeId: null };
}

export function nativeDot(job: NativeDotJob): TimelineDot {
  const done = job.status === "completed";
  const fromSchedule = Boolean(job.schedule_id) && !done && (job.status === "unassigned" || !job.assigned_driver_id);
  const movement = job.job_type === "collection" ? "Collection" : job.job_type.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
  const status = (NATIVE_STATUS[job.status ?? ""] ?? "Booked") + (fromSchedule ? " (from schedule)" : "");
  return {
    key: `ro:${job.id}`, jobNumber: job.job_number || "New", date: job.scheduled_date, movement, status, source: "Route One", nativeId: job.id,
    kind: job.job_type === "collection" ? "collection" : done ? "completed" : fromSchedule ? "scheduled" : "booked",
  };
}

/** Merge Skiptrak and Route One dots (Route One copies of a Skiptrak job number are kept once) in date order. */
export function mergeDots(skip: TimelineDot[], native: TimelineDot[]): TimelineDot[] {
  const copies = new Map(native.map(d => [d.jobNumber, d]));
  const seen = new Set(skip.map(d => d.jobNumber));
  // A Skiptrak job copied into Route One keeps the Route One link so it can be opened there.
  return [...skip.map(d => copies.has(d.jobNumber) ? { ...d, nativeId: copies.get(d.jobNumber)!.nativeId } : d), ...native.filter(d => !seen.has(d.jobNumber))]
    .sort((a, b) => a.date.localeCompare(b.date) || a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true }));
}

/**
 * Label sides: dots under six days apart alternate above/below so their labels never overlap.
 * When both sides already hold a label within `minDays` (busy trailer runs) the label is hidden
 * ("none") and the dot's tooltip carries the date instead.
 */
export function labelSides(dots: Pick<TimelineDot, "date">[], minDays = 4): ("above" | "below" | "none")[] {
  const sides: ("above" | "below" | "none")[] = [];
  const last: Record<"above" | "below", string | null> = { above: null, below: null };
  const free = (side: "above" | "below", date: string) => !last[side] || dayGap(last[side]!, date) >= minDays;
  let prevShown: "above" | "below" = "above";
  dots.forEach((d, i) => {
    const close = i > 0 && dayGap(dots[i - 1].date, d.date) < 6;
    const want: "above" | "below" = close ? (prevShown === "below" ? "above" : "below") : "below";
    const other = want === "below" ? "above" : "below";
    const side = free(want, d.date) ? want : close && free(other, d.date) ? other : "none";
    sides.push(side);
    if (side !== "none") { last[side] = d.date; prevShown = side; }
  });
  return sides;
}

/** Short date, adding the year when it is not the current one (e.g. "6 Dec 2025"). */
export const dotDateYear = (key: string, today: string) => key.slice(0, 4) === today.slice(0, 4) ? dotDate(key) : `${dotDate(key)} ${key.slice(0, 4)}`;

/** When the container on site arrived: first delivery after its last completed collection. */
export function onSiteSince(dots: TimelineDot[], today: string): { date: string; jobNumber: string; known: boolean } | null {
  const done = dots.filter(d => d.date <= today && (d.kind === "completed" || (d.kind === "collection" && d.status === "Completed")));
  const lastCollect = done.reduce<number>((at, d, i) => d.kind === "collection" ? i : at, -1);
  const stay = done.slice(lastCollect + 1);
  if (!stay.length) return null;
  const delivery = stay.find(d => d.movement === "Delivery");
  return delivery ? { date: delivery.date, jobNumber: delivery.jobNumber, known: true } : { date: stay[0].date, jobNumber: stay[0].jobNumber, known: false };
}

/**
 * Amber warning tags (weekend bookings, missed weeks, nothing booked ahead, broken chain)
 * and grey info tags (change of frequency) for one container's dots.
 */
export function timelineFlags(dots: TimelineDot[], opts: { today: string; cadenceWeeks: number | null; chained: boolean; scheduleActive: boolean }): TimelineFlag[] {
  const { today, cadenceWeeks, chained, scheduleActive } = opts;
  const flags: TimelineFlag[] = [];
  for (const d of dots) {
    const wd = weekday(d.date);
    if ((wd === 0 || wd === 6) && d.status !== "Completed") flags.push({ date: d.date, label: wd === 6 ? "Saturday?" : "Sunday?", tone: "warn" });
  }
  if (!chained) return flags;

  // Regular runs: exchanges/deliveries in order, gaps in whole weeks.
  const regular = dots.filter(d => d.kind !== "collection");
  const gaps = regular.slice(1).map((d, i) => ({ from: regular[i].date, to: d.date, days: dayGap(regular[i].date, d.date) }));
  const weeks = gaps.map(g => g.days >= 5 ? Math.round(g.days / 7) : 0);
  // Runs of two or more equal gaps set the frequency; a different run after one is a change.
  let established: number | null = null;
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    const run = w > 0 && weeks[i + 1] === w;
    if (run && established && w !== established && (weeks[i - 1] !== w)) flags.push({ date: gaps[i].from, label: `${tagFrequency(established)} → ${tagFrequency(w)}`, tone: "info" });
    if (run) established = w;
    const local = established ?? cadenceWeeks;
    const partOfRun = w > 0 && (weeks[i - 1] === w || weeks[i + 1] === w);
    if (local && w >= 2 * local && w <= 10 && !partOfRun) {
      flags.push({ date: addDaysKey(gaps[i].from, local * 7), label: local === 1 ? "Week missed" : "Cycle missed", tone: "warn" });
    }
  }

  // A container that was collected and then exchanged without a new delivery has lost its link.
  for (let i = 1; i < dots.length; i++) {
    if (dots[i - 1].kind === "collection" && dots[i].movement === "Exchange") flags.push({ date: dots[i].date, label: "Chain broken", tone: "warn" });
  }

  if (cadenceWeeks && !scheduleActive) {
    const future = dots.filter(d => d.date >= today && d.kind !== "collection");
    const collectedAhead = dots.some(d => d.date >= today && d.kind === "collection");
    if (future.length <= 1 && !collectedAhead) {
      const last = future[0]?.date ?? today;
      flags.push({ date: last, label: future.length ? `No bookings after ${dotDay(last)} ${dotDate(last)}` : "Nothing booked ahead", tone: "warn" });
    }
  }
  return flags.sort((a, b) => a.date.localeCompare(b.date));
}

/** Date axis: Mondays from `back` weeks before today to at least `ahead` weeks after (or the last dot). */
export function timelineAxis(today: string, lastDot: string | null, back = 12, ahead = 6, maxAhead = 26, include: string | null = null) {
  const usual = mondayOf(addDaysKey(today, -7 * back));
  const start = include && include < usual ? mondayOf(addDaysKey(include, -14)) : usual;
  const wanted = lastDot && lastDot > addDaysKey(today, 7 * ahead) ? lastDot : addDaysKey(today, 7 * ahead);
  const cap = addDaysKey(today, 7 * maxAhead);
  const end = addDaysKey(mondayOf(wanted < cap ? wanted : cap), 14);
  const mondays: string[] = [];
  for (let d = start; d <= end; d = addDaysKey(d, 7)) mondays.push(d);
  return { start, end, mondays, days: dayGap(start, end) };
}
