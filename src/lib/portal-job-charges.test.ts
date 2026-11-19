import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jobCharges } from "./portal-job-charges";

describe("customer portal waste charge", () => {
  it("is total cost minus haulage minus added cost (job 52080)", () => {
    assert.equal(jobCharges({ Cost: 1097.95, "Haulage Cost": 130, "Added Cost": 4.95 }).waste, 963);
  });
  it("treats a blank haulage cost as no haulage", () => {
    assert.equal(jobCharges({ Cost: 651, "Added Cost": 0 }).waste, 651);
  });
  it("is not worked out when the job has no Added Cost yet", () => {
    assert.equal(jobCharges({ Cost: 305, "Haulage Cost": 110 }).waste, null);
  });
});
