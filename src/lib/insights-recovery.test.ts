import { it } from "node:test";
import assert from "node:assert/strict";
import { measuredRecoveryRows } from "./insights-recovery";
it("measured recovery uses recorded wood grade and kg not a fixed share", () => {
  const rows = measuredRecoveryRows([{ ewc: "19 12 07", product: "WOOD A OUT", waste_description: "Wood", weight_t: 2000 }], [{ stream: "Wood A", costPerTonne: 10 }], 168);
  assert.equal(rows[0].tonnes, 2); assert.equal(rows[0].saving, 316);
});
it("unmatched rates stay unknown rather than free processing", () => {
  assert.equal(measuredRecoveryRows([{ ewc: "19 12 12", product: "TROMMEL", weight_t: 1000 }], [], 168)[0].saving, null);
});