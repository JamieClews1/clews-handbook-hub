// A container that comes back round to Rentals (after an exchange, tip/return or a
// new delivery) is a new rental: its chase status, assignee, agreed-to-pay and notes
// start fresh. Each rental is identified by the ticket that started its clock.
// "Collected" and "Own Skip" markings describe the site's container itself, so they
// still apply across rentals. Nothing here talks to the database.

import { londonCalendarKey } from "./ui-calendar";

export type RentalEpisodeBin = {
  binKey: string;
  lastJobNumber: string | null;
  lastActivityDate: string | null;
};

const LEGACY = "legacy:";

// Rental clock start as yyyy-MM-dd.
export function rentalStartDate(bin: RentalEpisodeBin): string | null {
  const raw = bin.lastActivityDate?.trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// Stable id for the current rental of a bin.
export function rentalRefFor(bin: RentalEpisodeBin): string {
  const job = bin.lastJobNumber?.trim();
  if (job) return `job:${job}`;
  const start = rentalStartDate(bin);
  return start ? `date:${start}` : "unknown";
}

function londonDay(timestamp: string): string {
  return londonCalendarKey(new Date(timestamp));
}

// Chases made before per-rental tracking carry "legacy:<day last worked>": they
// belong to the current rental only if they were worked on once it had started.
export function chaseBelongsToRental(row: { rental_ref: string | null; updated_at?: string | null }, bin: RentalEpisodeBin): boolean {
  const ref = row.rental_ref;
  if (ref && !ref.startsWith(LEGACY)) return ref === rentalRefFor(bin);
  const start = rentalStartDate(bin);
  if (!start) return true;
  const worked = ref ? ref.slice(LEGACY.length) : row.updated_at ? londonDay(row.updated_at) : null;
  return !!worked && worked >= start;
}

// Notes written before per-rental tracking have no rental_ref: they belong to the
// current rental only if written on or after the day it started.
export function noteBelongsToRental(row: { rental_ref: string | null; created_at: string }, bin: RentalEpisodeBin): boolean {
  if (row.rental_ref) return row.rental_ref === rentalRefFor(bin);
  const start = rentalStartDate(bin);
  if (!start) return true;
  return londonDay(row.created_at) >= start;
}

// The chase for the bin's current rental, if one exists. An exact match wins over a
// legacy chase still in date.
export function currentRentalChase<T extends { bin_key: string; rental_ref: string | null; updated_at?: string | null }>(
  rows: readonly T[] | undefined,
  bin: RentalEpisodeBin,
): T | undefined {
  if (!rows?.length) return undefined;
  const ref = rentalRefFor(bin);
  return rows.find((r) => r.rental_ref === ref) ?? rows.find((r) => chaseBelongsToRental(r, bin));
}
