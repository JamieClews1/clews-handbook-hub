import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sortTalks, talkAppliesTo, talkNumber } from "./toolbox-talk-list";

const t = (id: string, ref: string, extra: Partial<{ user_types: string[]; assigned_users: string[]; is_mandatory: boolean }> = {}) => ({
  id, reference_code: ref, created_date: "2025-12-03", user_types: [], assigned_users: [], is_mandatory: false, ...extra,
});

describe("toolbox talk list", () => {
  it("sorts by talk number, newest first, not text order", () => {
    const out = sortTalks([t("a", "TBT-2"), t("b", "TBT-12"), t("c", "TBT-10")], "newest", new Set());
    assert.deepEqual(out.map((x) => x.reference_code), ["TBT-12", "TBT-10", "TBT-2"]);
    assert.equal(talkNumber("TBT-11"), 11);
  });

  it("oldest first reverses the order", () => {
    const out = sortTalks([t("a", "TBT-2"), t("b", "TBT-12"), t("c", "TBT-1")], "oldest", new Set());
    assert.deepEqual(out.map((x) => x.reference_code), ["TBT-1", "TBT-2", "TBT-12"]);
  });

  it("to-sign puts unsigned mandatory first and signed last", () => {
    const out = sortTalks(
      [t("s", "TBT-9", { is_mandatory: true }), t("o", "TBT-8"), t("m", "TBT-3", { is_mandatory: true })],
      "to-sign",
      new Set(["s"]),
    );
    assert.deepEqual(out.map((x) => x.id), ["m", "o", "s"]);
  });

  it("applies by user type or by named assignment", () => {
    assert.equal(talkAppliesTo(t("a", "TBT-11", { user_types: ["driver"] }), "u1", ["office"]), false);
    assert.equal(talkAppliesTo(t("a", "TBT-11", { user_types: ["driver"] }), "u1", ["driver"]), true);
    assert.equal(talkAppliesTo(t("a", "TBT-11", { user_types: ["driver"], assigned_users: ["u1"] }), "u1", []), true);
  });
});
