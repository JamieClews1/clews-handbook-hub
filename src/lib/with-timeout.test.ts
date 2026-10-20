import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    assert.equal(await withTimeout(Promise.resolve(5), 50), 5);
  });

  it("rejects when the promise never settles", async () => {
    await assert.rejects(withTimeout(new Promise(() => {}), 20, "Staff check"), /Staff check timed out/);
  });
});
