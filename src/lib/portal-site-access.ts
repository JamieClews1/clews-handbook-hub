/** Helpers for choosing which sites (jobs) a customer portal user can see. */

export type PortalAccessSite = {
  id: string;
  customer_id: string;
  is_archived?: boolean | null;
};

/**
 * Every site a portal user can be given in one click: all sites on their own
 * account, including archived ones, so "Select all" ticks everything shown in the
 * access list (archived sites still hold historical jobs). Other customers' sites
 * are never included.
 */
export function allAccessSiteIds<T extends PortalAccessSite>(sites: T[], customerId: string): string[] {
  return sites.filter((s) => s.customer_id === customerId).map((s) => s.id);
}
