/** Transport-job pricing belongs to Route One, not the weighbridge ticket. */
export const hasWeighbridgePricing = (jobType: string | null | undefined) => jobType === "waste_in";

/** Default minimum chargeable weight for weighbridge waste (kg). Editable in Prices & Rates. */
export const DEFAULT_MIN_CHARGE_WEIGHT_KG = 350;

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * The weight a waste type is charged at when it has no minimum of its own: its own value
 * when set (0 = genuinely no minimum), otherwise the site-wide default.
 */
export function effectiveMinWeightKg(
  typeMinWeightKg: number | null | undefined,
  siteDefaultKg: number | null | undefined,
): number {
  const own = Number(typeMinWeightKg);
  if (typeMinWeightKg !== null && typeMinWeightKg !== undefined && Number.isFinite(own) && own >= 0) return own;
  const site = Number(siteDefaultKg);
  return Number.isFinite(site) && site >= 0 ? site : DEFAULT_MIN_CHARGE_WEIGHT_KG;
}

/**
 * Minimum £ charge for a waste type. Most waste is charged for at least its minimum weight
 * at its £/t; exempt types (soil, hardcore) keep their own £ minimum.
 */
export function minimumChargeFor(opts: {
  pricePerTonne: number;
  exempt: boolean;
  ownMinCharge?: number | null;
  /** Site-wide default minimum weight (kg), from Prices & Rates. */
  minWeightKg?: number | null;
  /** This waste type's own minimum weight (kg) when it has one. */
  typeMinWeightKg?: number | null;
}): number {
  if (opts.exempt) return Number(opts.ownMinCharge ?? 0);
  const kg = effectiveMinWeightKg(opts.typeMinWeightKg, opts.minWeightKg);
  return round2((Number(opts.pricePerTonne) || 0) * kg / 1000);
}

/** Weight charge for a net weight; free (£0/t) types never pick up a minimum. */
export const weightChargeFor = (netKg: number, pricePerTonne: number, minCharge: number) =>
  Math.max((netKg / 1000) * pricePerTonne, pricePerTonne > 0 ? minCharge : 0);
