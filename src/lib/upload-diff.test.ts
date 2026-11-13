import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { keepCorrectedWaste, rowNeedsWrite } from "./upload-diff";

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
      false,
    );
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

test("a portal-corrected EWC survives re-uploading the old export", () => {
  const incoming = { job_number: "44484", ewc: "17 01 06", waste_description: "Cement Bonded Asbestos", weight_t: 1.2 };
  const existing = { job_number: "44484", ewc: "17 06 05*", waste_description: "Asbestos (Cement-Bonded)", weight_t: 1.2, waste_corrected_at: "2026-11-13T10:30:00Z" };
  const merged = keepCorrectedWaste(incoming, existing);
  assert.equal(merged.ewc, "17 06 05*");
  assert.equal(merged.waste_description, "Asbestos (Cement-Bonded)");
  assert.equal(rowNeedsWrite(merged, existing), false);
});

test("uncorrected jobs still take the export's EWC", () => {
  const merged = keepCorrectedWaste({ ewc: "20 03 01", waste_description: "Mixed Municipal Waste" }, { ewc: "17 09 04", waste_description: "x", waste_corrected_at: null });
  assert.equal(merged.ewc, "20 03 01");
});
