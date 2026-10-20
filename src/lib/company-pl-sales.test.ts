import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { salesMonths, completeSalesTotal } from "./company-pl-sales";
import type { PlYear } from "./company-pl-analysis";
import type { TradingEvidence } from "./company-pl-trading";
const year: PlYear = { year: 2026, reportedMonths: 1, monthLabels: ["Jan-26", "Feb-26"], order: [], lines: new Map([["sales", [180]], ["waste income", [100]], ["recyclables", [30]], ["rfs till sales", [40]], ["other sales", [10]]]) };
const trading: TradingEvidence = { cutoff: "2026-02-10", customers: [], months: [{ source: "skiptrak", yr: 2026, mo: 1, value: 60, jobs: 1, tonnes: 1, unpriced: 0 }, { source: "midweigh", yr: 2026, mo: 1, value: 50, jobs: 1, tonnes: 1, unpriced: 0 }] };
describe("P&L Sales", () => {
  it("replaces accounting waste with portal waste, rather than counting it twice", () => {
    const row = salesMonths(year, trading)[0];
    assert.equal(row.combined, 190); assert.equal(row.accounting, 180); assert.equal(row.gap, 10); assert.equal(row.reconciliation, 0);
  });
  it("does not treat missing source evidence as zero", () => {
    assert.equal(salesMonths(year, { ...trading, months: trading.months.slice(0, 1) })[0].combined, null);
    assert.equal(completeSalesTotal([190, null]), null);
  });
  it("never allocates company portal income to RFS", () => assert.equal(salesMonths(year, trading, false)[0].combined, null));
  it("does not manufacture uploaded other revenue for unreported months", () => assert.equal(salesMonths(year, trading)[1].other, null));
});