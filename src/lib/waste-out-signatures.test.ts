import { test } from "node:test";
import assert from "node:assert/strict";
import { wasteOutProducerSignature } from "./waste-out-signatures";

test("Waste Out producer signature is the Clews weighbridge user's evidence, not disposal evidence", () => {
  const result = wasteOutProducerSignature({ operator_signature: "clews-signature", operator_name: "Clews Operator", first_weigh_at: "2026-11-04T16:43:00Z", disposer_signature: "site-signature", disposer_name: "Site Operator" });
  assert.deepEqual(result, { customer_signature: "clews-signature", customer_signoff_name: "Clews Operator", customer_signoff_at: "2026-11-04T16:43:00Z" });
  assert.equal("disposer_signature" in result, false);
});

test("An unsigned producer is not given a signing date", () => {
  assert.equal(wasteOutProducerSignature({ operator_name: "Clews Operator", first_weigh_at: "2026-11-04T16:43:00Z" }).customer_signoff_at, null);
});