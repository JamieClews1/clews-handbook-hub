// Total Report maths for Stock Check → Inventory.
//
// The report estimates the Clews-owned working fleet that still needs a
// catalogued profile. Two things are left out of the fleet:
//   * customer-owned containers (marked "Own Skip" in Rentals) — they need no
//     Clews profile, and
//   * Scrapped / Yard Use bins — they are out of service and will likely be
//     scrapped, so they must not inflate "out on jobs", "in yard" or
//     "still required".
//
// Condition is only recorded on catalogued profiles, so an out-of-service bin
// is removed from the size it is catalogued as. A bin is counted once: it comes
// off the yard first (that is where written-off bins physically sit), and only
// the remainder comes off customer sites, so the same bin is never removed
// from both sides.

export interface TotalReportInput {
  id: string;
  name: string;
  category: string;
  /** In-yard count from the latest tally plus completed movements. */
  inYard: number;
  /** Containers on customer sites, including customer-owned ones. */
  onSite: number;
  /** Of onSite, containers marked "Own Skip" in Rentals. */
  ownOnSite: number;
  /** Catalogued profiles for this size marked Scrapped or Yard Use. */
  outOfService: number;
  /** Catalogued profiles for this size that are working stock. */
  catalogued: number;
}

export interface TotalReportType {
  id: string;
  name: string;
  category: string;
  /** Working Clews bins in the yard (scrap / yard use removed). */
  inYard: number;
  /** Working Clews bins out on customer sites (own bins removed). */
  onSiteClews: number;
  /** inYard + onSiteClews. */
  fleet: number;
  catalogued: number;
  /** Estimated working fleet without a catalogued profile. */
  required: number;
}

const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

export const totalReportType = (t: TotalReportInput): TotalReportType => {
  const yardRaw = whole(t.inYard);
  const siteRaw = whole(t.onSite);
  const ownRaw = whole(t.ownOnSite);
  const oos = whole(t.outOfService);
  const siteClews = Math.max(0, siteRaw - ownRaw);

  const yardCut = Math.min(yardRaw, oos);
  const siteCut = Math.min(siteClews, oos - yardCut);

  const inYard = yardRaw - yardCut;
  const onSiteClews = siteClews - siteCut;
  const fleet = inYard + onSiteClews;
  const catalogued = whole(t.catalogued);

  return {
    id: t.id,
    name: t.name,
    category: t.category,
    inYard,
    onSiteClews,
    fleet,
    catalogued,
    required: Math.max(0, fleet - catalogued),
  };
};

export interface TotalReportTotals {
  out: number;
  yard: number;
  required: number;
}

export const totalReportTotals = (
  rows: TotalReportType[],
  category: string,
): TotalReportTotals => {
  const inCategory = rows.filter((t) => t.category === category);
  return {
    out: inCategory.reduce((a, t) => a + t.onSiteClews, 0),
    yard: inCategory.reduce((a, t) => a + t.inYard, 0),
    required: inCategory.reduce((a, t) => a + t.required, 0),
  };
};
