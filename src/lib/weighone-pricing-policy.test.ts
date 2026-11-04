import { test } from "node:test";
import assert from "node:assert/strict";
import { hasWeighbridgePricing } from "./weighone-pricing-policy";
test("Skip tickets never carry weighbridge prices", () => assert.equal(hasWeighbridgePricing("skip"), false));
test("Waste In retains customer pricing", () => assert.equal(hasWeighbridgePricing("waste_in"), true));
test("Waste Out stays price-free", () => assert.equal(hasWeighbridgePricing("waste_out"), false));