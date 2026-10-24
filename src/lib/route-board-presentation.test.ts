import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boardUnconfirmed } from "./route-board-presentation";
describe("Day board confirmation", () => {
  it("does not invent confirmation from dispatch or source", () => {
    assert.equal(boardUnconfirmed({}), false);
    assert.equal(boardUnconfirmed({ confirmed: false }), true);
    assert.equal(boardUnconfirmed({ is_confirmed: true }), false);
  });
});