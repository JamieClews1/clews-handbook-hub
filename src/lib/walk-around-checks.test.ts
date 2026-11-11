import { it } from "node:test";
import assert from "node:assert/strict";
import { WALK_AROUND_TEMPLATE, dueDateFor, actionBucket, submissionProblems, addCalendarDays, daysUntil } from "./walk-around-checks";

it("the digital form carries every line from the paper sheet", () => {
  assert.deepEqual(WALK_AROUND_TEMPLATE.map(s => [s.title, s.items.length]), [
    ["Health and Safety", 21], ["General Requirements", 21], ["Storage", 9],
  ]);
  const keys = WALK_AROUND_TEMPLATE.flatMap(s => s.items.map(i => i.key));
  assert.equal(new Set(keys).size, keys.length);
});
it("high priority jobs are due 2 days after the inspection", () => {
  assert.equal(dueDateFor("2026-11-11", "high"), "2026-11-13");
});
it("medium priority jobs are due 7 days after the inspection", () => {
  assert.equal(dueDateFor("2026-11-11", "medium"), "2026-11-18");
});
it("low priority jobs are due 28 days after the inspection", () => {
  assert.equal(dueDateFor("2026-11-11", "low"), "2026-12-09");
});
it("due dates do not drift across the clock change or month end", () => {
  assert.equal(addCalendarDays("2026-10-24", 7), "2026-10-31");
  assert.equal(addCalendarDays("2026-03-27", 2), "2026-03-29");
  assert.equal(daysUntil("2026-03-30", "2026-03-28"), 2);
});
it("open jobs past their due date are overdue; due today counts as this week", () => {
  assert.equal(actionBucket({ status: "open", due_date: "2026-11-10" }, "2026-11-11"), "overdue");
  assert.equal(actionBucket({ status: "in_progress", due_date: "2026-11-11" }, "2026-11-11"), "this_week");
  assert.equal(actionBucket({ status: "open", due_date: "2026-11-18" }, "2026-11-11"), "this_week");
  assert.equal(actionBucket({ status: "open", due_date: "2026-11-19" }, "2026-11-11"), "later");
});
it("completed jobs are never overdue", () => {
  assert.equal(actionBucket({ status: "done", due_date: "2026-01-01" }, "2026-11-11"), "done");
});
it("a check cannot be submitted with unmarked lines", () => {
  assert.deepEqual(submissionProblems([{ state: "acceptable" }, { state: null }]), ["1 item still need marking"]);
});
it("a needs-attention line must say what action is required and by when", () => {
  const p = submissionProblems([{ state: "attention", action_required: "  ", due_date: null }]);
  assert.equal(p.length, 2);
  assert.deepEqual(submissionProblems([{ state: "attention", action_required: "Replace gate hinge", due_date: "2026-11-18" }, { state: "na" }]), []);
});
