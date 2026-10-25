import { test } from "node:test";
import assert from "node:assert/strict";
import { localCalendarKey, londonCalendarKey, ticketPage } from "./ui-calendar";

test("Diary date key keeps local midnight on Saturday 24 October", () => {
  assert.equal(localCalendarKey(new Date(2026, 9, 24)), "2026-10-24");
});
test("WeighOne today uses London date during summer time", () => {
  assert.equal(londonCalendarKey(new Date("2026-10-24T23:30:00Z")), "2026-10-25");
});
test("WeighOne renders no more than 50 of the audited 1396 tickets per page", () => {
  const rows = Array.from({ length: 1396 }, (_, i) => i);
  assert.equal(ticketPage(rows, 1).items.length, 50);
  assert.equal(ticketPage(rows, 1).pages, 28);
  assert.equal(ticketPage(rows, 28).items.length, 46);
  assert.equal(ticketPage(rows, 2).items[0], 50);
});
test("WeighOne clamps stale page selection after filtering", () => {
  assert.deepEqual(ticketPage([1, 2], 28), { page: 1, pages: 1, items: [1, 2] });
});