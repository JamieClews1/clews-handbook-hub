import { parseLoadReportDate } from "./load-report-dates";

export type InsightsComparison = "off" | "year" | "previous";
export type InsightsPeriod = { start: string; end: string; compare: InsightsComparison };
export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function validDay(value: string | null): value is string { return Boolean(value && parseLoadReportDate(value)); }
export function capReportingEnd(end: string, today = londonToday()): string { return end > today ? today : end; }
function dayKey(date: Date) { return date.toISOString().slice(0, 10); }
function shiftYear(value: string) {
  const d = parseLoadReportDate(value);
  if (!d) return value;
  const month = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  if (d.getUTCMonth() !== month) d.setUTCDate(0);
  return dayKey(d);
}
export function comparisonPeriod(period: InsightsPeriod): { start: string; end: string } | null {
  if (period.compare === "off") return null;
  if (period.compare === "year") return { start: shiftYear(period.start), end: shiftYear(period.end) };
  const start = parseLoadReportDate(period.start); const end = parseLoadReportDate(period.end);
  if (!start || !end) return null;
  const length = end.getTime() - start.getTime() + 86400000;
  return { start: dayKey(new Date(start.getTime() - length)), end: dayKey(new Date(start.getTime() - 86400000)) };
}
export function annualReportingPeriod(year: number, today = londonToday()): InsightsPeriod {
  return { start: `${year}-01-01`, end: capReportingEnd(`${year}-12-31`, today), compare: "year" };
}
export function periodLabel(start: string, end: string) {
  const fmt = (key: string) => parseLoadReportDate(key)?.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) ?? key;
  return `${fmt(start)} – ${fmt(end)}`;
}
export function metricDelta(current: number, previous: number, rate = false): number | null {
  return rate ? current - previous : previous === 0 ? null : (current - previous) / Math.abs(previous) * 100;
}