import type { LineItem } from "@/components/load-reports/TallyScreen";
import {
  getTotalPercentage,
  type StaciPalletEntry,
} from "@/components/load-reports/staci/types";

/**
 * Net weight for standard load reports (Britvic, Vantiva, Amazon, Evri, Other).
 *
 * Mirrors the review screen maths: every pallet counted in the tally carries its
 * material weight, and the physical pallet tare is removed to leave the weight of
 * waste only. When a load is marked as having no pallets on it, nothing is deducted.
 */
export function standardLoadNetWeightKg(
  lineItems: LineItem[],
  noPalletsOnLoad = false
): number {
  const grossKg = lineItems.reduce(
    (sum, item) => sum + item.pallet_count * item.avg_weight_kg,
    0
  );
  const palletTareKg = noPalletsOnLoad
    ? 0
    : lineItems.reduce(
        (sum, item) => sum + item.pallet_count * (item.pallet_weight_kg || 0),
        0
      );
  return Math.max(0, Math.round(grossKg - palletTareKg));
}

export interface StaciNetWeightInput {
  palletEntries: StaciPalletEntry[];
  palletWeightKg?: number;
  cardBalesCount?: number;
  cardBalesWeightKg?: number;
  cardBalesOnPallets?: boolean;
  filmsBaleCount?: number;
  filmsBaleWeightKg?: number;
  filmsBaleOnPallets?: boolean;
  papersDolavCount?: number;
  papersDolavWeightKg?: number;
  papersDolavOnPallets?: boolean;
  glassDolavCount?: number;
  glassDolavWeightKg?: number;
  glassDolavOnPallets?: boolean;
  scrapMetalLooseCount?: number;
  scrapMetalLooseWeightKg?: number;
  scrapMetalLooseOnPallets?: boolean;
}

/**
 * Net weight for Staci loads.
 *
 * Palletised entries only count when their waste breakdown totals 100% and they
 * carry weight; each pallet of a valid entry contributes one pallet tare. Bale,
 * dolav and loose-metal items are counted at their per-unit weight, with a pallet
 * tare deducted only when they are marked as sitting on pallets. Good and scrap
 * pallets are pallets alone, so they add no waste weight.
 */
export function staciLoadNetWeightKg(input: StaciNetWeightInput): number {
  const palletWeightKg = input.palletWeightKg ?? 20;
  let grossKg = 0;
  let palletTareKg = 0;

  for (const entry of input.palletEntries) {
    const breakdownTotal = getTotalPercentage(entry.waste_breakdown);
    const isValid = Math.abs(breakdownTotal - 100) < 0.01 && entry.weight_kg > 0;
    if (!isValid) continue;

    const palletCount = entry.pallet_count || 1;
    grossKg += entry.weight_kg * palletCount;
    palletTareKg += palletCount * palletWeightKg;
  }

  const bales: Array<[number, number, boolean]> = [
    [input.cardBalesCount ?? 0, input.cardBalesWeightKg ?? 0, !!input.cardBalesOnPallets],
    [input.filmsBaleCount ?? 0, input.filmsBaleWeightKg ?? 0, !!input.filmsBaleOnPallets],
    [input.papersDolavCount ?? 0, input.papersDolavWeightKg ?? 0, !!input.papersDolavOnPallets],
    [input.glassDolavCount ?? 0, input.glassDolavWeightKg ?? 0, !!input.glassDolavOnPallets],
    [
      input.scrapMetalLooseCount ?? 0,
      input.scrapMetalLooseWeightKg ?? 0,
      !!input.scrapMetalLooseOnPallets,
    ],
  ];

  for (const [count, weightPerUnit, onPallets] of bales) {
    grossKg += count * weightPerUnit;
    if (onPallets) palletTareKg += count * palletWeightKg;
  }

  return Math.max(0, Math.round(grossKg - palletTareKg));
}

/** Compact label for the header strip, e.g. "9,800 kg". */
export function formatNetWeightKg(kg: number): string {
  return `${Math.round(kg).toLocaleString("en-GB")} kg`;
}
