/** One weight format everywhere on screen: tonnes to 3 decimal places (e.g. "0.600"). */
export function formatTonnes(tonnes: number | null | undefined, empty = "—"): string {
  if (tonnes == null || !Number.isFinite(tonnes)) return empty;
  return tonnes.toFixed(3);
}

/** Kilograms shown as tonnes with the shared 3-decimal format. */
export function formatKgAsTonnes(kg: number | null | undefined, empty = "—"): string {
  if (kg == null || !Number.isFinite(kg)) return empty;
  return formatTonnes(kg / 1000, empty);
}
