export type WasteProductStatus = "active" | "needs_review" | "retired";
export interface WasteProduct { id: string; recorded_name: string; display_name: string; ewc_code: string; status: WasteProductStatus; notes: string | null }

export const PRODUCT_STATUS: Record<WasteProductStatus, string> = { active: "In use", needs_review: "Needs review", retired: "Retired" };

/** Case/space-insensitive key so ticket product text finds its catalogue entry. */
export const productKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function findProduct(products: WasteProduct[], recorded: string) {
  const k = productKey(recorded);
  return products.find(p => productKey(p.recorded_name) === k) ?? null;
}

export function filterProducts(products: WasteProduct[], q: string, status: WasteProductStatus | "all") {
  const k = productKey(q);
  return products.filter(p => (status === "all" || p.status === status) &&
    (!k || productKey(`${p.recorded_name} ${p.display_name} ${p.ewc_code}`).includes(k)));
}