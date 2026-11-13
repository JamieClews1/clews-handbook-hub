import { describe, it } from "node:test";
import assert from "node:assert/strict";
import data from "@/data/midweigh-waste-out-types.json";
import { NO_PRODUCT, sortWasteTypeRows, wasteTypeReferenceRows, type WasteTypeEwcRow } from "@/lib/waste-type-references";

const rows = wasteTypeReferenceRows(data.rows as WasteTypeEwcRow[]);

describe("Waste Types by reference", () => {
  it("ranks references by tonnes, largest first", () => {
    assert.equal(rows[0].ref, "O-CARD");
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].tonnes >= rows[i].tonnes);
  });

  it("splits one EWC into its separate references and marks shared destinations", () => {
    const trommel = rows.find((r) => r.ref === "O-TROM")!;
    const landfill = rows.find((r) => r.ref === "O-LF")!;
    assert.equal(trommel.tonnes, 2717.32);
    assert.equal(landfill.loads, 165);
    assert.equal(trommel.ewcs[0].ewc, "19 12 12");
    assert.equal(trommel.ewcs[0].shared, true);
    assert.equal(rows.find((r) => r.ref === "PB")!.ewcs[0].shared, false);
  });

  it("keeps every load: loads without a product stay as their own row", () => {
    assert.equal(rows.reduce((s, r) => s + r.loads, 0), data.loads);
    const unrecorded = rows.find((r) => r.name === NO_PRODUCT)!;
    assert.equal(unrecorded.ref, null);
    assert.equal(unrecorded.loads, 14);
  });

  it("sorts by loads when asked", () => {
    assert.equal(sortWasteTypeRows(rows, "loads")[0].ref, "O-LF");
  });
});
