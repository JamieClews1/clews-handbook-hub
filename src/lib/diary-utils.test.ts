import { it } from "node:test";
import assert from "node:assert/strict";
import {
  DiaryCard,
  isoWeekNumber,
  getMonday,
  addDays,
  formatDate,
  filterByCategory,
  searchEntries,
  entriesForDay,
  repeatOccurrences,
  categoryKeyOf,
} from "./diary-utils";

const card = (over: Partial<DiaryCard>): DiaryCard => ({
  id: "x",
  user_id: "u",
  day_of_week: 0,
  week_start: "2026-10-19",
  content: "",
  color: "default",
  display_order: 0,
  category: null,
  notes: null,
  done: false,
  assignee: null,
  repeat: null,
  ...over,
});

it("labels 26 Oct 2026 as ISO week 44", () => {
  assert.equal(isoWeekNumber(new Date(2026, 9, 26)), 44);
});

it("labels 1 Jan 2026 as ISO week 1", () => {
  assert.equal(isoWeekNumber(new Date(2026, 0, 1)), 1);
});

it("labels 19 Oct 2026 (Monday) as ISO week 43", () => {
  assert.equal(isoWeekNumber(new Date(2026, 9, 19)), 43);
});

it("getMonday returns the Monday of a Sunday's week", () => {
  assert.equal(formatDate(getMonday(new Date(2026, 9, 25))), "2026-10-19");
});

it("getMonday returns the same day for a Monday", () => {
  assert.equal(formatDate(getMonday(new Date(2026, 9, 19))), "2026-10-19");
});

it("treats a null category as general", () => {
  assert.equal(categoryKeyOf(card({ category: null })), "general");
});

it("keeps known categories", () => {
  assert.equal(categoryKeyOf(card({ category: "loads_out" })), "loads_out");
});

it("filterByCategory returns everything for all", () => {
  const cards = [card({ id: "a" }), card({ id: "b", category: "drivers" })];
  assert.equal(filterByCategory(cards, "all").length, 2);
});

it("filterByCategory matches general entries by null category", () => {
  const cards = [card({ id: "a" }), card({ id: "b", category: "drivers" })];
  assert.deepEqual(filterByCategory(cards, "general").map((c) => c.id), ["a"]);
});

it("filterByCategory filters a single category", () => {
  const cards = [card({ id: "a" }), card({ id: "b", category: "drivers" })];
  assert.deepEqual(filterByCategory(cards, "drivers").map((c) => c.id), ["b"]);
});

it("searchEntries matches content case-insensitively", () => {
  const cards = [card({ id: "a", content: "Waste out to Sita" })];
  assert.deepEqual(searchEntries(cards, "waste").map((c) => c.id), ["a"]);
});

it("searchEntries matches notes", () => {
  const cards = [card({ id: "b", content: "Service truck", notes: "MOT due Tuesday" })];
  assert.deepEqual(searchEntries(cards, "mot").map((c) => c.id), ["b"]);
});

it("searchEntries returns nothing for an empty query", () => {
  assert.deepEqual(searchEntries([card({ content: "x" })], "  "), []);
});

it("entriesForDay sorts by display_order within the day", () => {
  const cards = [
    card({ id: "a", day_of_week: 2, display_order: 5 }),
    card({ id: "b", day_of_week: 2, display_order: 1 }),
    card({ id: "c", day_of_week: 3, display_order: 0 }),
  ];
  assert.deepEqual(entriesForDay(cards, 2).map((c) => c.id), ["b", "a"]);
});

it("weekly repeat creates 8 future entries on the same weekday", () => {
  const occ = repeatOccurrences({ week_start: "2026-10-19", day_of_week: 2 }, "weekly");
  assert.equal(occ.length, 8);
  assert.deepEqual(occ[0], { week_start: "2026-10-26", day_of_week: 2 });
  assert.deepEqual(occ[7], { week_start: "2026-12-14", day_of_week: 2 });
});

it("monthly repeat creates 4 future entries four weeks apart", () => {
  const occ = repeatOccurrences({ week_start: "2026-10-19", day_of_week: 2 }, "monthly");
  assert.equal(occ.length, 4);
  assert.equal(occ[0].week_start, "2026-11-16");
});

it("daily repeat covers the next 4 weeks without duplicating the original day", () => {
  const occ = repeatOccurrences({ week_start: "2026-10-19", day_of_week: 2 }, "daily");
  assert.equal(occ.length, 28);
  assert.deepEqual(occ[0], { week_start: "2026-10-19", day_of_week: 3 });
  assert.ok(
    occ.every((o) => !(o.week_start === "2026-10-19" && o.day_of_week === 2)),
    "must not duplicate the entry's own day"
  );
});

it("addDays crosses month boundaries", () => {
  assert.equal(formatDate(addDays(new Date(2026, 9, 31), 1)), "2026-11-01");
});
