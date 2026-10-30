import { test } from "node:test";
import assert from "node:assert/strict";
import { planTicketDeletion, ticketDeletionUnlinks } from "./weighone-ticket-delete";

test("A ticket already on an invoice cannot be deleted", () => {
  const plan = planTicketDeletion({ invoiceNumbers: ["INV-1042"] });
  assert.equal(plan.blocked, "This ticket is already on invoice INV-1042. Delete it from the invoice before deleting the ticket.");
  assert.deepEqual(plan.consequences, []);
});

test("Every invoice carrying the ticket is named in the warning", () => {
  const plan = planTicketDeletion({ invoiceNumbers: ["INV-1042", "INV-1099"] });
  assert.match(plan.blocked ?? "", /INV-1042, INV-1099/);
});

test("A plain ticket is deletable and warns about permanent loss", () => {
  const plan = planTicketDeletion({});
  assert.equal(plan.blocked, null);
  assert.deepEqual(plan.consequences, ["The ticket, its weights, extra charges and photos are deleted permanently."]);
});

test("Linked Route One and Banksman records are listed as detached, not deleted", () => {
  const plan = planTicketDeletion({ routeOneJobNumber: "RO-88", banksmanJobNumber: "BM-12" });
  assert.equal(plan.blocked, null);
  assert.equal(plan.consequences.length, 3);
  assert.match(plan.consequences[0], /Route One job RO-88 keeps its records, but the ticket link is removed\./);
  assert.match(plan.consequences[1], /Banksman report BM-12 keeps its records, but is detached from this ticket\./);
});

test("Only linked records are detached during deletion", () => {
  assert.deepEqual(ticketDeletionUnlinks({ routeOneJobNumber: "RO-88" }), { routeOneJob: true, banksmanJob: false });
  assert.deepEqual(ticketDeletionUnlinks({ banksmanJobNumber: "BM-12" }), { routeOneJob: false, banksmanJob: true });
  assert.deepEqual(ticketDeletionUnlinks({}), { routeOneJob: false, banksmanJob: false });
});
