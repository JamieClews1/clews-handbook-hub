import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withStandingBins, type StandingBinRule } from "./standing-bins";
import { openRentalBins } from "./rental-open-movements";
import { categoriseContainer, containerTypeCap } from "./overRental";

const settings = { rental_free_days: -1, artic_vehicle_regs: [], artic_container_keywords: [], roro_container_keywords: ["ro ro"], skip_container_keywords: ["yard", "yd"] } as never;
let n = 0;
const job = (date: string, movement: string, ewc = "17 02 03") => ({
  id: `j${++n}`, job_number: String(50000 + n), job_date: date, customer: "Veka Recycling Ltd", site: "Munster Joinery UK Ltd",
  container_type: "40 yd Ro Ro", movement_type: movement, waste_description: null, vehicle_registration: null, ewc, postcode: null, rental_status: "Y",
});
const rule: StandingBinRule = { id: "r1", customer: "Veka Recycling Ltd", site: "Munster Joinery UK Ltd", container_type: "40 yd Ro Ro", ewc: "17 02 03", bin_count: 2, active: true };
const onSite = (jobs: ReturnType<typeof job>[]) =>
  openRentalBins(jobs, settings, "2026-01-01", categoriseContainer, "2026-11-06").reduce((s, b) => s + b.netOnSite, 0);
const physicalCount = (jobs: ReturnType<typeof job>[]) => containerTypeCap([{
  delivered: jobs.filter(j => j.movement_type === "Deliver").length,
  collected: jobs.filter(j => j.movement_type === "Collect").length,
  exchanged: jobs.filter(j => j.movement_type === "Exchange").length,
  tipReturn: jobs.filter(j => j.movement_type === "Tip/Return").length,
  lastKeepDate: jobs.filter(j => ["Deliver", "Exchange", "Tip/Return"].includes(j.movement_type)).map(j => j.job_date).sort().at(-1) ?? null,
  lastCollectionDate: jobs.filter(j => j.movement_type === "Collect").map(j => j.job_date).sort().at(-1) ?? null,
}]);

describe("standing bins", () => {
  const exchanges = [job("2026-10-21", "Exchange"), job("2026-10-21", "Exchange"), job("2026-11-03", "Exchange")];

  it("exchange-only position counts as one bin without a rule", () => {
    assert.equal(onSite(exchanges), 1);
  });

  it("a confirmed rule of 2 shows 2 bins on site", () => {
    const augmented = withStandingBins(exchanges, [rule], "2026-11-06");
    assert.equal(augmented.filter(j => j.id.startsWith("standing:")).length, 2);
    assert.equal(physicalCount(augmented), 2);
    assert.equal(onSite(augmented), 1); // only the serviced real ticket has a known rental clock
  });

  it("a later real collection reduces the confirmed count to 1", () => {
    assert.equal(onSite(withStandingBins([...exchanges, job("2026-11-05", "Collect")], [rule], "2026-11-06")), 1);
  });

  it("another waste stream's exchange does not absorb a confirmed bin", () => {
    const mixed = [...exchanges, job("2026-10-25", "Exchange", "20 03 01")];
    const augmented = withStandingBins(mixed, [rule], "2026-11-06");
    assert.equal(augmented.filter(j => j.id.startsWith("standing:")).length, 2);
    assert.equal(onSite(augmented), 2); // third bin's rental commencement is unknown
  });

  it("two real deliveries followed by a collection leave one, not two", () => {
    const movements = [job("2026-10-01", "Deliver"), job("2026-10-01", "Deliver"), job("2026-11-05", "Collect")];
    assert.equal(onSite(withStandingBins(movements, [rule], "2026-11-06")), 1);
    assert.equal(physicalCount(withStandingBins(movements, [rule], "2026-11-06")), 1);
  });

  it("two collections clear two delivered bins without replenishment", () => {
    const movements = [job("2026-10-01", "Deliver"), job("2026-10-01", "Deliver"), job("2026-11-04", "Collect"), job("2026-11-05", "Collect")];
    assert.equal(onSite(withStandingBins(movements, [rule], "2026-11-06")), 0);
    assert.equal(physicalCount(withStandingBins(movements, [rule], "2026-11-06")), 0);
  });

  it("a collection-only history does not manufacture standing deliveries", () => {
    assert.equal(withStandingBins([job("2026-11-05", "Collect")], [rule], "2026-11-06").length, 1);
  });

  it("uncompleted deliveries do not suppress the two established bins", () => {
    const pending = { ...job("2026-11-05", "Deliver"), rental_status: "N" };
    assert.equal(withStandingBins([...exchanges, pending], [rule], "2026-11-06").filter(j => j.id.startsWith("standing:")).length, 2);
  });

  it("unserviced quantity evidence never invents a rental start", () => {
    const augmented = withStandingBins([job("2026-10-21", "Exchange")], [rule], "2026-11-06");
    assert.equal(onSite(augmented), 1);
    assert.equal(openRentalBins(augmented, settings, "2026-01-01", categoriseContainer, "2026-11-06")[0]?.lastJobNumber, augmented.find(j => !j.id.startsWith("standing:"))?.job_number);
  });
});
