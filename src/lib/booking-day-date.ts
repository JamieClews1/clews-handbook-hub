import { addDays, format } from "date-fns";

/**
 * Day codes used by the Route One "Taking Bookings For" board. Each code is
 * stored as-is in route_one_booking_windows; the date is always derived from
 * the current day so the board can never drift out of date.
 */
export const BOOKING_DAY_CODES = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
  "TBC",
] as const;

const CODE_TO_WEEKDAY: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/**
 * The next calendar date matching a booking day code, counting today as an
 * occurrence. Returns null for codes that carry no date (TBC or blank).
 */
export function bookingDayDate(
  day: string | null | undefined,
  today: Date = new Date(),
): Date | null {
  const code = (day ?? "").trim().toUpperCase();
  const target = CODE_TO_WEEKDAY[code];
  if (target === undefined) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return addDays(start, (target - start.getDay() + 7) % 7);
}

/**
 * Day code with its date: "MON 19". When the date falls in another month the
 * month is added ("MON 2 Nov"), and the year when it crosses into a new one.
 */
export function bookingDayLabel(
  day: string | null | undefined,
  today: Date = new Date(),
): string {
  const code = (day ?? "").trim().toUpperCase() || "TBC";
  const date = bookingDayDate(day, today);
  if (!date) return code;
  if (date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) {
    return `${code} ${format(date, "d")}`;
  }
  const sameYear = date.getFullYear() === today.getFullYear();
  return `${code} ${format(date, sameYear ? "d MMM" : "d MMM yy")}`;
}

/** Full date behind a day code, for tooltips: "Monday 19 October 2026". */
export function bookingDayFull(
  day: string | null | undefined,
  today: Date = new Date(),
): string | undefined {
  const date = bookingDayDate(day, today);
  return date ? format(date, "EEEE d MMMM yyyy") : undefined;
}
