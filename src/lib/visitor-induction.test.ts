import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inductionValidUntil, isInductionCurrent, matchCompanyAccount, normaliseCompanyName } from "./visitor-induction";

describe("visitor induction validity", () => {
  it("is valid for 12 months from signing", () => {
    assert.equal(inductionValidUntil("2026-11-12T10:00:00Z").toISOString().slice(0, 10), "2027-11-12");
  });
  it("expires after 12 months", () => {
    assert.equal(isInductionCurrent("2025-11-01T10:00:00Z", new Date("2026-11-12T10:00:00Z")), false);
    assert.equal(isInductionCurrent("2026-01-01T10:00:00Z", new Date("2026-11-12T10:00:00Z")), true);
  });
});

describe("company matching", () => {
  const accounts = [
    { id: "1", customer_name: "Biffa Waste Services Ltd" },
    { id: "2", customer_name: "Smith & Sons" },
    { id: "3", customer_name: "Smith and Sons Limited" },
  ];
  it("ignores Ltd, punctuation and case", () => {
    assert.equal(normaliseCompanyName("BIFFA Waste Services Limited."), "biffa waste services");
    assert.equal(matchCompanyAccount("biffa waste services", accounts)?.id, "1");
  });
  it("does not guess when two accounts match", () => {
    assert.equal(matchCompanyAccount("Smith and Sons", accounts), null);
  });
  it("returns null for unknown companies", () => {
    assert.equal(matchCompanyAccount("Unknown Haulage", accounts), null);
  });
});
