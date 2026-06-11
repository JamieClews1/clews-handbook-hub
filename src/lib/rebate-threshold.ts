// Shared logic for the per-load "weight rebate threshold".
//
// Business rule: on a load, the first N tonnes of selected-material net weight
// earns no rebate ("rebate paid after N tonnes"). The threshold is deducted once
// per load and shared proportionally across the materials it applies to.

export interface ThresholdLineInput {
  /** Unique id for this line within the load (e.g. index or waste type). */
  id: string;
  /** Net (post-pallet) weight of the line in tonnes. */
  netTonnes: number;
  /** Whether the weight rebate threshold applies to this line's material. */
  thresholdApplied: boolean;
}

/**
 * Compute, per line, how many tonnes are removed from the rebatable weight by a
 * per-load weight rebate threshold. The deduction is capped at the combined
 * selected-material weight and distributed proportionally across selected lines.
 *
 * @returns map of line id -> reduction tonnes (to subtract from rebatable weight)
 */
export function computeThresholdReductions(
  lines: ThresholdLineInput[],
  thresholdTonnes: number,
): Record<string, number> {
  const reductions: Record<string, number> = {};
  if (!thresholdTonnes || thresholdTonnes <= 0) return reductions;

  const selected = lines.filter((l) => l.thresholdApplied && l.netTonnes > 0);
  const totalSelected = selected.reduce((sum, l) => sum + l.netTonnes, 0);
  if (totalSelected <= 0) return reductions;

  const deduction = Math.min(thresholdTonnes, totalSelected);
  for (const line of selected) {
    const share = deduction * (line.netTonnes / totalSelected);
    reductions[line.id] = (reductions[line.id] ?? 0) + share;
  }
  return reductions;
}
