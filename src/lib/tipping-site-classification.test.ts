import { test } from "node:test";
import assert from "node:assert/strict";
import { isSiteClass, tippingEligible, unlistedOutgoing } from "./tipping-site-classification";

test("Tipping site entries remain eligible", () => {
  assert.deepEqual(tippingEligible([{ site_class: "tipping_site" as const }]), [{ site_class: "tipping_site" }]);
});
test("Broker entries are excluded from tipping choices", () => {
  assert.equal(tippingEligible([{ site_class: "broker" as const }]).length, 0);
});
test("Haulage entries are excluded from tipping choices", () => {
  assert.equal(tippingEligible([{ site_class: "haulage" as const }]).length, 0);
});
test("Reclassified records cannot reappear through historical outgoing names", () => {
  assert.deepEqual(unlistedOutgoing([{ site_name: " Broker Ltd " }, { site_name: "Actual site" }], [{ site_name: "BROKER LTD" }]), [{ site_name: "Actual site" }]);
});
test("Only the three supported classifications are accepted", () => {
  assert.equal(isSiteClass("broker"), true);
  assert.equal(isSiteClass("haulage"), true);
  assert.equal(isSiteClass("unknown"), false);
});