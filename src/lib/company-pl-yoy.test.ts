import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { comparePlStream, plStreams } from "./company-pl-yoy";
import type { PlYear } from "./company-pl-analysis";
const year = (year: number, values: (number | null)[], reportedMonths = values.length): PlYear => ({ year, reportedMonths, monthLabels: [], order: ["Waste Income", "Diesel", "Sales"], lines: new Map([["diesel", values]]) });
describe("P&L year-on-year tracker", () => {
  it("compares cost streams on the exact same selected months", () => {
    const result = comparePlStream([year(2025, [10, 20, 90]), year(2026, [15, 30, 100])], "diesel", 1, 2);
    assert.deepEqual(result.totals, [{ year: 2025, total: 30, delta: null, percent: null }, { year: 2026, total: 45, delta: 15, percent: 0.5 }]);
    assert.equal(result.monthly[1]["2026"], 30);
  });
  it("does not publish unreported months as complete-year actuals", () => {
    const result = comparePlStream([year(2026, [10, 20, 0], 2)], "diesel", 1, 3);
    assert.equal(result.totals[0].total, null);
    assert.equal(result.monthly[2]["2026"], null);
  });
  it("distinguishes missing or errored streams from genuine zero costs", () => {
    assert.equal(comparePlStream([year(2025, [null])], "diesel", 1, 1).totals[0].total, null);
    assert.equal(comparePlStream([year(2025, [0])], "diesel", 1, 1).totals[0].total, 0);
    assert.equal(comparePlStream([year(2025, [10])], "missing", 1, 1).totals[0].total, null);
  });
  it("never calls a gap in available years a year-on-year change", () => {
    assert.equal(comparePlStream([year(2023, [10]), year(2026, [20])], "diesel", 1, 1).totals[1].delta, null);
  });
  it("offers separate revenue, cost and summary streams", () => {
    assert.deepEqual(plStreams([year(2026, [10])]).map(s => [s.key, s.kind]), [["waste income", "revenue"], ["diesel", "cost"], ["sales", "summary"]]);
  });
});