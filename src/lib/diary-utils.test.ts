import { describe, it, expect } from "vitest";
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

describe("isoWeekNumber", () => {
  it("labels 26 Oct 2026 as week 44", () => {
    expect(isoWeekNumber(new Date(2026, 9, 26))).toBe(44);
  });
  it("labels 1 Jan 2026 as week 1", () => {
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1);
  });
  it("labels 19 Oct 2026 (Monday) as week 43", () => {
    expect(isoWeekNumber(new Date(2026, 9, 19))).toBe(43);
  });
});

describe("getMonday", () => {
  it("returns the Monday of a Sunday's week", () => {
    expect(formatDate(getMonday(new Date(2026, 9, 25)))).toBe("2026-10-19");
  });
  it("returns the same day for a Monday", () => {
    expect(formatDate(getMonday(new Date(2026, 9, 19)))).toBe("2026-10-19");
  });
});

describe("categoryKeyOf", () => {
  it("treats a null category as general", () => {
    expect(categoryKeyOf(card({ category: null }))).toBe("general");
  });
  it("keeps known categories", () => {
    expect(categoryKeyOf(card({ category: "loads_out" }))).toBe("loads_out");
  });
});

describe("filterByCategory", () => {
  const cards = [
    card({ id: "a", category: null }),
    card({ id: "b", category: "drivers" }),
    card({ id: "c", category: "loads_out" }),
  ];
  it("returns everything for all", () => {
    expect(filterByCategory(cards, "all")).toHaveLength(3);
  });
  it("matches general entries by null category", () => {
    expect(filterByCategory(cards, "general").map((c) => c.id)).toEqual(["a"]);
  });
  it("filters a single category", () => {
    expect(filterByCategory(cards, "drivers").map((c) => c.id)).toEqual(["b"]);
  });
});

describe("searchEntries", () => {
  const cards = [
    card({ id: "a", content: "Waste out to Sita" }),
    card({ id: "b", content: "Service truck", notes: "MOT due Tuesday" }),
  ];
  it("matches content case-insensitively", () => {
    expect(searchEntries(cards, "waste").map((c) => c.id)).toEqual(["a"]);
  });
  it("matches notes", () => {
    expect(searchEntries(cards, "mot").map((c) => c.id)).toEqual(["b"]);
  });
  it("returns nothing for an empty query", () => {
    expect(searchEntries(cards, "  ")).toEqual([]);
  });
});

describe("entriesForDay", () => {
  it("sorts by display_order within the day", () => {
    const cards = [
      card({ id: "a", day_of_week: 2, display_order: 5 }),
      card({ id: "b", day_of_week: 2, display_order: 1 }),
      card({ id: "c", day_of_week: 3, display_order: 0 }),
    ];
    expect(entriesForDay(cards, 2).map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("repeatOccurrences", () => {
  const base = { week_start: "2026-10-19", day_of_week: 2 };

  it("weekly creates 8 future entries on the same weekday", () => {
    const occ = repeatOccurrences(base, "weekly");
    expect(occ).toHaveLength(8);
    expect(occ[0]).toEqual({ week_start: "2026-10-26", day_of_week: 2 });
    expect(occ[7]).toEqual({ week_start: "2026-12-14", day_of_week: 2 });
  });

  it("monthly creates 4 future entries four weeks apart", () => {
    const occ = repeatOccurrences(base, "monthly");
    expect(occ).toHaveLength(4);
    expect(occ[0].week_start).toBe("2026-11-16");
  });

  it("daily covers every day of the next 4 weeks without duplicating the original day", () => {
    const occ = repeatOccurrences(base, "daily");
    expect(occ).toHaveLength(28);
    expect(occ[0]).toEqual({ week_start: "2026-10-19", day_of_week: 3 - 2 });
    expect(occ.every((o) => !(o.week_start === "2026-10-19" && o.day_of_week === 2))).toBe(true);
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(formatDate(addDays(new Date(2026, 9, 31), 1))).toBe("2026-11-01");
  });
});
