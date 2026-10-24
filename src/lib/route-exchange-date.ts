import { parseLoadReportDate } from "./load-report-dates";

export type BookingWindow = { zone_label: string; skip_day: string | null; roro_day: string | null };
export type BookingZone = { zone_name: string; postcodes: string[] };

export function nextExchangeBookingDate(form: Record<string, any>, windows: BookingWindow[], zones: BookingZone[], today: string): string | null {
  const container = `${form.container_type || ""} ${form.container_size || ""}`.toLowerCase();
  const field = /ro\s*ro|ro-ro|roll[ -]*on/.test(container) ? "roro_day" : /skip|\d+\s*(?:yd|yard)|chain lift/.test(container) ? "skip_day" : null;
  if (!field) return null;
  const pc = String(form.site_postcode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const candidates = pc.length >= 5 ? [pc, pc.slice(0, -3) + pc.slice(-3, -2), pc.slice(0, -3)] : [pc];
  let zone: BookingZone | undefined;
  for (const candidate of candidates) {
    if (!candidate) continue;
    zone = zones.find(z => z.postcodes.some(p => p.toUpperCase().replace(/[^A-Z0-9]/g, "") === candidate));
    if (zone) break;
  }
  const zoneNumber = zone?.zone_name.match(/^zone\s*(\d+)/i)?.[1];
  if (!zoneNumber) return null;
  const matches = windows.filter(w => /^zone\b/i.test(w.zone_label) && Array.from(w.zone_label.matchAll(/\d+/g), match => match[0]).includes(zoneNumber));
  // Exact single-zone rows take precedence over combined "Zone 2 + 3" rows.
  const window = matches.find(w => (w.zone_label.match(/\d+/g) || []).length === 1) || (matches.length === 1 ? matches[0] : undefined);
  const weekday = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }[String(window?.[field] || "").trim().toUpperCase() as "MON"];
  const date = parseLoadReportDate(today);
  if (weekday === undefined || !date) return null;
  date.setUTCDate(date.getUTCDate() + (weekday - date.getUTCDay() + 7) % 7);
  return date.toISOString().slice(0, 10);
}