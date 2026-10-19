import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRentalJobPages } from "./rental-job-loading";
import type { OverRentalJob } from "./overRental";

describe("rental job loading", () => {
  it("rejects a failed first page instead of returning an empty rental list", async () => {
    await assert.rejects(loadRentalJobPages(async () => ({ data: null, error: { message: "Network failure" } })), /Network failure/);
  });
  it("rejects incomplete lists when a later page fails", async () => {
    await assert.rejects(loadRentalJobPages(async from => from === 0
      ? { data: [{ id: "one" } as OverRentalJob], error: null }
      : { data: null, error: { message: "Page failed" } }, 1), /Page failed/);
  });
  it("returns all successful pages, including genuinely empty results", async () => {
    assert.deepEqual(await loadRentalJobPages(async from => ({ data: from === 0 ? [{ id: "one" } as OverRentalJob] : [], error: null }), 1), [{ id: "one" }]);
    assert.deepEqual(await loadRentalJobPages(async () => ({ data: [], error: null })), []);
  });
});