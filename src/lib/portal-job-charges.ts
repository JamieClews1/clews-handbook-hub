// Customer portal cost split for imported Skiptrak jobs (read-only presentation).
// Total = raw "Cost"; Haulage = raw "Haulage Cost"; Added Cost = raw "Added Cost" (extras, e.g. surcharges).
// Waste charge = Total − Haulage − Added Cost.

export interface JobCharges {
  total: number | null;
  haulage: number | null;
  added: number | null;
  waste: number | null;
}

function num(raw: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = raw?.[key];
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[£,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Splits a job's total. The waste charge is only worked out once the job carries an
 * Added Cost value (uploads before the column existed show none), so extras are never
 * silently counted as waste. A blank haulage cost counts as no haulage.
 */
export function jobCharges(raw: unknown): JobCharges {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const total = num(r, "Cost");
  const haulage = num(r, "Haulage Cost");
  const added = num(r, "Added Cost");
  const waste = total != null && added != null ? round2(total - (haulage ?? 0) - added) : null;
  return { total, haulage, added, waste };
}
