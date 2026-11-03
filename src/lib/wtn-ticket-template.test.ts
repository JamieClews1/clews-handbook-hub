import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WTN_TEMPLATE, renderWtnSheet, withTestMarker } from "./wtn-ticket-template";

const vars = { ticket_number: "WB000002", customer: "Test Co" };

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
