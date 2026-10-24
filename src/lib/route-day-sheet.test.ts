import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDaySheet, type DaySheetJob } from "./route-day-sheet";

const jobs = (count: number, driver = "Test Driver"): DaySheetJob[] => Array.from({ length: count }, (_, i) => ({
  source: "routeone", id: `${driver}-${i}`, number: `JOB-${i}`, driver, vehicle: "AB12 CDE",
  customer: `Customer ${i}`, address: "Unit 17, Industrial Estate, Hunters Lane, Rugby, Warwickshire, CV21 1EA",
  type: "Exchange", container: "20 yard RoRo", waste: "Mixed waste", po: `PO-${i}`,
  notes: `Gate code 1234. Contact site manager before arrival. Unique note ${i}`,
}));

describe("single A4 driver job sheets", () => {
  for (const count of [1, 8, 16, 40, 80]) {
    it(`keeps all ${count} jobs and notes on one A4 page`, () => {
      const doc = buildDaySheet("2026-10-24", jobs(count), { "*": "Check all access instructions before departure." });
      assert.equal(doc.getNumberOfPages(), 1);
      assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 210) < 0.1);
      assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 297) < 0.1);
      const output = doc.output();
      for (let i = 0; i < count; i++) {
        assert.ok(output.includes(`JOB-${i}`));
        assert.ok(output.includes(`Unique note ${i}`));
      }
    });
  }
  it("prints exactly one page for each driver", () => {
    assert.equal(buildDaySheet("2026-10-24", [...jobs(16, "Driver A"), ...jobs(12, "Driver B")]).getNumberOfPages(), 2);
  });
});