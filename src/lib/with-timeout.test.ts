import { describe, it, expect } from "bun:test";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve(5), 50)).resolves.toBe(5);
  });

  it("rejects when the promise never settles", async () => {
    await expect(withTimeout(new Promise(() => {}), 20, "Staff check")).rejects.toThrow("Staff check timed out");
  });
});
