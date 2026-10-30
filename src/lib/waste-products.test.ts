import { test } from "node:test";
import assert from "node:assert/strict";
import { findProduct, filterProducts, type WasteProduct } from "./waste-products";

const p = (recorded_name: string, ewc_code: string, status: WasteProduct["status"] = "active"): WasteProduct =>
  ({ id: recorded_name, recorded_name, display_name: recorded_name, ewc_code, status, notes: null });
const list = [p("Transfer Station Waste. Landfill", "19 12 12"), p("WEEE", "20 01 35", "needs_review")];

test("ticket product text matches regardless of punctuation and case", () => {
  assert.equal(findProduct(list, "transfer station waste landfill")?.ewc_code, "19 12 12");
});
test("unknown products are not guessed", () => assert.equal(findProduct(list, "Glass"), null));
test("status filter shows only items needing review", () => {
  assert.deepEqual(filterProducts(list, "", "needs_review").map(x => x.recorded_name), ["WEEE"]);
});
test("search matches waste code", () => assert.equal(filterProducts(list, "20 01 35", "all").length, 1));