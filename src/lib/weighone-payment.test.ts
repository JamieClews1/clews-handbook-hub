import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentPatch, paymentProblem, ticketPaymentLabel } from "./weighone-payment";

test("Paid card ticket shows amount inc VAT, method and card number", () =>
  assert.equal(ticketPaymentLabel({ payment_paid: true, payment_method: "card", payment_reference: "4512", total_price: 71.75 }), "PAID £86.10 – CARD 4512"));
test("Unpaid ticket shows the amount due", () =>
  assert.equal(ticketPaymentLabel({ payment_paid: false, payment_method: null, total_price: 100 }), "NOT PAID – £120.00 due"));
test("Account customers are invoiced later", () =>
  assert.equal(ticketPaymentLabel({ payment_paid: false, payment_method: "account", total_price: 100 }), "ON ACCOUNT – invoice to follow"));
test("Paid without a method is refused", () =>
  assert.equal(paymentProblem({ paid: true, method: "", reference: "" }), "Choose how it was paid"));
test("Card payment needs the card number", () =>
  assert.equal(paymentProblem({ paid: true, method: "card", reference: " " }), "Enter the card / cheque number"));
test("Cash payment needs no reference", () =>
  assert.equal(paymentProblem({ paid: true, method: "cash", reference: "" }), null));
test("Re-saving a paid ticket keeps the original paid time", () =>
  assert.equal(paymentPatch({ paid: true, method: "cash", reference: "" }, { payment_paid: true, payment_paid_at: "2026-11-13T10:00:00.000Z" }).payment_paid_at, "2026-11-13T10:00:00.000Z"));
