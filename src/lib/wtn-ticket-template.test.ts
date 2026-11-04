import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WTN_TEMPLATE, renderWtnSheet, withTestMarker } from "./wtn-ticket-template";

const vars = { ticket_number: "WB000002", customer: "Test Co" };

test("Skip producer sign box reuses Route One evidence in both ticket copies", () => {
  const html = renderWtnSheet(DEFAULT_WTN_TEMPLATE, { direction: "INWARD", producer_signature: '<img class="sig" src="producer-evidence" /><div class="when">Signed 04/11/2026 17:00</div>', producer_signoff_name: "Site manager", operator_name: "Weighbridge user" });
  assert.equal(html.match(/src="producer-evidence"/g)?.length, 2);
  assert.equal(html.match(/<div class="name">Site manager<\/div>/g)?.length, 2);
  assert.equal(html.match(/Signed 04\/11\/2026 17:00/g)?.length, 2);
});

test("Waste Out still uses weighbridge operator for producer even when customer evidence exists", () => {
  const html = renderWtnSheet(DEFAULT_WTN_TEMPLATE, { direction: "OUTWARD", producer_signature: "wrong-customer-evidence", producer_signoff_name: "Customer", operator_signature: "clews-producer-evidence", operator_name: "Jamie" });
  assert.doesNotMatch(html, /wrong-customer-evidence/);
  assert.equal(html.match(/clews-producer-evidence/g)?.length, 2);
});

test("test-mode marker on printed tickets: stamps both copies when the ticket is a test", () => {
  const html = renderWtnSheet(DEFAULT_WTN_TEMPLATE, vars, "WTN WB000002", { testMode: true });
  assert.equal(html.match(/data-wtn-test/g).length, 2);
  assert.ok(html.includes("TEST TICKET — NOT A REAL WASTE TRANSFER NOTE"));
});

test("test-mode marker on printed tickets: leaves a real ticket untouched", () => {
  const html = renderWtnSheet(DEFAULT_WTN_TEMPLATE, vars, "WTN WB000003", { testMode: false });
  assert.ok(!html.includes("data-wtn-test"));
  assert.ok(!html.includes("TEST TICKET"));
});

test("test-mode marker on printed tickets: marks copies that are not the default wtn-copy markup", () => {
  assert.ok(withTestMarker("<section><p>x</p></section>", true).includes("data-wtn-test"));
  assert.equal(withTestMarker("<section><p>x</p></section>", false), "<section><p>x</p></section>");
});

test("prints producer, receiving and broker SIC codes; hides broker when none", async () => {
  const { renderWtnSheet, DEFAULT_WTN_TEMPLATE } = await import("./wtn-ticket-template");
  const withBroker = renderWtnSheet(DEFAULT_WTN_TEMPLATE, { producer_sic: "41100", receiving_sic: "38110", broker_name: "Acme Brokers", broker_sic: "46770" });
  assert.match(withBroker, /SIC: 41100/);
  assert.match(withBroker, /SIC: 38110/);
  assert.match(withBroker, /Acme Brokers/);
  assert.doesNotMatch(withBroker, /\[data-wtn-broker\] \{ display: none/);
  const noBroker = renderWtnSheet(DEFAULT_WTN_TEMPLATE, { producer_sic: "41100" });
  assert.match(noBroker, /\[data-wtn-broker\] \{ display: none/);
});
