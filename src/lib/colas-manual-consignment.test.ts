import { it } from "node:test";
import assert from "node:assert/strict";
import { duplicateConsignmentJob, looksLikeQuickConsign, needsManualConsignment, normaliseConsignmentRef } from "./colas-manual-consignment";

it("tidies typed numbers", () => {
  assert.equal(normaliseConsignmentRef("  colasr / 00186 "), "COLASR/00186");
});
it("recognises QuickConsign format", () => {
  assert.equal(looksLikeQuickConsign("COLASR/00186"), true);
  assert.equal(looksLikeQuickConsign("186"), false);
});
it("lists jobs flagged unreadable or page missing with no number", () => {
  assert.equal(needsManualConsignment({ consignmentRef: null, consignmentIssue: "unreadable" }, null), true);
  assert.equal(needsManualConsignment({ consignmentRef: null, consignmentIssue: "page_missing" }, "not_present"), true);
});
it("lists jobs whose latest reader attempt found nothing", () => {
  assert.equal(needsManualConsignment({ consignmentRef: null, consignmentIssue: null }, "unreadable"), true);
});
it("drops jobs once a number is saved", () => {
  assert.equal(needsManualConsignment({ consignmentRef: "COLASR/00185", consignmentIssue: null }, "unreadable"), false);
});
it("ignores jobs the reader never tried and nobody flagged", () => {
  assert.equal(needsManualConsignment({ consignmentRef: null, consignmentIssue: null }, null), false);
});
it("refuses a number already used on another job", () => {
  const saved = new Map<string, string | null>([["51354", "COLASR/00185"], ["49134", null]]);
  assert.equal(duplicateConsignmentJob("colasr/00185", "49134", saved), "51354");
  assert.equal(duplicateConsignmentJob("COLASR/00185", "51354", saved), null);
});
