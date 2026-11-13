import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { OFFICE_APP_TILES, newPinProblem, officeTileIcon, officeTileNavItem, visibleOfficeTiles, rememberPerson, rememberedPeople, updateRememberedToken, forgetPerson } from "./office-app";

const staff = { isAdmin: false, canAccessFinance: false, canAccessPl: false };

describe("Office App tiles", () => {
  it("lists the requested tools in order", () => {
    assert.deepEqual(OFFICE_APP_TILES.map((t) => t.label), [
      "Diary", "Load Reports Input", "Stock Check", "Banksman App", "Skip Tracker", "Contaminations", "Near Misses", "Toolbox Talks", "RAMS", "Walk Around Checks",
    ]);
  });

  it("Skip Tracker and Contaminations open the Driver App tools for signed-in office staff", () => {
    const tiles = visibleOfficeTiles(staff, new Set(), false).map((t) => t.path);
    assert.ok(tiles.includes("/office/skip-tracker"));
    assert.ok(tiles.includes("/office/contaminations"));
  });

  it("every tile reuses a staff navigation entry or carries its own icon", () => {
    for (const tile of OFFICE_APP_TILES) assert.ok(officeTileNavItem(tile) || tile.icon, tile.label);
  });

  it("Stock Check opens the standalone New Stock Take tally", () => {
    assert.equal(OFFICE_APP_TILES.find((t) => t.label === "Stock Check")?.path, "/performance-hub/stock-check/tally");
  });

  it("the Banksman App opens the full Banksman app", () => {
    const tile = OFFICE_APP_TILES.find((t) => t.label === "Banksman App");
    assert.equal(tile?.path, "/banksman");
    assert.ok(officeTileIcon(tile!), "Banksman tile has an icon without a sidebar entry");
  });

  it("Near Misses opens the near miss reporting page", () => {
    assert.equal(OFFICE_APP_TILES.find((t) => t.label === "Near Misses")?.path, "/nearmissreport");
  });

  it("the Banksman App tile shows for everyone (the app has its own PIN sign-in)", () => {
    const tiles = visibleOfficeTiles(staff, new Set(["weigh-one", "hs-near-miss"]), false);
    assert.ok(tiles.map((t) => t.label).includes("Banksman App"));
    assert.ok(!tiles.map((t) => t.label).includes("Near Misses"));
  });

  it("hides a tile when Section Visibility hides that section", () => {
    const tiles = visibleOfficeTiles(staff, new Set(["diary"]), false);
    assert.ok(!tiles.map((t) => t.label).includes("Diary"));
    assert.equal(tiles.length, 9);
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
