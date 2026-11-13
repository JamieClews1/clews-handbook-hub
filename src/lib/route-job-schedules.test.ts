import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { binFutureBookings, detectCadenceWeeks, nextExchangeAfterBookings, scheduleOccurrences, scheduleCoversBin } from "./route-job-schedules";

describe("route job schedules", () => {
  it("books fortnightly occurrences on the start weekday within the window", () => {
    assert.deepEqual(scheduleOccurrences({ start_date: "2026-12-18", interval_weeks: 2 }, "2026-11-13", "2027-01-31"), ["2026-12-18", "2027-01-01", "2027-01-15", "2027-01-29"]);
  });

  it("continues the pattern from today without shifting the weekday", () => {
    assert.deepEqual(scheduleOccurrences({ start_date: "2026-10-02", interval_weeks: 1 }, "2026-11-13", "2026-11-27"), ["2026-11-13", "2026-11-20", "2026-11-27"]);
  });

  it("stops at the end date", () => {
    assert.deepEqual(scheduleOccurrences({ start_date: "2026-11-20", interval_weeks: 1, end_date: "2026-11-30" }, "2026-11-13", "2026-12-31"), ["2026-11-20", "2026-11-27"]);
  });

  it("recognises Britvic wood moving from weekly to fortnightly", () => {
    assert.equal(detectCadenceWeeks(["2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30", "2026-11-06", "2026-11-20", "2026-12-04"]), 2);
  });

  it("recognises a weekly run with a one-day shift", () => {
    assert.equal(detectCadenceWeeks(["2026-10-30", "2026-11-06", "2026-11-14", "2026-11-20", "2026-11-27"]), 1);
  });

  it("does not call several runs a week a weekly repeat", () => {
    assert.equal(detectCadenceWeeks(["2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18"]), null);
  });

  it("does not guess a repeat from one gap", () => {
    assert.equal(detectCadenceWeeks(["2026-11-06", "2026-11-20"]), null);
  });

  it("links future job 51520 to the bin last exchanged on 51518", () => {
    const bin = { site: "Britvic - Waste Yard Rugby 1 (New)", container: "40 yd Ro Ro", ewc: "15 01 03" };
    const skip = [
      { job_number: "51518", job_date: "2026-11-06", site: bin.site, container_type: "40 yd Ro Ro", ewc: "15 01 03", movement_type: "Exchange" },
      { job_number: "51520", job_date: "2026-11-20", site: bin.site, container_type: "40 yd Ro Ro", ewc: "15 01 03", movement_type: "Exchange" },
      { job_number: "51511", job_date: "2026-11-20", site: bin.site, container_type: "40 yd Ro Ro", ewc: "20 03 01", movement_type: "Exchange" },
    ];
    const native = [{ id: "a", job_number: "RO-1", scheduled_date: "2026-12-18", site_name: bin.site, container_type: "Ro Ro", container_size: "40yd", ewc_code: "15 01 03", job_type: "exchange", schedule_id: "s1" }];
    const rows = binFutureBookings(bin, skip, native, j => (j.job_date ?? "") >= "2026-11-13");
    assert.deepEqual(rows.map(r => r.key), ["51520", "RO-1"]);
    assert.equal(rows[1].scheduleId, "s1");
  });

  it("books the next exchange after the last booked one by the repeat interval", () => {
    assert.equal(nextExchangeAfterBookings("2026-12-04", 2, "2026-11-20"), "2026-12-18");
    assert.equal(nextExchangeAfterBookings("2026-12-04", null, "2026-11-20"), "2026-12-11");
    assert.equal(nextExchangeAfterBookings(null, 2, "2026-11-20"), "2026-11-20");
  });

  it("matches a schedule to its bin by site, container and EWC", () => {
    const s = { match_site: "Rugby 3", match_container: "40 yd Ro Ro", ewc_code: "20 03 01" };
    assert.equal(scheduleCoversBin(s, { site: "rugby 3", container: "40 yd Ro Ro", ewc: "200301" }), true);
    assert.equal(scheduleCoversBin(s, { site: "Rugby 3", container: "40 yd Ro Ro", ewc: "15 01 03" }), false);
  });
});
