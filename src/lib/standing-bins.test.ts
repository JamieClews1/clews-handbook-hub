import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withStandingBins, type StandingBinRule } from "./standing-bins";
import { openRentalBins } from "./rental-open-movements";
import { categoriseContainer } from "./overRental";

const settings = { rental_free_days: -1, artic_vehicle_regs: [], artic_container_keywords: [], roro_container_keywords: ["ro ro"], skip_container_keywords: ["yard", "yd"] } as never;
let n = 0;
const job = (date: string, movement: string, ewc = "17 02 03") => ({
  id: `j${++n}`, job_number: String(50000 + n), job_date: date, customer: "Veka Recycling Ltd", site: "Munster Joinery UK Ltd",
  container_type: "40 yd Ro Ro", movement_type: movement, waste_description: null, vehicle_registration: null, ewc, postcode: null, rental_status: "Y",
});
const rule: StandingBinRule = { id: "r1", customer: "Veka Recycling Ltd", site: "Munster Joinery UK Ltd", container_type: "40 yd Ro Ro", ewc: "17 02 03", bin_count: 2, active: true };
const onSite = (jobs: ReturnType<typeof job>[]) =>
  openRentalBins(jobs, settings, "2026-01-01", categoriseContainer, "2026-11-06").reduce((s, b) => s + b.netOnSite, 0);

describe("standing bins", () => {
  const exchanges = [job("2026-10-21", "Exchange"), job("2026-10-21", "Exchange"), job("2026-11-03", "Exchange")];

  it("exchange-only position counts as one bin without a rule", () => {
    assert.equal(onSite(exchanges), 1);
  });

  it("a confirmed rule of 2 shows 2 bins on site", () => {
    assert.equal(onSite(withStandingBins(exchanges, [rule], "2026-11-06")), 2);
  });

  it("a later real collection reduces the confirmed count to 1", () => {
    assert.equal(onSite(withStandingBins([...exchanges, job("2026-11-05", "Collect")], [rule], "2026-11-06")), 1);
  });

  it("another waste stream's exchange does not absorb a confirmed bin", () => {
    const mixed = [...exchanges, job("2026-10-25", "Exchange", "20 03 01")];
    assert.equal(onSite(withStandingBins(mixed, [rule], "2026-11-06")), 3);
  });

  it("two real deliveries followed by a collection leave one, not two", () => {
    const movements = [job("2026-10-01", "Deliver"), job("2026-10-01", "Deliver"), job("2026-11-05", "Collect")];
    assert.equal(onSite(withStandingBins(movements, [rule], "2026-11-06")), 1);
  });

  it("two collections clear two delivered bins without replenishment", () => {
    const movements = [job("2026-10-01", "Deliver"), job("2026-10-01", "Deliver"), job("2026-11-04", "Collect"), job("2026-11-05", "Collect")];
    assert.equal(onSite(withStandingBins(movements, [rule], "2026-11-06")), 0);
  });

  it("a collection-only history does not manufacture standing deliveries", () => {
    assert.equal(withStandingBins([job("2026-11-05", "Collect")], [rule], "2026-11-06").length, 1);
  });

  it("uncompleted deliveries do not suppress the two established bins", () => {
    const pending = { ...job("2026-11-05", "Deliver"), rental_status: "N" };
    assert.equal(onSite(withStandingBins([...exchanges, pending], [rule], "2026-11-06")), 2);
  });
});
