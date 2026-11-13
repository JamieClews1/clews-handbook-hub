import { test } from "node:test";
import assert from "node:assert/strict";
import { hasWeighbridgePricing, minimumChargeFor, weightChargeFor } from "./weighone-pricing-policy";
test("Skip tickets never carry weighbridge prices", () => assert.equal(hasWeighbridgePricing("skip"), false));
test("Waste In retains customer pricing", () => assert.equal(hasWeighbridgePricing("waste_in"), true));
test("Waste Out stays price-free", () => assert.equal(hasWeighbridgePricing("waste_out"), false));

test("General waste minimum is 350 kg at its rate (£205/t → £71.75)", () =>
  assert.equal(minimumChargeFor({ pricePerTonne: 205, exempt: false }), 71.75));
test("A 200 kg general waste load is charged as 350 kg", () =>
  assert.equal(weightChargeFor(200, 205, minimumChargeFor({ pricePerTonne: 205, exempt: false })), 71.75));
test("Loads over 350 kg are charged on actual weight", () =>
  assert.equal(weightChargeFor(1000, 205, 71.75), 205));
test("Soil and hardcore keep their own minimum charge, not 350 kg", () =>
  assert.equal(minimumChargeFor({ pricePerTonne: 47, exempt: true, ownMinCharge: 47 }), 47));
test("Changing the minimum weight setting changes the minimum charge", () =>
  assert.equal(minimumChargeFor({ pricePerTonne: 200, exempt: false, minWeightKg: 500 }), 100));
test("Free-of-charge waste never picks up a minimum", () =>
  assert.equal(weightChargeFor(100, 0, 50), 0));
