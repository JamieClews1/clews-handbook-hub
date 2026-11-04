import type { ContainerCategory } from "./overRental";

export type RentalBinFilters = {
  /** "all" for no customer filter, otherwise an exact customer name. */
  customer: string;
  category: "all" | ContainerCategory;
  /** "all" for every container type, otherwise an exact container type. */
  size: string;
};

export const ALL_RENTAL_FILTERS: RentalBinFilters = { customer: "all", category: "all", size: "all" };

type FilterableBin = {
  customer: string;
  category: ContainerCategory;
  containerType: string;
};

/**
 * Narrow a rentals list by customer, then container category, then size.
 * "all" means that filter is not applied.
 */
export function filterRentalBins<T extends FilterableBin>(bins: T[], filters: RentalBinFilters): T[] {
  return bins.filter((b) => {
    if (filters.customer !== "all" && b.customer !== filters.customer) return false;
    if (filters.category !== "all" && b.category !== filters.category) return false;
    if (filters.size !== "all" && b.containerType !== filters.size) return false;
    return true;
  });
}

/** Customers in the list with how many bins each holds, sorted A–Z. */
export function customerBinCounts(bins: FilterableBin[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of bins) counts.set(b.customer, (counts.get(b.customer) ?? 0) + 1);
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
