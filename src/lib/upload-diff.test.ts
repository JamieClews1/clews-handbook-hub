import { describe, expect, it } from "bun:test";
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
    expect(
      rowNeedsWrite(
        { job_number: "51399", source: "skiptrak", weight_t: 3.22, customer: "Papilo", site: undefined, raw: { Customer: "Papilo", Ticket: "51399", Price: "120.00" } },
        stored,
      ),
    ).toBe(false);
  });

  it("writes a row whose weight changed", () => {
    expect(rowNeedsWrite({ job_number: "51399", source: "skiptrak", weight_t: 3.5, raw: stored.raw }, stored)).toBe(true);
  });

  it("writes a row whose spreadsheet values changed", () => {
    expect(rowNeedsWrite({ job_number: "51399", raw: { ...stored.raw, Price: "150.00" } }, stored)).toBe(true);
  });

  it("writes a brand new row", () => {
    expect(rowNeedsWrite({ job_number: "60000", source: "skiptrak", raw: {} }, undefined)).toBe(true);
  });
});
