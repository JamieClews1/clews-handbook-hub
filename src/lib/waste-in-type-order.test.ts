import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rankWasteInTypes,
  searchWasteInTypes,
  wasteInLoadsFor,
  WASTE_IN_TOP_N,
} from "./waste-in-type-order";

const T = (waste_type: string, ewc_code: string) => ({ id: waste_type, waste_type, ewc_code });

/** Real names from the weighbridge rate card; loads come from the Midweigh inbound analysis. */
const types = [
  T("Mixed Municipal Waste", "20 03 01"),
  T("Low Grade Wood (Grade C)", "17 02 01"),
  T("Cardboard & Paper Packaging", "15 01 01"),
  T("Clean Wood (Grade A - pallets only)", "15 01 03"),
  T("POPs (per tonne)", "20 03 07"),
  T("Green Waste", "20 02 01"),
  T("WEEE", "20 01 35"),
  T("Hardcore (bricks, slate, ceramics, glass)", "17 01 07"),
  T("Mixed Construction & Demolition", "17 09 04"),
  T("General Waste", "20 03 01"),
  T("Co-Mingled / DMR / Mixed Packaging", "15 01 06"),
  T("Plasterboard", "17 08 02"),
  T("Textiles", "20 01 11"),
  T("Aardvark waste", "99 99 99"),
];

const names = (list: { waste_type: string }[]) => list.map(t => t.waste_type);

describe("waste in picker order", () => {
  it("shows ten most common types at the top", () => {
    assert.equal(WASTE_IN_TOP_N, 10);
  });

  it("reads inbound loads for a waste type name", () => {
    assert.equal(wasteInLoadsFor("Mixed Municipal Waste"), 3800);
    assert.equal(wasteInLoadsFor("Low Grade Wood (Grade C)"), 640);
    assert.equal(wasteInLoadsFor("Never Seen Product"), null);
  });

  it("puts the ten busiest inbound types first, busiest first", () => {
    assert.deepEqual(names(rankWasteInTypes(types)).slice(0, 10), [
      "Mixed Municipal Waste",
      "Low Grade Wood (Grade C)",
      "Cardboard & Paper Packaging",
      "Clean Wood (Grade A - pallets only)",
      "POPs (per tonne)",
      "Green Waste",
      "WEEE",
      "Hardcore (bricks, slate, ceramics, glass)",
      "Mixed Construction & Demolition",
      "General Waste",
    ]);
  });

  it("lists everything after the top ten alphabetically", () => {
    assert.deepEqual(names(rankWasteInTypes(types)).slice(10), [
      "Aardvark waste",
      "Co-Mingled / DMR / Mixed Packaging",
      "Plasterboard",
      "Textiles",
    ]);
  });

  it("never promotes a type the analysis has not seen", () => {
    const ranked = rankWasteInTypes([T("Aardvark waste", "99 99 99"), ...types]);
    assert.equal(ranked[0].waste_type, "Mixed Municipal Waste");
    assert.ok(!ranked.slice(0, WASTE_IN_TOP_N).some(t => t.waste_type === "Aardvark waste"));
  });

  it("searches by name or code without reordering", () => {
    const ranked = rankWasteInTypes(types);
    assert.deepEqual(names(searchWasteInTypes(ranked, "wood")), [
      "Low Grade Wood (Grade C)",
      "Clean Wood (Grade A - pallets only)",
    ]);
    assert.deepEqual(names(searchWasteInTypes(ranked, "20 02 01")), ["Green Waste"]);
    assert.deepEqual(names(searchWasteInTypes(ranked, "")), names(ranked));
    assert.deepEqual(names(searchWasteInTypes(ranked, "zzz")), []);
  });
});

import { dedupeWasteInTypes as dd } from "./waste-in-type-order";
import { test as t2, expect as e2 } from "vitest";
t2("dedupes same name and EWC, keeping the selected one", () => {
  const r = dd([{ id: "a", waste_type: "Green Waste", ewc_code: "20 02 01" }, { id: "b", waste_type: "Green waste", ewc_code: "200201" }, { id: "c", waste_type: "Wood", ewc_code: "17 02 01" }], "b");
  e2(r.map(x => x.id)).toEqual(["b", "c"]);
});
