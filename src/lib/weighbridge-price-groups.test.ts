import { test } from "node:test";
import assert from "node:assert/strict";
import { groupWasteTypesForPricing } from "./weighbridge-price-groups";

const names = [
  "Plasterboard",
  "Wood – Packaging / Pallets A GRADE",
  "General Waste – Non-Recoverable (Landfill)",
  "Hardcore (Concrete, Bricks, Tiles & Ceramics)",
  "General Waste",
  "Mixed Packaging (Co-mingled / DMR)",
  "General Waste – Non-Recoverable (RDF)",
  "Something Unusual",
];
const rows = names.map((waste_type) => ({ waste_type }));

test("all General Waste prices sit together at the top", () => {
  const groups = groupWasteTypesForPricing(rows);
  assert.equal(groups[0].label, "General Waste");
  assert.deepEqual(groups[0].items.map((r) => r.waste_type), [
    "General Waste",
    "General Waste – Non-Recoverable (RDF)",
    "General Waste – Non-Recoverable (Landfill)",
  ]);
});

test("unrecognised waste types go in Other at the bottom", () => {
  const groups = groupWasteTypesForPricing(rows);
  const last = groups[groups.length - 1];
  assert.equal(last.label, "Other");
  assert.equal(last.items[0].waste_type, "Something Unusual");
});

test("no waste type is dropped", () => {
  const total = groupWasteTypesForPricing(rows).reduce((n, g) => n + g.items.length, 0);
  assert.equal(total, rows.length);
});
