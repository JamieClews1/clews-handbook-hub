/**
 * Duty of Care → Waste Types: outgoing Midweigh loads regrouped by agreed reference
 * code and ranked by volume. Read-only presentation of the snapshot figures.
 */
import { HAULAGE_ONLY_REF, WASTE_STREAMS, resolveWasteStream, standardWasteName } from "@/lib/waste-streams";

export type WasteTypePart = { name: string; loads: number; tonnes: number };
export type WasteTypeEwcRow = { ewc: string; description: string; loads: number; tonnes: number; products: WasteTypePart[]; destinations: WasteTypePart[] };

export interface WasteTypeEwcShare {
  ewc: string;
  description: string;
  /** Destinations are recorded per EWC, so they cover every product on this code. */
  destinations: WasteTypePart[];
  /** True when other reference codes also sit on this EWC, so the destinations are shared. */
  shared: boolean;
}

export interface WasteTypeReferenceRow {
  key: string;
  ref: string | null;
  name: string;
  loads: number;
  tonnes: number;
  /** Recorded Midweigh product wording, most loads first. */
  products: WasteTypePart[];
  ewcs: WasteTypeEwcShare[];
}

export type WasteTypeSort = "tonnes" | "loads" | "ref" | "code";

export const NO_PRODUCT = "No product recorded";

const ewcNumber = (ewc: string) => Number(ewc.replace(/[^0-9]/g, "")) || 0;

export function wasteTypeReferenceRows(rows: WasteTypeEwcRow[]): WasteTypeReferenceRow[] {
  const byKey = new Map<string, WasteTypeReferenceRow>();
  const keysPerEwc = new Map<string, Set<string>>();
  for (const row of rows) {
    // Loads on this EWC with no product recorded stay visible rather than being dropped or guessed.
    const unrecordedLoads = row.loads - row.products.reduce((s, p) => s + p.loads, 0);
    const unrecordedTonnes = row.tonnes - row.products.reduce((s, p) => s + p.tonnes, 0);
    const parts = unrecordedLoads > 0 ? [...row.products, { name: "", loads: unrecordedLoads, tonnes: Math.max(0, unrecordedTonnes) }] : row.products;
    for (const p of parts) {
      const opts = { source: "midweigh", direction: "outgoing" as const };
      const stream = p.name ? resolveWasteStream({ ...opts, name: p.name, ewc: row.ewc }) : null;
      const name = p.name ? stream?.name ?? standardWasteName(p.name, row.ewc, opts) : NO_PRODUCT;
      const key = stream ? `ref:${stream.ref}` : `name:${name.toLowerCase()}|${row.ewc}`;
      const cur = byKey.get(key) ?? { key, ref: stream?.ref ?? null, name, loads: 0, tonnes: 0, products: [], ewcs: [] };
      cur.loads += p.loads;
      cur.tonnes += p.tonnes;
      if (p.name) cur.products.push({ ...p });
      if (!cur.ewcs.some((e) => e.ewc === row.ewc)) cur.ewcs.push({ ewc: row.ewc, description: row.description, destinations: row.destinations, shared: false });
      byKey.set(key, cur);
      const set = keysPerEwc.get(row.ewc) ?? new Set<string>();
      set.add(key);
      keysPerEwc.set(row.ewc, set);
    }
  }
  const out = [...byKey.values()];
  for (const r of out) {
    r.tonnes = Math.round(r.tonnes * 100) / 100;
    r.products.sort((a, b) => b.loads - a.loads);
    for (const e of r.ewcs) e.shared = (keysPerEwc.get(e.ewc)?.size ?? 0) > 1;
  }
  return sortWasteTypeRows(out, "tonnes");
}

/**
 * Adds every agreed waste stream that had no loads in the snapshot (e.g. WOOD-CA),
 * as a zero-volume row, so the page lists every reference code. Haulage Only is a
 * job type, not a waste, so it is left out.
 */
export function withAllAgreedStreams(rows: WasteTypeReferenceRow[]): WasteTypeReferenceRow[] {
  const seen = new Set(rows.map((r) => r.ref).filter(Boolean));
  const extra: WasteTypeReferenceRow[] = WASTE_STREAMS
    .filter((s) => s.ref !== HAULAGE_ONLY_REF && !seen.has(s.ref))
    .map((s) => ({
      key: `ref:${s.ref}`, ref: s.ref, name: s.name, loads: 0, tonnes: 0, products: [],
      ewcs: s.ewc ? [{ ewc: s.ewc, description: "", destinations: [], shared: false }] : [],
    }));
  return [...rows, ...extra];
}

export function sortWasteTypeRows(rows: WasteTypeReferenceRow[], sort: WasteTypeSort): WasteTypeReferenceRow[] {
  const byVolume = (a: WasteTypeReferenceRow, b: WasteTypeReferenceRow) => b.tonnes - a.tonnes || b.loads - a.loads || a.name.localeCompare(b.name);
  return [...rows].sort((a, b) => {
    if (sort === "loads") return b.loads - a.loads || byVolume(a, b);
    if (sort === "ref") {
      if (!a.ref !== !b.ref) return a.ref ? -1 : 1;
      return (a.ref ?? a.name).localeCompare(b.ref ?? b.name) || byVolume(a, b);
    }
    if (sort === "code") return ewcNumber(a.ewcs[0]?.ewc ?? "") - ewcNumber(b.ewcs[0]?.ewc ?? "") || byVolume(a, b);
    return byVolume(a, b);
  });
}
