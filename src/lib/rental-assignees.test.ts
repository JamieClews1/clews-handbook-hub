import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eligibleRentalAssignees } from "./rental-assignees";

describe("rental assignees", () => {
  it("allows only active Clews Office staff, not customers or driver/yard-only users", () => {
    const profiles = [
      { id: "office", user_types: ["office"], is_archived: false },
      { id: "mixed", user_types: ["office", "management"], is_archived: false },
      { id: "customer", user_types: ["office"], is_archived: false },
      { id: "driver", user_types: ["driver"], is_archived: false },
      { id: "yard", user_types: ["yard"], is_archived: false },
      { id: "archived", user_types: ["office"], is_archived: true },
    ];
    assert.deepEqual(eligibleRentalAssignees(profiles, ["office", "mixed", "driver", "yard", "archived"]).map(p => p.id), ["office", "mixed"]);
  });

  it("excludes staff recorded as having left the company", () => {
    const profiles = [
      { id: "current", user_types: ["office"], is_archived: false, left_at: null },
      { id: "left", user_types: ["office"], is_archived: false, left_at: "2026-11-01" },
    ];
    assert.deepEqual(eligibleRentalAssignees(profiles, ["current", "left"]).map(p => p.id), ["current"]);
  });
});