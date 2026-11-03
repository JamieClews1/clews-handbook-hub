import { describe, expect, it } from "bun:test";
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
    expect(wasteOutLoadsFor("Transfer Station Waste. Landfill")).toBe(155);
    expect(wasteOutLoadsFor("Wood C grade Outgoing")).toBe(153);
    expect(wasteOutLoadsFor("Never Seen Product")).toBeNull();
  });

  it("puts the five most common products first, busiest first", () => {
    expect(WASTE_OUT_TOP_N).toBe(5);
    expect(names(rankWasteOutProducts(products)).slice(0, 5)).toEqual([
      "Waste out – landfill",
      "Wood grade C",
      "RDF (waste to energy)",
      "Trommel fines",
      "Paper and card",
    ]);
  });

  it("lists everything after the top five alphabetically", () => {
    expect(names(rankWasteOutProducts(products)).slice(5)).toEqual([
      "Aluminium cans",
      "Cardboard",
      "Ferrous metal",
      "Green waste",
    ]);
  });

  it("never promotes a product the analysis has not seen", () => {
    const withNew = [...products, P("Aardvark waste", "Brand New Product", "99 99 99")];
    const ranked = rankWasteOutProducts(withNew);
    expect(ranked[0].display_name).toBe("Waste out – landfill");
    expect(names(ranked).slice(5)).toEqual([
      "Aardvark waste",
      "Aluminium cans",
      "Cardboard",
      "Ferrous metal",
      "Green waste",
    ]);
  });

  it("keeps the ranked order while searching", () => {
    const ranked = rankWasteOutProducts(products);
    expect(names(searchWasteOutProducts(ranked, "wood"))).toEqual(["Wood grade C"]);
    expect(names(searchWasteOutProducts(ranked, "191212"))).toEqual(["Trommel fines", "Waste out – landfill"]);
    expect(searchWasteOutProducts(ranked, "nothing matches")).toEqual([]);
    expect(searchWasteOutProducts(ranked, "  ")).toBe(ranked);
  });

  it("honours a smaller top count", () => {
    expect(names(rankWasteOutProducts(products, 2)).slice(0, 2)).toEqual([
      "Waste out – landfill",
      "Wood grade C",
    ]);
    expect(rankWasteOutProducts(products, 0).length).toBe(products.length);
  });
});
