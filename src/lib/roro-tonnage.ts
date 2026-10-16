/**
 * RoRo general waste prices ("Inc 2 / Inc 3") include tonnage by zone:
 * Zones 1–2 include the first 2 tonnes, Zone 3 and the RoRo-only zones the first 3.
 * Anything over is charged at the General Waste per-tonne rate.
 * Keep in sync with supabase/functions/crm-ai-draft (roroIncludedTonnes).
 */
export function roroIncludedTonnes(zone: string | null | undefined): number {
  const z = String(zone ?? "").toUpperCase();
  if (/^Z[12]$/.test(z) || /ZONE\s*[12]\b(?!.*RORO)/.test(z)) return 2;
  return 3;
}

export function isRoRoInclusiveRow(label: string | null | undefined): boolean {
  return /inc\s*2\s*\/\s*inc\s*3/i.test(String(label ?? ""));
}
