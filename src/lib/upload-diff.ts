/**
 * Data Uploads re-send the whole Skiptrak/Midweigh export each time, so almost
 * every row is already stored unchanged. Rewriting unchanged rows burns the
 * database's disk budget (it stalled the portal), so only new or changed rows
 * are written.
 */

function normalise(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = normalise((value as Record<string, unknown>)[key]);
      if (v !== null) out[key] = v;
    }
    return out;
  }
  return value;
}

/** True when any field being uploaded differs from the stored row (or the row is new). */
export function rowNeedsWrite(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | undefined | null,
): boolean {
  if (!existing) return true;
  for (const key of Object.keys(incoming)) {
    if (JSON.stringify(normalise(incoming[key])) !== JSON.stringify(normalise(existing[key]))) return true;
  }
  return false;
}

/**
 * Jobs whose waste name/EWC staff corrected in the portal (waste stream
 * standardisation) keep the corrected values when the same job is uploaded
 * again from an export that still carries the old wording.
 */
export function keepCorrectedWaste<T extends { ewc?: string | null; waste_description?: string | null }>(
  incoming: T,
  existing: { ewc?: string | null; waste_description?: string | null; waste_corrected_at?: string | null } | undefined | null,
): T {
  if (!existing?.waste_corrected_at) return incoming;
  return { ...incoming, ewc: existing.ewc ?? null, waste_description: existing.waste_description ?? null };
}
