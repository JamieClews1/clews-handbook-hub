import { it } from "node:test";
import assert from "node:assert/strict";
import { tradingFactor, adjustTradingForecast, type TradingEvidence } from "./company-pl-trading";
const data: TradingEvidence = { cutoff: "2026-10-20", customers: [], months: [2025, 2026].flatMap((yr) => ["skiptrak", "midweigh"].flatMap((source) => Array.from({ length: 10 }, (_, i) => i + 1).map((mo) => ({ source, yr, mo, jobs: 10, tonnes: 20, value: mo <= 8 ? (yr === 2026 ? 120 : 100) : yr === 2026 ? 60 : 100, unpriced: 0 })))) };
it("weaker matched October trading reduces the existing growth assumption", () => {
  assert.equal(tradingFactor(data, 2026, 8, 10), 0.5);
  assert.equal(tradingFactor(data, 2026, 8, 12), 0.5);
});
it("operational adjustments affect estimates only and leave overheads unchanged", () => {
  const rows = [{ label: "Sep-26", sales: 200, grossProfit: 80, overheads: 30, netProfit: 50, seasonal: true }];
  const result = adjustTradingForecast(rows, data, 2026, 8);
  assert.equal(result[0].sales, 100);
  assert.equal(result[0].grossProfit, 40);
  assert.equal(result[0].overheads, 30);
  assert.equal(result[0].netProfit, 10);
  assert.equal(rows[0].sales, 200);
});
it("missing source evidence cannot silently change the forecast", () => {
  assert.equal(tradingFactor(null, 2026, 8, 10), null);
  assert.equal(tradingFactor({ ...data, months: data.months.filter((m) => m.source !== "midweigh") }, 2026, 8, 10), null);
});
it("a missing completed baseline month is not treated as zero sales", () => {
  assert.equal(tradingFactor({ ...data, months: data.months.filter((m) => !(m.yr === 2026 && m.mo === 6 && m.source === "skiptrak")) }, 2026, 8, 10), null);
});