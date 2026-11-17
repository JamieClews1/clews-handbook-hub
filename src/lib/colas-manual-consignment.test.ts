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

import { planConsignmentMove } from "./colas-manual-consignment";
const known = new Set(["50650", "50653", "49134"]);
it("moves a number typed on the wrong job and re-flags the original job", () => {
  const saved = new Map<string, string | null>([["50653", "COLASR/00178"], ["49134", null]]);
  const plan = planConsignmentMove({ fromJob: "50653", toJob: "49134", ref: "COLASR/00178", restoreIssue: "unreadable", saved, knownJobs: known });
  assert.ok(!("error" in plan));
  assert.equal(plan.setTo.job_number, "49134");
  assert.equal(plan.setTo.consignment_ref, "COLASR/00178");
  assert.equal(plan.setTo.read_issue, null);
  assert.equal(plan.clearFrom.consignment_ref, null);
  assert.equal(plan.clearFrom.read_issue, "unreadable");
});
it("refuses to move onto a job that already has a different number", () => {
  const saved = new Map<string, string | null>([["50653", "COLASR/00178"], ["50650", "COLASR/00173"]]);
  const plan = planConsignmentMove({ fromJob: "50653", toJob: "50650", ref: "COLASR/00178", restoreIssue: null, saved, knownJobs: known });
  assert.ok("error" in plan);
});
it("refuses a job that isn't a hazardous Colas Rail job", () => {
  const plan = planConsignmentMove({ fromJob: "50653", toJob: "99999", ref: "COLASR/00178", restoreIssue: null, saved: new Map([["50653", "COLASR/00178"]]), knownJobs: known });
  assert.ok("error" in plan);
});
it("refuses when the number is also on a third job", () => {
  const saved = new Map<string, string | null>([["50653", "COLASR/00178"], ["50650", "COLASR/00178"]]);
  const plan = planConsignmentMove({ fromJob: "50653", toJob: "49134", ref: "COLASR/00178", restoreIssue: null, saved, knownJobs: known });
  assert.ok("error" in plan);
});
