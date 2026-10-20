import { it } from "node:test";
import assert from "node:assert/strict";
import { parsePlSheet, periodTotals, profitBridge, parseAmount } from "./company-pl-analysis";

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
