import { describe, it, expect } from "bun:test";
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
      expect(doc.getNumberOfPages()).toBe(1);
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 1);
      const output = doc.output();
      for (let i = 0; i < count; i++) {
        expect(output).toContain(`JOB-${i}`);
        expect(output).toContain(`Unique note ${i}`);
      }
    });
  }
  it("prints exactly one page for each driver", () => {
    expect(buildDaySheet("2026-10-24", [...jobs(16, "Driver A"), ...jobs(12, "Driver B")]).getNumberOfPages()).toBe(2);
  });
});