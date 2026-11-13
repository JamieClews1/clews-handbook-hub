/** Transport-job pricing belongs to Route One, not the weighbridge ticket. */
export const hasWeighbridgePricing = (jobType: string | null | undefined) => jobType === "waste_in";

/** Default minimum chargeable weight for weighbridge waste (kg). Editable in Prices & Rates. */
export const DEFAULT_MIN_CHARGE_WEIGHT_KG = 350;

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Minimum £ charge for a waste type. Most waste is charged for at least the configured
 * minimum weight at its £/t; exempt types (soil, hardcore) keep their own £ minimum.
 */
export function minimumChargeFor(opts: {
  pricePerTonne: number;
  exempt: boolean;
  ownMinCharge?: number | null;
  minWeightKg?: number | null;
}): number {
  if (opts.exempt) return Number(opts.ownMinCharge ?? 0);
  const kg = opts.minWeightKg ?? DEFAULT_MIN_CHARGE_WEIGHT_KG;
  return round2((Number(opts.pricePerTonne) || 0) * kg / 1000);
}

/** Weight charge for a net weight; free (£0/t) types never pick up a minimum. */
export const weightChargeFor = (netKg: number, pricePerTonne: number, minCharge: number) =>
  Math.max((netKg / 1000) * pricePerTonne, pricePerTonne > 0 ? minCharge : 0);
