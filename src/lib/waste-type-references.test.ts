import { describe, expect, it } from "vitest";
import data from "@/data/midweigh-waste-out-types.json";
import { NO_PRODUCT, sortWasteTypeRows, wasteTypeReferenceRows, type WasteTypeEwcRow } from "@/lib/waste-type-references";

const rows = wasteTypeReferenceRows(data.rows as WasteTypeEwcRow[]);

describe("Waste Types by reference", () => {
  it("ranks references by tonnes, largest first", () => {
    expect(rows[0].ref).toBe("O-CARD");
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].tonnes).toBeGreaterThanOrEqual(rows[i].tonnes);
  });

  it("splits one EWC into its separate references and marks shared destinations", () => {
    const trommel = rows.find((r) => r.ref === "O-TROM")!;
    const landfill = rows.find((r) => r.ref === "O-LF")!;
    expect(trommel.tonnes).toBe(2717.32);
    expect(landfill.loads).toBe(165);
    expect(trommel.ewcs[0]).toMatchObject({ ewc: "19 12 12", shared: true });
    expect(rows.find((r) => r.ref === "PB")!.ewcs[0].shared).toBe(false);
  });

  it("keeps every load: loads without a product stay as their own row", () => {
    expect(rows.reduce((s, r) => s + r.loads, 0)).toBe(data.loads);
    const unrecorded = rows.find((r) => r.name === NO_PRODUCT)!;
    expect(unrecorded).toMatchObject({ ref: null, loads: 14 });
  });

  it("sorts by loads when asked", () => {
    const byLoads = sortWasteTypeRows(rows, "loads");
    expect(byLoads[0].ref).toBe("O-LF");
  });
});
