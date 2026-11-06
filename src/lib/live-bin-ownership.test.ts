import { test } from "node:test";
import assert from "node:assert/strict";
import { liveBinOwnership } from "./live-bin-ownership";
test("Own bins remain on Live Jobs and carry an Own count", () => {
  assert.deepEqual(liveBinOwnership("site|||40yd",2,new Set(["site|||40yd"]),new Set()),{onSite:2,own:2});
});
test("collected Own bins cannot reappear when filtering Live Jobs", () => {
  assert.deepEqual(liveBinOwnership("site|||40yd",2,new Set(["site|||40yd"]),new Set(["site|||40yd"])),{onSite:0,own:0});
});