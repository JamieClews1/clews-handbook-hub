export const SITE_CLASSES = {
  tipping_site: "Tipping site",
  broker: "Broker",
  haulage: "Haulage",
} as const;

export type SiteClass = keyof typeof SITE_CLASSES;

export function isSiteClass(value: string): value is SiteClass {
  return Object.prototype.hasOwnProperty.call(SITE_CLASSES, value);
}

export function tippingEligible<T extends { site_class?: SiteClass }>(sites: T[]): T[] {
  return sites.filter(site => (site.site_class ?? "tipping_site") === "tipping_site");
}

export function unlistedOutgoing<T extends { site_name: string }>(outgoing: T[], saved: { site_name: string }[]): T[] {
  const savedNames = new Set(saved.map(site => site.site_name.trim().toLowerCase()));
  return outgoing.filter(site => !savedNames.has(site.site_name.trim().toLowerCase()));
}