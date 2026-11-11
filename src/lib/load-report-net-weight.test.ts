import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  standardLoadNetWeightKg,
  staciLoadNetWeightKg,
  formatNetWeightKg,
} from "./load-report-net-weight";
import type { LineItem } from "@/components/load-reports/TallyScreen";
import {
  EMPTY_WASTE_BREAKDOWN,
  type StaciPalletEntry,
  type StaciWasteBreakdown,
} from "@/components/load-reports/staci/types";

const item = (
  pallet_count: number,
  avg_weight_kg: number,
  pallet_weight_kg: number
): LineItem => ({
  waste_type: "Cardboard",
  pallet_count,
  avg_weight_kg,
  total_weight_kg: pallet_count * avg_weight_kg,
  display_order: 0,
  pallet_weight_kg,
});

const entry = (
  weight_kg: number,
  pallet_count: number,
  cardPercentage: number
): StaciPalletEntry => ({
  id: `${weight_kg}-${pallet_count}`,
  colour: "blue",
  weight_kg,
  pallet_type: "good",
  display_order: 0,
  description: "",
  waste_breakdown: {
    ...EMPTY_WASTE_BREAKDOWN,
    card: cardPercentage,
  } as StaciWasteBreakdown,
  pallet_count,
});

describe("Standard load report net weight", () => {
  it("deducts one pallet tare per pallet counted", () => {
    assert.equal(standardLoadNetWeightKg([item(10, 1000, 20)]), 9800);
  });
  it("sums every material line on the load", () => {
    assert.equal(
      standardLoadNetWeightKg([item(10, 1000, 20), item(5, 400, 20)]),
      11_700
    );
  });
  it("deducts nothing when the load has no pallets on it", () => {
    assert.equal(standardLoadNetWeightKg([item(10, 1000, 20)], true), 10_000);
  });
  it("is zero before anything is tallied", () => {
    assert.equal(standardLoadNetWeightKg([]), 0);
  });
});

describe("Staci load report net weight", () => {
  it("deducts one pallet tare per pallet of a valid entry", () => {
    assert.equal(
      staciLoadNetWeightKg({
        palletEntries: [entry(200, 3, 100)],
        palletWeightKg: 20,
      }),
      540
    );
  });
  it("ignores entries whose breakdown does not total 100%", () => {
    assert.equal(
      staciLoadNetWeightKg({
        palletEntries: [entry(200, 3, 100), entry(500, 2, 50)],
        palletWeightKg: 20,
      }),
      540
    );
  });
  it("adds bales and dolavs, deducting pallet tare only when on pallets", () => {
    assert.equal(
      staciLoadNetWeightKg({
        palletEntries: [],
        palletWeightKg: 20,
        cardBalesCount: 2,
        cardBalesWeightKg: 100,
        cardBalesOnPallets: true,
        filmsBaleCount: 1,
        filmsBaleWeightKg: 120,
        filmsBaleOnPallets: false,
      }),
      280
    );
  });
  it("adds nothing for good or scrap pallets on their own", () => {
    assert.equal(
      staciLoadNetWeightKg({ palletEntries: [], palletWeightKg: 20 }),
      0
    );
  });
});

describe("Net weight label", () => {
  it("shows whole kilograms with thousands separators", () => {
    assert.equal(formatNetWeightKg(9800), "9,800 kg");
    assert.equal(formatNetWeightKg(1234.6), "1,235 kg");
  });
});
