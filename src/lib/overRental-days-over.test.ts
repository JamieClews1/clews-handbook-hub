import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { daysOverFreePeriod } from "./overRental";

describe("Rentals days-over figure", () => {
  it("subtracts the 30-day free period from days on site", () => {
    assert.equal(daysOverFreePeriod(45, 30), 15);
  });
  it("counts a bin still inside the free period as zero days over", () => {
    assert.equal(daysOverFreePeriod(30, 30), 0);
    assert.equal(daysOverFreePeriod(12, 30), 0);
  });
  it("shows nothing for a bin with no recorded activity date", () => {
    assert.equal(daysOverFreePeriod(null, 30), 0);
    assert.equal(daysOverFreePeriod(undefined, 30), 0);
  });
});
