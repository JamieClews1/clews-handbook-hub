import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPlannedRentalService, openRentalBins } from "./rental-open-movements";
import { categoriseContainer, type OverRentalJob } from "./overRental";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

const settings = { rental_free_days: 30, skip_container_keywords: ["skip", "yard", "yd"], roro_container_keywords: ["ro ro", "roro", "roll on roll off"], artic_container_keywords: ["artic"], artic_vehicle_regs: [] } as unknown as LiveJobsSettings;
const job = (job_number: string, job_date: string, movement_type: string, extra: Partial<OverRentalJob> = {}): OverRentalJob => ({ id: job_number, job_number, job_date, movement_type, customer: "Customer", site: "Site", container_type: ".8 yd Skip", waste_description: null, vehicle_registration: null, ewc: "20 03 01", rental_status: "Y", ...extra });

const TODAY = "2026-10-29";
const bins = (jobs: OverRentalJob[], planned: OverRentalJob[] = jobs) =>
  openRentalBins(jobs, settings, "2025-11-01", categoriseContainer, TODAY, planned);

describe("Containers with a booked collection or exchange are not chased", () => {
  it("hides an overdue skip whose collection is booked for tomorrow", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-11-05", "Collect", { rental_status: "N" })]).length, 0);
  });
  it("hides an overdue RoRo whose exchange is booked", () => {
    assert.equal(bins([
      job("1", "2026-04-01", "Deliver", { container_type: "40 yd Ro Ro" }),
      job("2", "2026-11-05", "Exchange", { container_type: "40 yd Ro Ro", rental_status: "N" }),
    ]).length, 0);
  });
  it("keeps the second bin when only one of two collections is booked", () => {
    const result = bins([
      job("1", "2026-04-01", "Deliver"),
      job("2", "2026-04-02", "Deliver"),
      job("3", "2026-11-05", "Collect", { rental_status: "N" }),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].netOnSite, 1);
    assert.equal(result[0].lastJobNumber, "2");
  });
  it("does not clear a bin with a collection booked at another site or for another customer", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-11-05", "Collect", { site: "Other Site", rental_status: "N" })])[0].lastJobNumber, "1");
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-11-05", "Collect", { customer: "Other Customer", rental_status: "N" })])[0].lastJobNumber, "1");
  });
  it("does not clear an overdue bin with a booked delivery", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-11-05", "Deliver", { rental_status: "N" })])[0].lastJobNumber, "1");
  });
  it("counts only bookings for today or later, not stale unconfirmed collections", () => {
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-10-01", "Collect", { rental_status: "N" })])[0].lastJobNumber, "1");
    assert.equal(bins([job("1", "2026-04-01", "Deliver"), job("2", "2026-10-29", "Collect", { rental_status: "N" })]).length, 0);
  });
  it("clears the oldest bin when a swap booked for another size still attends the site", () => {
    assert.equal(bins([
      job("1", "2026-04-01", "Deliver", { container_type: "8 Yard" }),
      job("2", "2026-11-05", "Exchange", { container_type: "12 Yard", rental_status: "N" }),
    ]).length, 0);
  });
  it("leaves an overdue skip alone when the booking is for a container that is not overdue", () => {
    const result = bins([
      job("1", "2026-04-01", "Deliver", { container_type: "8 Yard" }),
      job("2", "2026-10-25", "Deliver", { container_type: "12 Yard" }),
      job("3", "2026-11-05", "Collect", { container_type: "12 Yard", rental_status: "N" }),
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].lastJobNumber, "1");
  });
});

describe("Booked service detection", () => {
  it("accepts collections and exchanges dated today or later, whatever their status", () => {
    assert.equal(isPlannedRentalService(job("1", "2026-10-29", "Collect", { rental_status: "N" }), TODAY), true);
    assert.equal(isPlannedRentalService(job("1", "2026-11-05", "Exchange", { rental_status: "Y" }), TODAY), true);
    assert.equal(isPlannedRentalService(job("1", "2026-11-05", "Collect", { rental_status: "Q" }), TODAY), true);
  });
  it("rejects past bookings, deliveries and non-container movements", () => {
    assert.equal(isPlannedRentalService(job("1", "2026-10-28", "Collect", { rental_status: "N" }), TODAY), false);
    assert.equal(isPlannedRentalService(job("1", "2026-11-05", "Deliver", { rental_status: "N" }), TODAY), false);
    assert.equal(isPlannedRentalService(job("1", "2026-11-05", "Tip/Return", { rental_status: "N" }), TODAY), false);
    assert.equal(isPlannedRentalService(job("1", null, "Collect", { rental_status: "N" }), TODAY), false);
  });
});
