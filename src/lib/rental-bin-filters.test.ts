import { describe, expect, it } from "bun:test";
import { ALL_RENTAL_FILTERS, customerBinCounts, filterRentalBins } from "./rental-bin-filters";

const bins = [
  { customer: "Baxters", category: "skip" as const, containerType: "8 yd Skip" },
  { customer: "Baxters", category: "roro" as const, containerType: "40 yd RoRo" },
  { customer: "Go Green", category: "skip" as const, containerType: "8 yd Skip" },
];

describe("filterRentalBins", () => {
  it("keeps every bin when no filter is set", () => {
    expect(filterRentalBins(bins, ALL_RENTAL_FILTERS)).toHaveLength(3);
  });

  it("keeps only the chosen customer's bins", () => {
    const result = filterRentalBins(bins, { ...ALL_RENTAL_FILTERS, customer: "Baxters" });
    expect(result.map((b) => b.containerType)).toEqual(["8 yd Skip", "40 yd RoRo"]);
  });

  it("treats a different spelling as a different customer", () => {
    expect(filterRentalBins(bins, { ...ALL_RENTAL_FILTERS, customer: "Baxter" })).toHaveLength(0);
  });

  it("combines the customer filter with type and size", () => {
    expect(
      filterRentalBins(bins, { customer: "Baxters", category: "roro", size: "all" }),
    ).toHaveLength(1);
    expect(
      filterRentalBins(bins, { customer: "Baxters", category: "skip", size: "8 yd Skip" }),
    ).toHaveLength(1);
    expect(
      filterRentalBins(bins, { customer: "Go Green", category: "roro", size: "all" }),
    ).toHaveLength(0);
  });
});

describe("customerBinCounts", () => {
  it("counts bins per customer, sorted A–Z", () => {
    expect(customerBinCounts(bins)).toEqual([
      { name: "Baxters", count: 2 },
      { name: "Go Green", count: 1 },
    ]);
  });
});
