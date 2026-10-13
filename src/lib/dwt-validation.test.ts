import { expect, test } from "bun:test";
import { dwtRowIssues, isValidCarrierReg } from "./dwt-validation";

test("old-style carrier number is flagged", () => {
  expect(isValidCarrierReg("CB/HM3443BB")).toBe(false);
  expect(isValidCarrierReg("CBDU203180")).toBe(true);
});

test("zero weight is flagged", () => {
  expect(dwtRowIssues({ carrierReg: "CBDU203180", weightT: 0 }).length).toBe(1);
  expect(dwtRowIssues({ carrierReg: "CBDU203180", weightT: 0.3 }).length).toBe(0);
});
