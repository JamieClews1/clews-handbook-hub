import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { previousArticJobs, skiptrakMovementJobType, isArticContainer } from "./artic-site-jobs";

const job = (n: string, date: string, movement: string, container = "Curtain side Trailer", site = "Amazon BHX4") =>
  ({ id: n, job_number: n, job_date: date, site, container_type: container, movement_type: movement, waste_description: "Cardboard", ewc: "15 01 01" });

describe("previous artic jobs for New Job", () => {
  it("recognises curtain side trailers and ignores skips", () => {
    assert.equal(isArticContainer("Curtain side Trailer"), true);
    assert.equal(isArticContainer("40 yd Ro Ro"), false);
  });
  it("repeats a Waste Truck run as a Waste Truck job and an exchange as an exchange", () => {
    assert.equal(skiptrakMovementJobType("WasteTruck"), "waste_truck");
    assert.equal(skiptrakMovementJobType("Exchange"), "exchange");
    assert.equal(skiptrakMovementJobType("Other1"), null);
  });
  it("one entry per trailer stream with its latest completed job, skipping rental charges and future bookings", () => {
    const [g, ...rest] = previousArticJobs([job("1", "2026-10-01", "WasteTruck"), job("2", "2026-11-10", "WasteTruck"), job("3", "2026-11-27", "WasteTruck"), job("4", "2026-10-23", "Other1"), job("5", "2026-11-01", "Collect", "40 yd Ro Ro")], "2026-11-13");
    assert.equal(rest.length, 0);
    assert.equal(g.last.jobNumber, "2");
    assert.equal(g.last.jobType, "waste_truck");
    assert.equal(g.total, 2);
    assert.equal(g.standing, false);
  });
  it("a trailer delivered or exchanged on site is a standing trailer that can be exchanged", () => {
    const [g] = previousArticJobs([job("1", "2026-07-15", "Deliver", undefined, "Amazon EMA 1"), job("2", "2026-11-12", "Exchange", undefined, "Amazon EMA 1")], "2026-11-13");
    assert.equal(g.standing, true);
    assert.equal(g.last.jobType, "exchange");
  });
});
