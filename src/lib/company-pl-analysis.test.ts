import { it } from "node:test";
import assert from "node:assert/strict";
import { parsePlSheet, periodTotals, profitBridge, parseAmount, yearEndProjections } from "./company-pl-analysis";

const sheet = (yy: string, sales: string[], gp: string[], oh: string[], net: string[]) => [
  ["Clews Recycling"], ["", "", "", "Total", "", ...["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => `${m}-${yy}`)],
  ["Sales", "", "", "", "", ...sales], ["Gross Profit", "", "", "", "", ...gp], ["Overheads", "", "", "", "", ...oh], ["Net Profit", "", "", "", "", ...net],
];

it("treats trailing zero months as unreported, not zero performance", () => {
  const y = parsePlSheet(sheet("26", ["100", "200", "0", "0"], ["40", "80", "0", "0"], ["30", "30", "0", "0"], ["10", "50", "0", "0"]))!;
  assert.equal(y.year, 2026);
  assert.equal(y.reportedMonths, 2);
  assert.equal(periodTotals(y, 2).netProfit, 60);
});

it("keeps spreadsheet errors as missing and reads negatives", () => {
  assert.equal(parseAmount("#DIV/0!"), null);
  assert.equal(parseAmount("-12,872 "), -12872);
  assert.equal(parseAmount("(1,000)"), -1000);
});

it("profit bridge parts add up to the net profit change", () => {
  const a = periodTotals(parsePlSheet(sheet("25", ["1000"], ["370"], ["390"], ["-20"]))!, 1);
  const b = periodTotals(parsePlSheet(sheet("26", ["1200"], ["460"], ["400"], ["60"]))!, 1);
  const bridge = profitBridge(a, b);
  assert.equal(Math.round(bridge.sales + bridge.margin + bridge.overheads + bridge.other), 80);
  assert.equal(Math.round(bridge.sales), 74);
});

it("projects only remaining months and keeps actuals unchanged", () => {
  const cur = parsePlSheet(sheet("26", Array(8).fill("100"), Array(8).fill("40"), Array(8).fill("30"), Array(8).fill("10")));
  const prev = parsePlSheet(sheet("25", Array(12).fill("80"), Array(12).fill("30"), Array(12).fill("25"), Array(12).fill("5")));
  assert.ok(cur); assert.ok(prev);
  const result = yearEndProjections(cur, prev);
  for (const p of result) { assert.equal(p.actual.sales, 800); assert.equal(p.remaining.sales, 400); assert.equal(p.projected.sales, 1200); assert.equal(p.projected.netProfit, 120); }
  assert.equal(cur.reportedMonths, 8);
  assert.equal(periodTotals(cur, 8).netProfit, 80);
});

it("latest three months do not repeat earlier one-off profit", () => {
  const cur = parsePlSheet(sheet("26", Array(8).fill("100"), Array(8).fill("40"), Array(8).fill("30"), ["100", ...Array(7).fill("10")]));
  const prev = parsePlSheet(sheet("25", Array(12).fill("100"), Array(12).fill("40"), Array(12).fill("30"), Array(12).fill("10")));
  assert.ok(cur); assert.ok(prev);
  const p = yearEndProjections(cur, prev);
  assert.equal(p.find((v) => v.key === "recent")?.projected.netProfit, 210);
  assert.equal(p.find((v) => v.key === "average")?.projected.netProfit, 255);
});

it("scales prior-year remaining sales by matched sales growth, not net-profit growth", () => {
  const cur = parsePlSheet(sheet("26", Array(8).fill("120"), Array(8).fill("48"), Array(8).fill("30"), Array(8).fill("18")));
  const prev = parsePlSheet(sheet("25", [...Array(8).fill("100"), ...Array(4).fill("200")], Array(12).fill("40"), Array(12).fill("30"), Array(12).fill("10")));
  assert.ok(cur); assert.ok(prev);
  const p = yearEndProjections(cur, prev).find((v) => v.key === "seasonal");
  assert.equal(p?.remaining.sales, 960);
  assert.equal(p?.projected.netProfit, 408);
});

it("blocks missing summary values and seasonality with an incomplete prior year", () => {
  const cur = parsePlSheet(sheet("26", ["100"], ["#DIV/0!"], ["30"], ["10"]));
  const prev = parsePlSheet(sheet("25", ["100"], ["40"], ["30"], ["10"]));
  assert.ok(cur); assert.ok(prev);
  assert.deepEqual(yearEndProjections(cur, prev), []);
  assert.equal(yearEndProjections(prev, prev).some((p) => p.key === "seasonal"), false);
});

it("a completed year adds no estimated income or profit", () => {
  const y = parsePlSheet(sheet("26", Array(12).fill("100"), Array(12).fill("40"), Array(12).fill("30"), Array(12).fill("10")));
  assert.ok(y);
  for (const p of yearEndProjections(y, y)) { assert.equal(p.remaining.sales, 0); assert.equal(p.projected.netProfit, 120); }
});
