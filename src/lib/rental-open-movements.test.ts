import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openRentalBins, rentalContainerKey } from "./rental-open-movements";
import { categoriseContainer, type OverRentalJob } from "./overRental";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

const settings = { rental_free_days: 30, skip_container_keywords: ["skip", "yard", "yd"], roro_container_keywords: ["ro ro", "roro", "roll on roll off"], artic_container_keywords: ["artic"], artic_vehicle_regs: [] } as unknown as LiveJobsSettings;
const job = (job_number: string, job_date: string, movement_type: string, extra: Partial<OverRentalJob> = {}): OverRentalJob => ({ id: job_number, job_number, job_date, movement_type, customer: "Customer", site: "Site", container_type: ".8 yd Skip", waste_description: null, vehicle_registration: null, ewc: "20 03 01", rental_status: "Y", ...extra });
const bins = (jobs: OverRentalJob[]) => openRentalBins(jobs, settings, "2025-11-01", categoriseContainer, "2026-10-29");

describe("Only overdue open skips and RoRos are chased", () => {
  it("excludes containers still inside or exactly at the free-period boundary", () => {
    assert.equal(bins([job("1", "2026-09-29", "Deliver")]).length, 0);
    assert.equal(bins([job("1", "2026-09-28", "Deliver")])[0].daysSinceActivity, 31);
  });
  it("clears a collected skip despite changed EWC and container spelling", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-10-01", "Collect", { container_type: "8 Yard", ewc: "17 09 04" })]).length, 0);
  });
  it("does not retain the old delivery ticket after a recent exchange", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-10-10", "Exchange", { ewc: "17 09 04" })]).length, 0);
  });
  it("shows only the replacement ticket once the exchange itself is overdue", () => {
    const result = bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-09-01", "Exchange")]);
    assert.equal(result[0].lastJobNumber, "2");
    assert.equal(result[0].netOnSite, 1);
    assert.equal(result[0].daysSinceActivity, 58);
  });
  it("ignores uncompleted and future collections rather than falsely clearing stock", () => {
    const result = bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-10-01", "Collect", { rental_status: "N" }), job("3", "2026-11-01", "Collect")]);
    assert.equal(result[0].lastJobNumber, "1");
    assert.equal(result[0].netOnSite, 1);
  });
  it("ignores query and void movements", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver", { rental_status: "Q" }), job("2", "2026-04-02", "Deliver", { rental_status: "V" })]).length, 0);
  });
  it("matches physical RoRo size without the included-weight pricing suffix", () => {
    assert.equal(rentalContainerKey("40yd Inc 3t Ro Ro"), rentalContainerKey("40 Yard Roll on Roll off"));
    assert.equal(bins([job("1", "2026-04-01", "Deliver", { container_type: "40yd Inc 3t Ro Ro" }), job("2", "2026-10-01", "Collect", { container_type: "40 Yard Roll on Roll off" })]).length, 0);
  });
  it("does not let a collection of another size hide an overdue skip", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-10-01", "Deliver", { container_type: "12 yard" }), job("3", "2026-10-02", "Collect", { container_type: "12 yard" })])[0].lastJobNumber, "1");
  });
  it("excludes artic trailers", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver", { container_type: "Artic" })]).length, 0);
  });
  it("preserves another overdue container when one of two is collected", () => {
    const result = bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-04-02", "Deliver"), job("3", "2026-10-01", "Collect")]);
    assert.equal(result[0].netOnSite, 1);
    assert.equal(result[0].lastJobNumber, "2");
  });
});