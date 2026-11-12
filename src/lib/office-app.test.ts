import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { OFFICE_APP_TILES, newPinProblem, officeTileNavItem, visibleOfficeTiles, rememberPerson, rememberedPeople, updateRememberedToken, forgetPerson } from "./office-app";

const staff = { isAdmin: false, canAccessFinance: false, canAccessPl: false };

describe("Office App tiles", () => {
  it("lists the eight requested tools in order", () => {
    assert.deepEqual(OFFICE_APP_TILES.map((t) => t.label), [
      "Diary", "Load Reports Input", "Stock Check", "Weighbridge App", "Near Misses", "Toolbox Talks", "RAMS", "Walk Around Checks",
    ]);
  });

  it("every tile reuses an existing staff navigation entry", () => {
    for (const tile of OFFICE_APP_TILES) assert.ok(officeTileNavItem(tile), tile.label);
  });

  it("the Weighbridge App opens WeighOne in tablet view", () => {
    assert.equal(OFFICE_APP_TILES.find((t) => t.label === "Weighbridge App")?.path, "/weigh-one?tablet=1");
  });

  it("hides a tile when Section Visibility hides that section", () => {
    const tiles = visibleOfficeTiles(staff, new Set(["diary"]), false);
    assert.ok(!tiles.map((t) => t.label).includes("Diary"));
    assert.equal(tiles.length, 7);
  });

  it("hides a tile when a named-people list excludes this person", () => {
    const tiles = visibleOfficeTiles({ ...staff, restrictedAllows: (k) => (k === "hs-rams" ? false : null) }, new Set(), false);
    assert.ok(!tiles.map((t) => t.label).includes("RAMS"));
  });
});

describe("choosing an Office App PIN", () => {
  it("rejects keeping the starting PIN 1234", () => assert.notEqual(newPinProblem("1234"), null));
  it("requires exactly 4 digits", () => {
    assert.notEqual(newPinProblem("123"), null);
    assert.notEqual(newPinProblem("12345"), null);
    assert.notEqual(newPinProblem("12a4"), null);
  });
  it("rejects the same digit four times", () => assert.notEqual(newPinProblem("7777"), null));
  it("requires the confirmation to match", () => assert.notEqual(newPinProblem("4829", "4828"), null));
  it("accepts a new 4-digit PIN", () => assert.equal(newPinProblem("4829", "4829"), null));
});

describe("remembered people on a device", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear"> }).localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, String(v)),
      removeItem: (k) => void store.delete(k),
      clear: () => store.clear(),
    };
  });
  it("keeps one entry per person and updates their saved session", () => {
    rememberPerson({ userId: "a", username: "laurac", name: "Laura", refreshToken: "t1" });
    rememberPerson({ userId: "a", username: "laurac", name: "Laura", refreshToken: "t2" });
    updateRememberedToken("a", "t3");
    assert.deepEqual(rememberedPeople(), [{ userId: "a", username: "laurac", name: "Laura", refreshToken: "t3" }]);
    forgetPerson("a");
    assert.deepEqual(rememberedPeople(), []);
  });
});
