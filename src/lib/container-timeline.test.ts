import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { labelSides, mergeDots, mondayOf, nativeDot, onSiteSince, skipDot, timelineAxis, timelineFlags, type TimelineDot } from "./container-timeline";

const today = "2026-11-13";
const dot = (date: string, over: Partial<TimelineDot> = {}): TimelineDot => ({ key: date, jobNumber: date, date, kind: date <= today ? "completed" : "booked", movement: "Exchange", status: date <= today ? "Completed" : "Booked in Skiptrak", source: "Skip", nativeId: null, ...over });

describe("container timeline", () => {
  it("colours Skiptrak and Route One jobs by state", () => {
    assert.equal(skipDot({ id: "1", job_number: "51518", job_date: "2026-11-06", movement_type: "Exchange" }, true, today)?.kind, "completed");
    assert.equal(skipDot({ id: "2", job_number: "51520", job_date: "2026-11-20", movement_type: "Exchange" }, false, today)?.kind, "booked");
    assert.equal(skipDot({ id: "3", job_number: "51530", job_date: "2026-11-02", movement_type: "Collect" }, true, today)?.kind, "collection");
    const scheduled = nativeDot({ id: "a", job_number: "RO-1", scheduled_date: "2026-12-18", job_type: "exchange", status: "unassigned", schedule_id: "s" });
    assert.equal(scheduled.kind, "scheduled");
    assert.equal(scheduled.status, "Booked, no driver yet (from schedule)");
    assert.equal(nativeDot({ id: "b", job_number: "RO-2", scheduled_date: "2026-12-18", job_type: "exchange", status: "assigned", assigned_driver_id: "d" }).kind, "booked");
  });

  it("keeps a Route One copy of a Skiptrak job once", () => {
    const merged = mergeDots([dot("2026-11-20", { jobNumber: "51520" })], [dot("2026-11-20", { jobNumber: "51520", source: "Route One" }), dot("2026-12-18", { jobNumber: "RO-9", source: "Route One" })]);
    assert.deepEqual(merged.map(d => d.jobNumber), ["51520", "RO-9"]);
    const linked = mergeDots([dot("2026-02-27", { jobNumber: "46097" })], [dot("2026-02-27", { jobNumber: "46097", source: "Route One", nativeId: "ro-id" })]);
    assert.equal(linked[0].source, "Skip");
    assert.equal(linked[0].nativeId, "ro-id");
  });

  it("alternates labels when dots are under six days apart", () => {
    assert.deepEqual(labelSides([{ date: "2026-11-06" }, { date: "2026-11-10" }, { date: "2026-11-13" }, { date: "2026-11-27" }]), ["below", "above", "below", "below"]);
  });

  it("hides labels on busy trailer runs rather than overlapping them", () => {
    assert.deepEqual(labelSides([{ date: "2026-11-02" }, { date: "2026-11-03" }, { date: "2026-11-04" }, { date: "2026-11-06" }, { date: "2026-11-09" }]), ["below", "above", "none", "below", "above"]);
  });

  it("finds when the container arrived after its last collection", () => {
    const dots = [dot("2026-09-01", { movement: "Delivery" }), dot("2026-09-20", { kind: "collection", movement: "Collection" }), dot("2026-10-02", { movement: "Delivery", jobNumber: "D2" }), dot("2026-10-09")];
    assert.deepEqual(onSiteSince(dots, today), { date: "2026-10-02", jobNumber: "D2", known: true });
    assert.equal(onSiteSince([dot("2026-10-09")], today)?.known, false);
  });

  it("flags weekend bookings, a missed week and nothing booked ahead", () => {
    const dots = [dot("2026-10-09"), dot("2026-10-16"), dot("2026-10-30"), dot("2026-11-06"), dot("2026-11-14")];
    const labels = timelineFlags(dots, { today, cadenceWeeks: 1, chained: true, scheduleActive: false }).map(f => `${f.date} ${f.label}`);
    assert.ok(labels.includes("2026-10-23 Week missed"));
    assert.ok(labels.includes("2026-11-14 Saturday?"));
    assert.ok(labels.includes("2026-11-14 No bookings after Sat 14 Nov"));
  });

  it("shows a change of frequency instead of missed weeks", () => {
    const dots = ["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-30", "2026-11-13", "2026-11-27", "2026-12-11"].map(d => dot(d));
    const flags = timelineFlags(dots, { today, cadenceWeeks: 2, chained: true, scheduleActive: false });
    assert.deepEqual(flags.map(f => `${f.date} ${f.label} ${f.tone}`), ["2026-10-16 Weekly → every 2 wks info"]);
  });

  it("does not warn about bookings ahead when an active schedule covers the bin", () => {
    const flags = timelineFlags([dot("2026-10-30"), dot("2026-11-06"), dot("2026-11-20")], { today, cadenceWeeks: 1, chained: true, scheduleActive: true });
    assert.ok(!flags.some(f => f.label.startsWith("No bookings")));
  });

  it("flags an exchange after the container was collected", () => {
    const flags = timelineFlags([dot("2026-10-02", { kind: "collection", movement: "Collection" }), dot("2026-10-09")], { today, cadenceWeeks: null, chained: true, scheduleActive: false });
    assert.deepEqual(flags.map(f => f.label), ["Chain broken"]);
  });

  it("builds a Monday axis about 6 weeks either side", () => {
    assert.equal(mondayOf("2026-11-13"), "2026-11-09");
    const axis = timelineAxis(today, null, 6, 6);
    assert.equal(axis.start, "2026-09-28");
    assert.ok(axis.end >= "2026-12-25");
    assert.ok(axis.mondays.every(m => new Date(`${m}T00:00:00Z`).getUTCDay() === 1));
    assert.equal(timelineAxis(today, null, 6, 6, 26, "2026-02-27").start, "2026-02-09");
  });
});
