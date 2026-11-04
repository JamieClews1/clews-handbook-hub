import wasteIn from "@/data/midweigh-waste-in-types.json";
import { productKey } from "@/lib/waste-products";

/** How many of the most common inbound waste types are pulled to the top of the picker. */
export const WASTE_IN_TOP_N = 10;

type Row = { waste_type?: string | null; loads?: number | null };

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Loads per inbound waste type name, from the Midweigh inbound (Waste In) analysis. */
export function wasteInTypeLoads(): Map<string, number> {
  const loads = new Map<string, number>();
  for (const row of (wasteIn.rows as Row[]) ?? []) {
    const key = productKey(String(row?.waste_type ?? ""));
    if (!key) continue;
    loads.set(key, (loads.get(key) ?? 0) + Number(row?.loads ?? 0));
  }
  return loads;
}

const TYPE_LOADS = wasteInTypeLoads();

/** Loads recorded for a waste type name, or null when the analysis has never seen it. */
export const wasteInLoadsFor = (wasteType: string | null | undefined): number | null =>
  TYPE_LOADS.get(productKey(wasteType ?? "")) ?? null;

export type WasteInPickable = { waste_type?: string | null; ewc_code?: string | null };

/**
 * Picker order: the busiest inbound waste types first (most loads, then name),
 * everything else alphabetically. Types the analysis has never seen are never
 * promoted, so a brand new entry simply joins the alphabetical run.
 */
export function rankWasteInTypes<T extends WasteInPickable>(types: T[], topN = WASTE_IN_TOP_N): T[] {
  const ranked: T[] = [];
  for (const t of types) {
    const loads = wasteInLoadsFor(t.waste_type);
    if (loads && loads > 0) ranked.push(t);
  }
  ranked.sort((a, b) =>
    (wasteInLoadsFor(b.waste_type) ?? 0) - (wasteInLoadsFor(a.waste_type) ?? 0) ||
    (a.waste_type ?? "").localeCompare(b.waste_type ?? "", "en", { sensitivity: "base" }),
  );
  const top = ranked.slice(0, Math.max(0, topN));
  const rest = types.filter(t => !top.includes(t)).sort((a, b) =>
    (a.waste_type ?? "").localeCompare(b.waste_type ?? "", "en", { sensitivity: "base" }) ||
    (a.ewc_code ?? "").localeCompare(b.ewc_code ?? "", "en", { sensitivity: "base" }),
  );
  return [...top, ...rest];
}

/** Filter a ranked list without disturbing its order. */
export function searchWasteInTypes<T extends WasteInPickable>(ranked: T[], q: string): T[] {
  const needle = compact(q);
  if (!needle) return ranked;
  return ranked.filter(t => compact(`${t.waste_type ?? ""} ${t.ewc_code ?? ""}`).includes(needle));
}

/** One entry per waste type + EWC; the rate card stores some types twice. Keeps `keepId` if it is a duplicate. */
export function dedupeWasteInTypes<T extends WasteInPickable & { id: string }>(types: T[], keepId?: string): T[] {
  const byKey = new Map<string, T>();
  for (const t of types) {
    const key = `${compact(t.waste_type ?? "")}|${compact(t.ewc_code ?? "")}`;
    if (!byKey.has(key) || t.id === keepId) byKey.set(key, t);
  }
  return [...byKey.values()];
}
