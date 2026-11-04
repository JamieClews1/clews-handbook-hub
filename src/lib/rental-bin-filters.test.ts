import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_RENTAL_FILTERS, customerBinCounts, filterRentalBins } from "./rental-bin-filters";

const bins = [
  { customer: "Baxters", category: "skip" as const, containerType: "8 yd Skip" },
  { customer: "Baxters", category: "roro" as const, containerType: "40 yd RoRo" },
  { customer: "Go Green", category: "skip" as const, containerType: "8 yd Skip" },
];

describe("filterRentalBins", () => {
  it("keeps every bin when no filter is set", () => {
    assert.equal(filterRentalBins(bins, ALL_RENTAL_FILTERS).length, 3);
  });

  it("keeps only the chosen customer's bins", () => {
    const result = filterRentalBins(bins, { ...ALL_RENTAL_FILTERS, customer: "Baxters" });
    assert.deepEqual(result.map((b) => b.containerType), ["8 yd Skip", "40 yd RoRo"]);
  });

  it("treats a different spelling as a different customer", () => {
    assert.equal(filterRentalBins(bins, { ...ALL_RENTAL_FILTERS, customer: "Baxter" }).length, 0);
  });

  it("combines the customer filter with type and size", () => {
    assert.equal(
      filterRentalBins(bins, { customer: "Baxters", category: "roro", size: "all" }).length,
      1,
    );
    assert.equal(
      filterRentalBins(bins, { customer: "Baxters", category: "skip", size: "8 yd Skip" }).length,
      1,
    );
    assert.equal(
      filterRentalBins(bins, { customer: "Go Green", category: "roro", size: "all" }).length,
      0,
    );
  });
});

describe("customerBinCounts", () => {
  it("counts bins per customer, sorted A–Z", () => {
    assert.deepEqual(customerBinCounts(bins), [
      { name: "Baxters", count: 2 },
      { name: "Go Green", count: 1 },
    ]);
  });
});
