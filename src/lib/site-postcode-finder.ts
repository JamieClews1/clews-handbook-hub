/**
 * Helpers for the Customer Setup "Find site by postcode" search.
 * Presentation only: results prefill the site form, nothing is saved until staff press Save.
 */

export interface SiteSearchHit {
  source: "skiptrak" | "midweigh";
  customer: string | null;
  site: string | null;
  postcode: string | null;
  address: string | null;
  address2: string | null;
  address3: string | null;
  job_count: number | null;
  last_date: string | null;
}

export const SITE_SLOTS = ["data_hub_site", "data_hub_site_2", "data_hub_site_3", "data_hub_site_4", "data_hub_site_5"] as const;

export type SiteFinderForm = Record<(typeof SITE_SLOTS)[number] | "site_name" | "data_hub_customer" | "address_1" | "address_2" | "address_3" | "postcode", string>;

/** Turn "cv211ha" into "CV21 1HA" so it matches stored postcodes; other text is passed through. */
export function normaliseSiteSearchTerm(raw: string): string {
  const term = raw.trim().replace(/\s+/g, " ");
  const compact = term.replace(/\s/g, "").toUpperCase();
  if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  return term;
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** True when this hit's site name is already in one of the form's Data Hub site slots. */
export function hitIsLinked(form: SiteFinderForm, hit: SiteSearchHit): boolean {
  return !!hit.site && SITE_SLOTS.some((k) => same(form[k], hit.site));
}

export type ApplyHitResult = { form: SiteFinderForm; status: "added" | "already" | "full" | "no-site" };

/**
 * Link a search hit to the site form: its site name goes into the first empty Data Hub slot,
 * and empty name/customer/address/postcode boxes are filled. Never overwrites what staff typed.
 */
export function applySiteSearchHit<F extends SiteFinderForm>(form: F, hit: SiteSearchHit): { form: F; status: ApplyHitResult["status"] } {
  if (!hit.site?.trim()) return { form, status: "no-site" };
  if (hitIsLinked(form, hit)) return { form, status: "already" };
  const slot = SITE_SLOTS.find((k) => !form[k].trim());
  if (!slot) return { form, status: "full" };
  const next = { ...form, [slot]: hit.site.trim() } as F;
  if (!next.site_name.trim()) next.site_name = (hit.address || hit.site).trim();
  if (!next.data_hub_customer.trim() && hit.customer) next.data_hub_customer = hit.customer.trim();
  const noAddress = !next.address_1.trim() && !next.address_2.trim() && !next.address_3.trim();
  if (noAddress) {
    next.address_1 = (hit.address ?? "").trim();
    next.address_2 = (hit.address2 ?? "").trim();
    next.address_3 = (hit.address3 ?? "").trim();
  }
  if (!next.postcode.trim() && hit.postcode) next.postcode = hit.postcode.trim().toUpperCase();
  return { form: next, status: "added" };
}
