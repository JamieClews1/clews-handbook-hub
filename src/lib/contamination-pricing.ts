// Shared contamination pricing logic used by the portal and driver app.

export interface PricingTier {
  id: string;
  waste_type_id: string;
  tier_name: string;
  pct_min: number | null;
  pct_max: number | null;
  mins_min: number | null;
  mins_max: number | null;
  flat_fee: number;
  per_tonne_fee: number | null;
  min_charge_tonnes: number | null;
  notes: string | null;
  display_order: number;
}

export interface WasteType {
  id: string;
  name: string;
  typical_contamination: string | null;
  zero_tolerance: boolean;
  display_order: number;
  is_active: boolean;
}

/** A per-item contamination charge (e.g. fridges, tyres, mattresses). */
export interface ChargeItem {
  id: string;
  name: string;
  ewc_code: string | null;
  unit_charge: number;
  notes: string | null;
  is_active: boolean;
  display_order: number;
}

/** A reported individual item with its quantity, stored on the query. */
export interface ReportedItem {
  item_id: string;
  name: string;
  unit_charge: number;
  quantity: number;
}

/** Total charge for a list of reported individual items. */
export const calculateItemsCharge = (items: ReportedItem[] | null | undefined): number => {
  if (!items?.length) return 0;
  const total = items.reduce((sum, i) => sum + (i.unit_charge || 0) * (i.quantity || 0), 0);
  return Math.round(total * 100) / 100;
};


const inRange = (
  value: number | null | undefined,
  min: number | null,
  max: number | null,
): boolean => {
  if (value == null) return false;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
};

/**
 * Find the best matching tier for a waste type given a contamination % and/or
 * sorting minutes. A tier matches if EITHER the percentage OR the minutes fall
 * within its band (the penalty table uses "% of load OR sorting time").
 * Returns the highest-order (most severe) matching tier.
 */
export const findMatchingTier = (
  tiers: PricingTier[],
  pct: number | null | undefined,
  minutes: number | null | undefined,
): PricingTier | null => {
  if (pct == null && minutes == null) return null;
  const matches = tiers.filter(
    (t) => inRange(pct, t.pct_min, t.pct_max) || inRange(minutes, t.mins_min, t.mins_max),
  );
  if (matches.length === 0) return null;
  // Most severe match = highest display_order
  return matches.reduce((a, b) => (b.display_order > a.display_order ? b : a));
};

/**
 * Calculate the charge for a tier given the load weight (tonnes).
 * Per-tonne tiers use max(weight, min charge tonnes). Otherwise the flat fee.
 */
export const calculateTierCharge = (
  tier: PricingTier | null,
  weightTonnes: number | null | undefined,
): number => {
  if (!tier) return 0;
  if (tier.per_tonne_fee != null) {
    const billableTonnes = Math.max(weightTonnes ?? 0, tier.min_charge_tonnes ?? 0);
    return Math.round(tier.per_tonne_fee * billableTonnes * 100) / 100;
  }
  return tier.flat_fee ?? 0;
};

export const describeTier = (tier: PricingTier): string => {
  const parts: string[] = [];
  if (tier.pct_min != null || tier.pct_max != null) {
    if (tier.pct_max != null) parts.push(`${tier.pct_min ?? 0}–${tier.pct_max}%`);
    else parts.push(`${tier.pct_min ?? 0}%+`);
  }
  if (tier.mins_min != null || tier.mins_max != null) {
    if (tier.mins_max != null) parts.push(`${tier.mins_min ?? 0}–${tier.mins_max} mins`);
    else parts.push(`>${(tier.mins_min ?? 1) - 1} mins`);
  }
  return parts.join(" OR ");
};
