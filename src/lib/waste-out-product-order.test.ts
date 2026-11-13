import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rankWasteOutProducts,
  searchWasteOutProducts,
  wasteOutLoadsFor,
  WASTE_OUT_TOP_N,
} from "./waste-out-product-order";

const P = (display_name: string, recorded_name: string, ewc_code: string) =>
  ({ id: display_name, display_name, recorded_name, ewc_code, status: "active" });

const products = [
  P("Aluminium cans", "Aluminium Cans", "15 01 04"),
  P("Cardboard", "Cardboard", "15 01 01"),
  P("Paper and card", "Paper and Card", "19 12 01"),
  P("Trommel fines", "Qualifying Trommel Fines", "19 12 12"),
  P("RDF (waste to energy)", "(Waste to Energy) RDF", "19 12 10"),
  P("Wood grade C", "Wood C grade Outgoing", "19 12 07"),
  P("Waste out – landfill", "Transfer Station Waste. Landfill", "19 12 12"),
  P("Ferrous metal", "Ferrous Metals", "19 12 02"),
  P("Green waste", "Green Waste/Biodegradable Waste", "20 02 01"),
];

const names = (list: { display_name: string }[]) => list.map(p => p.display_name);

describe("waste out product picker order", () => {
  it("reads recorded loads for a product name", () => {
    assert.equal(wasteOutLoadsFor("Transfer Station Waste. Landfill"), 155);
    assert.equal(wasteOutLoadsFor("Wood C grade Outgoing"), 153);
    assert.equal(wasteOutLoadsFor("Never Seen Product"), null);
  });

  it("puts the five most common products first, busiest first", () => {
    assert.equal(WASTE_OUT_TOP_N, 10);
    assert.deepEqual(names(rankWasteOutProducts(products, 5)).slice(0, 5), [
      "Waste out – landfill",
      "Wood grade C",
      "RDF (waste to energy)",
      "Trommel fines",
      "Paper and card",
    ]);
  });

  it("lists everything after the top five alphabetically", () => {
    assert.deepEqual(names(rankWasteOutProducts(products, 5)).slice(5), [
      "Aluminium cans",
      "Cardboard",
      "Ferrous metal",
      "Green waste",
    ]);
  });

  it("never promotes a product the analysis has not seen", () => {
    const withNew = [...products, P("Aardvark waste", "Brand New Product", "99 99 99")];
    const ranked = rankWasteOutProducts(withNew, 5);
    assert.equal(ranked[0].display_name, "Waste out – landfill");
    assert.deepEqual(names(ranked).slice(5), [
      "Aardvark waste",
      "Aluminium cans",
      "Cardboard",
      "Ferrous metal",
      "Green waste",
    ]);
  });

  it("keeps the ranked order while searching", () => {
    const ranked = rankWasteOutProducts(products, 5);
    assert.deepEqual(names(searchWasteOutProducts(ranked, "wood")), ["Wood grade C"]);
    assert.deepEqual(names(searchWasteOutProducts(ranked, "191212")), ["Waste out – landfill", "Trommel fines"]);
    assert.deepEqual(searchWasteOutProducts(ranked, "nothing matches"), []);
    assert.equal(searchWasteOutProducts(ranked, "  "), ranked);
  });

  it("honours a smaller top count", () => {
    assert.deepEqual(names(rankWasteOutProducts(products, 2)).slice(0, 2), [
      "Waste out – landfill",
      "Wood grade C",
    ]);
    assert.equal(rankWasteOutProducts(products, 0).length, products.length);
  });
});

import { dedupeWasteOutProducts } from "./waste-out-product-order";
import { test as t2 } from "node:test";
t2("shows one Waste Out entry per standard name, keeping the selected one", () => {
  const list = [
    { id: "a", recorded_name: "Paper and Card", display_name: "Paper & Card – Out", ewc_code: "19 12 01" },
    { id: "b", recorded_name: "Mixed Papers", display_name: "Paper & Card – Out", ewc_code: "19 12 01" },
    { id: "c", recorded_name: "Car Tyres", display_name: "Tyres – Out", ewc_code: "19 12 04" },
  ];
  assert.equal(dedupeWasteOutProducts(list).length, 2);
  assert.deepEqual(dedupeWasteOutProducts(list, "b").map((p) => p.id).sort(), ["b", "c"]);
});
