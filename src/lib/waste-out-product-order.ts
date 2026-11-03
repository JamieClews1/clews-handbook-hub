import wasteOut from "@/data/midweigh-waste-out-types.json";
import { productKey } from "@/lib/waste-products";

/** How many of the most common products are pulled to the top of the picker. */
export const WASTE_OUT_TOP_N = 5;

type Part = { name?: string | null; loads?: number | null };
type Row = { products?: Part[] | null };

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Loads per recorded product name, from the Duty of Care Waste Types analysis. */
export function wasteOutProductLoads(): Map<string, number> {
  const loads = new Map<string, number>();
  for (const row of (wasteOut.rows as Row[]) ?? []) {
    for (const part of row.products ?? []) {
      const key = productKey(String(part?.name ?? ""));
      if (!key) continue;
      loads.set(key, (loads.get(key) ?? 0) + Number(part?.loads ?? 0));
    }
  }
  return loads;
}

const PRODUCT_LOADS = wasteOutProductLoads();

/** Loads recorded for a product name, or null when the analysis has never seen it. */
export const wasteOutLoadsFor = (recorded: string | null | undefined): number | null =>
  PRODUCT_LOADS.get(productKey(recorded ?? "")) ?? null;

export type WasteOutPickable = { recorded_name?: string | null; display_name: string };

/**
 * Picker order: the busiest products first (most common loads, then name),
 * everything else alphabetically. Products the analysis has never seen are
 * never promoted, so a brand new entry simply joins the alphabetical run.
 */
export function rankWasteOutProducts<T extends WasteOutPickable>(products: T[], topN = WASTE_OUT_TOP_N): T[] {
  const known = new Set<T>();
  const ranked: T[] = [];
  for (const p of products) {
    const loads = wasteOutLoadsFor(p.recorded_name);
    if (loads && loads > 0) {
      known.add(p);
      ranked.push(p);
    }
  }
  ranked.sort((a, b) =>
    (wasteOutLoadsFor(b.recorded_name) ?? 0) - (wasteOutLoadsFor(a.recorded_name) ?? 0) ||
    a.display_name.localeCompare(b.display_name, "en", { sensitivity: "base" }),
  );
  const top = ranked.slice(0, Math.max(0, topN));
  const rest = products.filter(p => !top.includes(p)).sort((a, b) =>
    a.display_name.localeCompare(b.display_name, "en", { sensitivity: "base" }) ||
    (a.recorded_name ?? "").localeCompare(b.recorded_name ?? "", "en", { sensitivity: "base" }),
  );
  return [...top, ...rest];
}

/** Filter a ranked list without disturbing its order. */
export function searchWasteOutProducts<T extends WasteOutPickable & { ewc_code?: string | null }>(ranked: T[], q: string): T[] {
  const needle = compact(q);
  if (!needle) return ranked;
  return ranked.filter(p => compact(`${p.display_name} ${p.ewc_code ?? ""} ${p.recorded_name ?? ""}`).includes(needle));
}
