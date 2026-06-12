import { supabase } from "@/integrations/supabase/client";

/**
 * A site's rebate charging-model assignment, now effective-dated.
 *
 * Effective dating rules:
 * - `effective_from` is the first date (inclusive) this charging model applies.
 * - `effective_to` is the last date (inclusive) it applies; `null` means open-ended.
 * - Dates are stored as `yyyy-MM-dd` strings, which compare correctly
 *   lexicographically.
 */
export interface PriceSetLink {
  price_set_id: string;
  effective_from: string | null;
  effective_to: string | null;
  rebate_price_sets?: { name: string } | null;
}

/**
 * Given all of a site's price-set assignments, return the one that applies on
 * `referenceDate` (a `yyyy-MM-dd` string).
 *
 * Selection logic:
 * 1. Prefer assignments whose [effective_from, effective_to] window covers the
 *    reference date.
 * 2. When several cover it, the one with the latest `effective_from` wins.
 * 3. As a defensive fallback (e.g. reporting a period before any assignment
 *    existed), return the assignment with the earliest `effective_from` so a
 *    report still renders rather than failing.
 */
export function selectActivePriceSetLink<
  T extends { effective_from: string | null; effective_to: string | null }
>(rows: T[] | null | undefined, referenceDate: string): T | null {
  if (!rows || rows.length === 0) return null;

  const covering = rows.filter(
    (r) =>
      (!r.effective_from || r.effective_from <= referenceDate) &&
      (!r.effective_to || r.effective_to >= referenceDate)
  );

  if (covering.length > 0) {
    return covering
      .slice()
      .sort((a, b) => (b.effective_from ?? "").localeCompare(a.effective_from ?? ""))[0];
  }

  // No window covers the reference date — fall back to the earliest assignment.
  return rows
    .slice()
    .sort((a, b) => (a.effective_from ?? "").localeCompare(b.effective_from ?? ""))[0];
}

/**
 * Fetch the price-set assignment active for a site on the given reporting date.
 * `referenceDate` should normally be the END of the reporting period, matching
 * the existing rule that multi-month reports use the latest month's rates.
 */
export async function fetchActivePriceSetLink(
  siteId: string,
  referenceDate: string,
  withName = false
): Promise<PriceSetLink | null> {
  const { data, error } = await supabase
    .from("customer_site_price_sets")
    .select(
      withName
        ? "price_set_id, effective_from, effective_to, rebate_price_sets(name)"
        : "price_set_id, effective_from, effective_to"
    )
    .eq("site_id", siteId);

  if (error || !data || data.length === 0) return null;
  return selectActivePriceSetLink(data as unknown as PriceSetLink[], referenceDate);
}
