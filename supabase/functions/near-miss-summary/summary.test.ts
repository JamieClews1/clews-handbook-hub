import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseSummary, reportsInPeriod } from "./summary.ts";

const rows = [
  { id: "a", created_at: "2026-11-12T08:11:49Z" },
  { id: "b", created_at: "2026-11-19T08:01:11Z" },
  { id: "c", created_at: "2026-09-11T08:13:18Z" },
];

test("only reports submitted after the previous summary are included", () => {
  assert.deepEqual(reportsInPeriod(rows, "2026-11-12T08:11:49Z", "2026-11-19T09:00:00Z").map(r => r.id), ["b"]);
});

test("first summary includes every report, oldest first", () => {
  assert.deepEqual(reportsInPeriod(rows, null, "2026-11-19T09:00:00Z").map(r => r.id), ["c", "a", "b"]);
});

test("references to reports outside the period are dropped and unknown categories become other", () => {
  const s = normaliseSummary({ actions: [{ category: "sack", action: "Brief yard", reports: ["NM1", "NM9", "nm2"] }] }, 2);
  assert.equal(s.actions[0].category, "other");
  assert.deepEqual(s.actions[0].reports, ["NM1", "NM2"]);
});
