import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChaseContacts, splitChaseContacts } from "./rental-chase-contacts";

const customers = [
  { id: "a", customer_name: "Select A Skip (UK) Ltd", po_notification_email: "po@selectaskip.co.uk", pod_email: "Accounts <po@selectaskip.co.uk>" },
  { id: "b", customer_name: "ERG Hygrade", po_notification_email: null, pod_email: "pod@erg.com" },
];
const contacts = [
  { customer_id: "a", full_name: "Old Contact", email: "old@selectaskip.co.uk", created_at: "2026-01-01" },
  { customer_id: "a", full_name: "Cerys Edwards", email: "Cerys.Edwards@selectaskip.co.uk", created_at: "2026-10-01" },
  { customer_id: "missing", full_name: "Ghost", email: "ghost@x.com", created_at: "2026-10-01" },
];

test("lists every address for the customer, newest contact first, without duplicates", () => {
  const { forCustomer } = splitChaseContacts(buildChaseContacts(customers, contacts), "a");
  assert.deepEqual(forCustomer.map((c) => c.email), [
    "cerys.edwards@selectaskip.co.uk",
    "old@selectaskip.co.uk",
    "po@selectaskip.co.uk",
  ]);
});

test("offers other customers' addresses separately and ignores unknown customers", () => {
  const { others } = splitChaseContacts(buildChaseContacts(customers, contacts), "a");
  assert.deepEqual(others.map((c) => c.email), ["pod@erg.com"]);
});
