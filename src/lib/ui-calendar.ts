import { parseLoadReportDate } from "./load-report-dates";

/** Local date-only key: never convert a local calendar midnight to UTC. */
export function localCalendarKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function londonCalendarKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function ticketDateLabel(value: string | null): string {
  return parseLoadReportDate(value)?.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }) ?? "—";
}

export const TICKET_PAGE_SIZE = 50;

/** Presentation only: preserve source meaning while removing raw casing. */
export function ticketStateLabel(value: string | null): string {
  if (!value?.trim()) return "—";
  const text = value.trim().replace(/_/g, " ").toLowerCase();
  return text[0].toUpperCase() + text.slice(1);
}

export function ticketPage<T>(items: T[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(items.length / TICKET_PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, pages));
  return { page, pages, items: items.slice((page - 1) * TICKET_PAGE_SIZE, page * TICKET_PAGE_SIZE) };
}