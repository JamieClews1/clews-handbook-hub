import { test } from "node:test";
import assert from "node:assert/strict";
import { previousMonth, buildSnapshot } from "./report.ts";
test("first of November covers October", () => assert.equal(previousMonth(new Date("2026-11-01T08:00:00Z")), "2026-10-01"));
test("January reports previous December", () => assert.equal(previousMonth(new Date("2027-01-01T08:00:00Z")), "2026-12-01"));
const rows = (year: number) => [["", ...["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => `${m}-${String(year).slice(-2)}`)], ...["Sales", "Gross profit", "Overheads", "Net profit"].map(name => [name, ...Array.from({ length: 12 }, (_, i) => i < 9 ? "100" : "")])];
test("missing October accounting remains forecast and missing waste remains unknown", () => {
  const s = buildSnapshot([{ sheets: { "Full set": rows(2026) }, file_name: "2026", imported_at: "2026-10-22" }, { sheets: { "Full set": rows(2025) }, file_name: "2025", imported_at: "2026-10-20" }], "2026-10-01", []);
  assert.equal(s.accountingMonths, 9); assert.equal(s.forecasts.length, 3); assert.equal(s.forecasts[0].label, "Oct-26"); assert.equal(s.wasteTotals.in, null);
});