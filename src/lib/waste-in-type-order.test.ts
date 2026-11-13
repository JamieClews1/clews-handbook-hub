import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rankWasteInTypes,
  searchWasteInTypes,
  wasteInLoadsFor,
  WASTE_IN_TOP_N,
} from "./waste-in-type-order";

const T = (waste_type: string, ewc_code: string) => ({ id: waste_type, waste_type, ewc_code });

/** Standard names now on the weighbridge rate card; loads come from the Midweigh inbound analysis. */
const types = [
  T("General Waste", "20 03 01"),
  T("Wood – Construction / C GRADE", "17 02 01"),
  T("Cardboard & Paper Packaging", "15 01 01"),
  T("Wood – Packaging / Pallets A GRADE", "15 01 03"),
  T("POPs Waste (Upholstered Seating)", "20 03 07*"),
  T("Green Waste", "20 02 01"),
  T("WEEE (excl. fridges, TVs & tubes)", "20 01 36"),
  T("Hardcore (Concrete, Bricks, Tiles & Ceramics)", "17 01 07"),
  T("Construction & Demolition", "17 09 04"),
  T("Mixed Packaging (Co-mingled / DMR)", "15 01 06"),
  T("Plasterboard", "17 08 02"),
  T("Textiles", "20 01 11"),
  T("Aardvark waste", "99 99 99"),
];

const names = (list: { waste_type: string }[]) => list.map(t => t.waste_type);

describe("waste in picker order", () => {
  it("shows ten most common types at the top", () => {
    assert.equal(WASTE_IN_TOP_N, 10);
  });

  it("reads inbound loads per standard waste stream, whatever the recorded wording", () => {
    assert.equal(wasteInLoadsFor("General Waste", "20 03 01"), 3867);
    assert.equal(wasteInLoadsFor("Mixed Municipal Waste", "20 03 01"), 3867);
    assert.equal(wasteInLoadsFor("Low Grade Wood (Grade C)", "17 02 01"), 640);
    assert.equal(wasteInLoadsFor("Never Seen Product"), null);
  });

  it("puts the ten busiest inbound types first, busiest first", () => {
    assert.deepEqual(names(rankWasteInTypes(types)).slice(0, 10), [
      "General Waste",
      "Wood – Construction / C GRADE",
      "Cardboard & Paper Packaging",
      "Wood – Packaging / Pallets A GRADE",
      "POPs Waste (Upholstered Seating)",
      "Green Waste",
      "WEEE (excl. fridges, TVs & tubes)",
      "Hardcore (Concrete, Bricks, Tiles & Ceramics)",
      "Construction & Demolition",
      "Mixed Packaging (Co-mingled / DMR)",
    ]);
  });

  it("lists everything after the top ten alphabetically", () => {
    assert.deepEqual(names(rankWasteInTypes(types)).slice(10), ["Aardvark waste", "Plasterboard", "Textiles"]);
  });

  it("never promotes a type the analysis has not seen", () => {
    const ranked = rankWasteInTypes([T("Aardvark waste", "99 99 99"), ...types]);
    assert.equal(ranked[0].waste_type, "General Waste");
    assert.ok(!ranked.slice(0, WASTE_IN_TOP_N).some(t => t.waste_type === "Aardvark waste"));
  });

  it("searches by name or code without reordering", () => {
    const ranked = rankWasteInTypes(types);
    assert.deepEqual(names(searchWasteInTypes(ranked, "wood")), [
      "Wood – Construction / C GRADE",
      "Wood – Packaging / Pallets A GRADE",
    ]);
    assert.deepEqual(names(searchWasteInTypes(ranked, "20 02 01")), ["Green Waste"]);
    assert.deepEqual(names(searchWasteInTypes(ranked, "WOOD-CC")), ["Wood – Construction / C GRADE"]);
    assert.deepEqual(names(searchWasteInTypes(ranked, "")), names(ranked));
    assert.deepEqual(names(searchWasteInTypes(ranked, "zzz")), []);
  });
});

import { dedupeWasteInTypes as dd } from "./waste-in-type-order";
it("dedupes same name and EWC, keeping the selected one", () => {
  const r = dd([{ id: "a", waste_type: "Green Waste", ewc_code: "20 02 01" }, { id: "b", waste_type: "Green waste", ewc_code: "200201" }, { id: "c", waste_type: "Wood", ewc_code: "17 02 01" }], "b");
  assert.deepEqual(r.map(x => x.id), ["b", "c"]);
});

it("keeps the priced copy when the rate card lists a waste type twice", () => {
  const r = dd(
    [
      { id: "unpriced", waste_type: "Co-Mingled / DMR / Mixed Packaging", ewc_code: "15 01 06" },
      { id: "priced", waste_type: "Co-Mingled/DMR/Mixed Packaging", ewc_code: "15 01 06" },
    ],
    undefined,
    new Set(["priced"]),
  );
  assert.deepEqual(r.map(x => x.id), ["priced"]);
});
