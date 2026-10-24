export function boardRegistration(value?: string | null) {
  const reg = (value ?? "").toUpperCase().replace(/\s/g, "");
  return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(reg) ? `${reg.slice(0, 4)} ${reg.slice(4)}` : value ?? "";
}
// Existing types stay intact; this map only selects a Day-board presentation.
export const BOARD_JOB_TYPES: Record<string, { palette: string; label: string }> = {
  collection: { palette: "collect", label: "Collect" },
  pickup: { palette: "collect", label: "Collect" },
  exchange: { palette: "exchange", label: "Exchange" },
  delivery: { palette: "delivery", label: "Delivery" },
  waste_truck: { palette: "waste", label: "Waste" },
};
export function boardJobType(type: string, fallback: string) {
  return BOARD_JOB_TYPES[type] ?? { palette: "other", label: fallback };
}
/** Never infer confirmation from source, dispatch status or assignment. */
export function boardUnconfirmed(job: Record<string, unknown>) {
  return job.confirmed === false || job.is_confirmed === false;
}