/**
 * RoRo general waste prices ("Inc 2 / Inc 3") include tonnage by zone:
 * Zone 1 includes the first tonne, Zone 2 the first 2, Zone 3 and the RoRo-only zones the first 3.
 * Anything over is charged at the General Waste per-tonne rate.
 * Keep in sync with supabase/functions/crm-ai-draft (roroIncludedTonnes).
 */
export function roroIncludedTonnes(zone: string | null | undefined): number {
  const z = String(zone ?? "").toUpperCase();
  if (z === "Z1" || /ZONE\s*1\b(?!.*RORO)/.test(z)) return 1;
  if (z === "Z2" || /ZONE\s*2\b(?!.*RORO)/.test(z)) return 2;
  return 3;
}

export function isRoRoInclusiveRow(label: string | null | undefined): boolean {
  return /inc\s*2\s*\/\s*inc\s*3/i.test(String(label ?? ""));
}
