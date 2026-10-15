import { it } from "node:test";
import assert from "node:assert/strict";
import { computeStock } from "./metals";

const lead = { id: "l", name: "Lead", price_per_tonne: 1000, stock_limit_kg: 500, warn_at_kg: 400, is_active: true };

it("lead at 500 kg is over the limit", () => {
    const [s] = computeStock({ grades: [lead], sorts: [{ grade_id: "l", weight_kg: 500, is_voided: false }], dispatches: [], adjustments: [] });
    assert.equal(s.alert, "over");
  });
it("lead at 420 kg warns", () => {
    const [s] = computeStock({ grades: [lead], sorts: [{ grade_id: "l", weight_kg: 420, is_voided: false }], dispatches: [], adjustments: [] });
    assert.equal(s.alert, "warn");
  });
it("dispatch reduces stock once and voided sorts are ignored", () => {
    const [s] = computeStock({ grades: [lead], sorts: [{ grade_id: "l", weight_kg: 300, is_voided: false }, { grade_id: "l", weight_kg: 999, is_voided: true }], dispatches: [{ grade_id: "l", weight_kg: 100 }], adjustments: [] });
    assert.equal(s.kg, 200);
  });

