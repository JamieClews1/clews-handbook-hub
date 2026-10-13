import { it } from "node:test";
import assert from "node:assert/strict";
import { dwtRowIssues, isValidCarrierReg } from "./dwt-validation";

it("old-style carrier number is flagged", () => {
  assert.equal(isValidCarrierReg("CB/HM3443BB"), false);
  assert.equal(isValidCarrierReg("CBDU203180"), true);
});

it("zero weight is flagged", () => {
  assert.equal(dwtRowIssues({ carrierReg: "CBDU203180", weightT: 0 }).length, 1);
  assert.equal(dwtRowIssues({ carrierReg: "CBDU203180", weightT: 0.3 }).length, 0);
});
