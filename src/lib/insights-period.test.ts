import { it } from "node:test";
import assert from "node:assert/strict";
import { annualReportingPeriod, comparisonPeriod, metricDelta, capReportingEnd } from "./insights-period";
it("30 October 2026 compares the same elapsed dates, not all of 2025", () => {
  const period = annualReportingPeriod(2026, "2026-10-30");
  assert.equal(period.end, "2026-10-30");
  assert.deepEqual(comparisonPeriod(period), { start: "2025-01-01", end: "2025-10-30" });
});
it("historical years retain complete annual comparisons", () => {
  assert.deepEqual(comparisonPeriod(annualReportingPeriod(2025, "2026-10-30")), { start: "2024-01-01", end: "2024-12-31" });
});
it("previous period has the same number of days", () => {
  assert.deepEqual(comparisonPeriod({ start: "2026-10-01", end: "2026-10-30", compare: "previous" }), { start: "2026-09-01", end: "2026-09-30" });
});
it("rate differences use percentage points and actual direction", () => { assert.equal(metricDelta(13.3, 14.5, true), -1.1999999999999993); });
it("future reporting dates are capped without changing stored bookings", () => { assert.equal(capReportingEnd("2026-12-17", "2026-10-30"), "2026-10-30"); });