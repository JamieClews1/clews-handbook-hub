import { test } from "node:test";
import assert from "node:assert/strict";
import { bestStockType } from "./stock-check-matching";
const types = [
  {id:"12",name:"12yd",data_hub_keywords:["12 Yard"]},
  {id:"enc",name:"12yd Enclosed",data_hub_keywords:["12 Yard Enc"]},
  {id:"40",name:"35/40yd",data_hub_keywords:["40 Yard"]},
];
test("live Yard, total stock jobs and inventory profiles use the same size", () => {
  for (const value of ["12 yd enclosed", "12 Yard Enc", "12 CU YD ENCLOSED"]) assert.equal(bestStockType(value,types)?.id,"enc");
  for (const value of ["40 Yard Ro Ro", "40yd", "40 CU YD"]) assert.equal(bestStockType(value,types)?.id,"40");
});
test("type names are a fallback and different sizes cannot partially match", () => {
  assert.equal(bestStockType("35/40yd",types)?.id,"40");
  assert.equal(bestStockType("112 Yard",types),null);
});