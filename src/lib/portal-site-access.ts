/** Helpers for choosing which sites (jobs) a customer portal user can see. */

export type PortalAccessSite = {
  id: string;
  customer_id: string;
  is_archived?: boolean | null;
};

/**
 * Every site a portal user can be given in one click: all active sites on their
 * own account. Archived sites stay out so "select all" never reopens a closed site,
 * and other customers' sites are never included.
 */
export function allAccessSiteIds<T extends PortalAccessSite>(sites: T[], customerId: string): string[] {
  return sites.filter((s) => s.customer_id === customerId && !s.is_archived).map((s) => s.id);
}
