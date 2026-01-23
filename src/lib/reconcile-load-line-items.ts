import type { LineItem } from "@/components/load-reports/TallyScreen";

type ReconcileResult = {
  reconciled: LineItem[];
  originalTotalKg: number;
  targetTotalKg: number;
  reconciledTotalKg: number;
};

const sumKg = (items: LineItem[]) =>
  items.reduce((sum, i) => sum + i.pallet_count * i.avg_weight_kg, 0);

/**
 * Reconciles per-material avg weights so that:
 * - pallet_count is unchanged
 * - reconciled total equals the weighbridge (target) total (rounded to whole kg)
 * - adjustments stay proportional to the existing per-material estimate
 */
export const reconcileLineItemsToTargetKg = (
  lineItems: LineItem[],
  targetKg: number
): ReconcileResult => {
  const targetTotalKg = Math.round(targetKg);
  const originalTotalKg = Math.round(sumKg(lineItems));

  const active = lineItems.filter((i) => i.pallet_count > 0);
  if (active.length === 0) {
    return {
      reconciled: lineItems,
      originalTotalKg,
      targetTotalKg,
      reconciledTotalKg: originalTotalKg,
    };
  }

  const baselineTotal = active.reduce(
    (sum, i) => sum + i.pallet_count * i.avg_weight_kg,
    0
  );

  const delta = targetTotalKg - baselineTotal;

  // If the baseline total is zero (e.g., all avg weights are zero), distribute by pallet count.
  const totalPallets = active.reduce((sum, i) => sum + i.pallet_count, 0);

  const withRaw = lineItems.map((i) => {
    if (i.pallet_count <= 0) return { item: i, rawTotal: 0 };

    const itemBaselineTotal = i.pallet_count * i.avg_weight_kg;

    const share =
      baselineTotal > 0
        ? itemBaselineTotal / baselineTotal
        : totalPallets > 0
          ? i.pallet_count / totalPallets
          : 0;

    const newTotal = Math.max(0, itemBaselineTotal + delta * share);
    return { item: i, rawTotal: newTotal };
  });

  // Round totals to whole kg, then distribute rounding remainder across the biggest contributors.
  const roundedTotals = withRaw.map((x) => ({
    ...x,
    roundedTotal: Math.round(x.rawTotal),
  }));

  const sumRounded = roundedTotals.reduce((sum, x) => sum + x.roundedTotal, 0);
  let remainder = targetTotalKg - sumRounded;

  const adjustable = [...roundedTotals]
    .filter((x) => x.item.pallet_count > 0)
    .sort((a, b) => b.roundedTotal - a.roundedTotal);

  let idx = 0;
  while (remainder !== 0 && adjustable.length > 0 && idx < adjustable.length * 4) {
    const j = idx % adjustable.length;
    const entry = adjustable[j];

    if (remainder > 0) {
      entry.roundedTotal += 1;
      remainder -= 1;
    } else {
      // Don’t push below zero.
      if (entry.roundedTotal > 0) {
        entry.roundedTotal -= 1;
        remainder += 1;
      }
    }

    idx += 1;
  }

  const reconciled = roundedTotals.map((x) => {
    const entry = adjustable.find((a) => a.item.waste_type === x.item.waste_type) || x;
    if (x.item.pallet_count <= 0) {
      return {
        ...x.item,
        total_weight_kg: 0,
      };
    }

    const newAvg = entry.roundedTotal / x.item.pallet_count;
    return {
      ...x.item,
      avg_weight_kg: Number(newAvg.toFixed(2)),
      total_weight_kg: entry.roundedTotal,
    };
  });

  const reconciledTotalKg = Math.round(sumKg(reconciled));
  return { reconciled, originalTotalKg, targetTotalKg, reconciledTotalKg };
};
