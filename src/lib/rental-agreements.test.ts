import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agreementCoversBin, agreedRentalRate, trackedAgreementBins } from "./rental-agreements";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

const settings = { rental_free_days: 30, skip_container_keywords: ["skip"], roro_container_keywords: ["roro"], artic_container_keywords: [], artic_vehicle_regs: [] } as unknown as LiveJobsSettings;
const job = { id: "1", job_number: "123", job_date: new Date().toISOString().slice(0, 10), customer: "Test company", site: "Test site", container_type: "8 yard skip", movement_type: "Deliver", waste_description: null, vehicle_registration: null, ewc: null };

describe("No Rental agreements", () => {
  it("charges zero even if an old rate is supplied", () => {
    assert.equal(agreedRentalRate("no_rental", 18), 0);
    assert.equal(agreedRentalRate("charged", 18), 18);
  });
  it("continues tracking on-site containers from delivery, including inside the free period", () => {
    const bins = trackedAgreementBins([job], settings);
    assert.equal(bins.length, 1);
    assert.equal(bins[0].netOnSite, 1);
    assert.equal(bins[0].daysSinceActivity, 0);
    assert.equal(agreementCoversBin({ customer: job.customer, site: job.site, container_type: job.container_type, status: "active", start_date: null, end_date: null, rental_mode: "no_rental" }, bins[0]), true);
  });
  it("stops tracking when a collection clears the container", () => {
    assert.equal(trackedAgreementBins([job, { ...job, id: "2", job_number: "124", movement_type: "Collect" }], settings).length, 0);
  });
});