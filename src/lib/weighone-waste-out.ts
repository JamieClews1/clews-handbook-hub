import { CONTAINER_GROUPS } from "./container-taxonomy";

/** Waste Out offers every Skip, Ro Ro and Artic container from the shared taxonomy. */
export const WASTE_OUT_CONTAINERS = CONTAINER_GROUPS
  .filter(g => g.value === "Skip" || g.value === "Ro Ro" || g.value === "Artic")
  .map(g => ({ group: g.label, vehicle: g.value, options: g.sizes.map(s => `${g.label} · ${s.label}`) }));

/** Map one historical container description onto the shared taxonomy label. */
export function taxonomyContainer(raw: string | null | undefined): string | null {
  const k = (raw ?? "").toLowerCase();
  if (!k.trim()) return null;
  if (/walking|moving floor/.test(k)) return "ARTIC · Walking Floor";
  if (/ejector/.test(k)) return "ARTIC · Ejector";
  if (/curtain|artic|trailer/.test(k)) return "ARTIC · Curtain";
  if (/compactor/.test(k)) return "RORO · 35 yd Compactor";
  if (/ro\s*-?\s*ro/.test(k)) {
    if (/enclosed/.test(k)) return "RORO · 35 yd Enclosed";
    if (/20/.test(k)) return "RORO · 20 yd";
    if (/25/.test(k)) return "RORO · 25 yd";
    return "RORO · 35 / 40 yd";
  }
  if (/skip/.test(k)) {
    if (/enclosed/.test(k)) return "SKIP · 12 yd enclosed";
    for (const [re, l] of [[/\b6/, "6 yd"], [/\b8/, "8 yd"], [/\b12/, "12 yd"], [/\b1[46]/, "14 / 16 yd"]] as const) if (re.test(k)) return `SKIP · ${l}`;
    return "SKIP · 8 yd";
  }
  return null;
}

/** Recognise a truck from its previous tickets: the most common recognised container wins. */
export function recogniseContainer(history: (string | null | undefined)[]): { container: string; vehicle: string } | null {
  const counts = new Map<string, number>();
  for (const h of history) { const t = taxonomyContainer(h); if (t) counts.set(t, (counts.get(t) ?? 0) + 1); }
  let best: string | null = null;
  for (const [k, n] of counts) if (!best || n > (counts.get(best) ?? 0)) best = k;
  if (!best) return null;
  const vehicle = WASTE_OUT_CONTAINERS.find(g => best!.startsWith(`${g.group} · `))?.vehicle ?? "";
  return { container: best, vehicle };
}
