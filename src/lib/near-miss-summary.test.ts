import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupActions, reportsSinceLast, type SummaryAction } from "./near-miss-summary";

const a = (category: SummaryAction["category"], priority: SummaryAction["priority"], action: string): SummaryAction =>
  ({ category, priority, action, reason: "", owner: "Yard Manager", reports: [], existing_document: null });

describe("near miss summary", () => {
  it("lists retraining, toolbox talks, risk assessments, disciplinary then other, even when empty", () => {
    assert.deepEqual(groupActions([]).map(g => g.label), ["Retraining", "Toolbox Talks", "Risk Assessments", "Disciplinary", "Other actions"]);
  });
  it("puts high priority actions first within a category", () => {
    const g = groupActions([a("retraining", "low", "L"), a("retraining", "high", "H")]);
    assert.deepEqual(g[0].actions.map(x => x.action), ["H", "L"]);
  });
  it("counts only reports submitted after the previous summary", () => {
    const reports = [{ created_at: "2026-11-12T08:11:49Z" }, { created_at: "2026-11-19T08:01:11Z" }];
    assert.equal(reportsSinceLast(reports, "2026-11-15T00:00:00Z").length, 1);
    assert.equal(reportsSinceLast(reports, null).length, 2);
  });
});
