import { it } from "node:test";
import assert from "node:assert/strict";
import { CONTAINER_GROUPS, bookingContainerLabel, rateContainerLabel } from "./container-taxonomy";
import { pricingContainerOptions } from "./booking-container-options";
const sizes = CONTAINER_GROUPS.flatMap(g => g.sizes.map(s => ({ size_code: s.code, display_name: s.label, is_active: true })));
it("SKIP offers the five specified sizes including enclosed", () => assert.deepEqual(pricingContainerOptions(sizes, "Skip").map(s => s.display_name), ["6 yd", "8 yd", "12 yd", "14 / 16 yd", "12 yd enclosed"]));
it("RORO keeps compactor and enclosed separate from 35 / 40 yd", () => assert.deepEqual(pricingContainerOptions(sizes, "Ro Ro").map(s => s.display_name), ["20 yd", "25 yd", "35 / 40 yd", "35 yd Compactor", "35 yd Enclosed"]));
it("ARTIC offers Curtain, Walking Floor and Ejector", () => assert.deepEqual(pricingContainerOptions(sizes, "Artic").map(s => s.display_name), ["Curtain", "Walking Floor", "Ejector"]));
it("PICKUP offers 7.5 TONNE", () => assert.deepEqual(pricingContainerOptions(sizes, "Pickup").map(s => s.display_name), ["7.5 TONNE"]));
it("inactive and unrelated pricing sizes never become booking choices", () => assert.deepEqual(pricingContainerOptions([{ size_code: "4yd", display_name: "4yd", is_active: true }, { size_code: "8yd", display_name: "8yd", is_active: false }], "Skip"), []));
it("new ticket display resolves stable codes but legacy text remains recorded", () => {
  assert.equal(bookingContainerLabel("Ro Ro", "35yd_compactor"), "RORO · 35 yd Compactor");
  assert.equal(bookingContainerLabel("Shipping Container"), "Shipping Container");
});
it("price display preserves included tonnage and material restrictions", () => assert.equal(rateContainerLabel("6 YD inc 6T"), "6 yd inc 6T"));