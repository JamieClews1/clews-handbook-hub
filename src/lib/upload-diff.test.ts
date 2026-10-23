import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rowNeedsWrite } from "./upload-diff";

describe("rowNeedsWrite", () => {
  const stored = {
    id: "x",
    job_number: "51399",
    source: "skiptrak",
    weight_t: 3.22,
    customer: "Papilo",
    site: null,
    raw: { Ticket: "51399", Price: "120.00", Customer: "Papilo" },
    updated_at: "2026-10-23T10:00:00Z",
  };

  it("skips a re-uploaded row that has not changed", () => {
    assert.equal(
      rowNeedsWrite(
        { job_number: "51399", source: "skiptrak", weight_t: 3.22, customer: "Papilo", site: undefined, raw: { Customer: "Papilo", Ticket: "51399", Price: "120.00" } },
        stored,
      ),
    , false);
  });

  it("writes a row whose weight changed", () => {
    assert.equal(rowNeedsWrite({ job_number: "51399", source: "skiptrak", weight_t: 3.5, raw: stored.raw }, stored), true);
  });

  it("writes a row whose spreadsheet values changed", () => {
    assert.equal(rowNeedsWrite({ job_number: "51399", raw: { ...stored.raw, Price: "150.00" } }, stored), true);
  });

  it("writes a brand new row", () => {
    assert.equal(rowNeedsWrite({ job_number: "60000", source: "skiptrak", raw: {} }, undefined), true);
  });
});
