import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boardCapacity, boardUnconfirmed } from "./route-board-presentation";
describe("Day board capacity", () => {
  it("defaults to ten jobs without shift hours", () => {
    assert.equal(boardCapacity(6).percent, 60);
    assert.equal(boardCapacity(6).room, 4);
    assert.equal(boardCapacity(6).showRoom, false);
    assert.equal(boardCapacity(5).showRoom, true);
  });
  it("uses green below 75%, amber through 90%, red above 90%", () => {
    assert.equal(boardCapacity(7).tone, "available");
    assert.equal(boardCapacity(15, 20).tone, "busy");
    assert.equal(boardCapacity(9).tone, "busy");
    assert.equal(boardCapacity(10).tone, "over");
  });
  it("does not invent confirmation from dispatch or source", () => {
    assert.equal(boardUnconfirmed({}), false);
    assert.equal(boardUnconfirmed({ confirmed: false }), true);
    assert.equal(boardUnconfirmed({ is_confirmed: true }), false);
  });
});