import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { midweighPrintVars, skiptrakWtnJob } from "./imported-ticket-print";
describe("Imported ticket print mapping", () => {
  it("converts Midweigh kilograms to tonnes without changing source weights", () => {
    const job = { weight_t: 7840, job_date: "2026-10-09", raw: { Gross: 24800, Tare: 16960 } };
    const vars = midweighPrintVars(job);
    assert.equal(vars.net_tonnes, "7.840"); assert.equal(vars.net_weight, "7,840"); assert.equal(job.weight_t, 7840);
  });
  it("keeps Skiptrak tonnes as tonnes", () => assert.equal(skiptrakWtnJob({ weight_t: 7.84 }).quantity, "7.84 t"));
  it("handles shifted Midweigh direction without treating it as a time", () => {
    const vars = midweighPrintVars({ raw: { "In / Out": "McNeil Construction", Time: "INWARD" } });
    assert.equal(vars.direction, "INWARD"); assert.equal(vars.time, "");
  });
  it("escapes imported text before rendering the print page", () => assert.equal(midweighPrintVars({ customer: "<script>" }).customer, "&lt;script&gt;"));
});