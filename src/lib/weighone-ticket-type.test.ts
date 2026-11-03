import { test } from "node:test";
import assert from "node:assert/strict";
import { ticketTypeCode } from "./weighone-ticket-type";

test("waste in tickets show IN", () => {
  assert.equal(ticketTypeCode("waste_in")?.code, "IN");
});

test("waste out tickets show OUT", () => {
  assert.equal(ticketTypeCode("waste_out")?.code, "OUT");
});

test("skip tickets show SKIP", () => {
  assert.equal(ticketTypeCode("skip")?.code, "SKIP");
});

test("unknown or missing job types show no code", () => {
  assert.equal(ticketTypeCode("mystery"), undefined);
  assert.equal(ticketTypeCode(null), undefined);
  assert.equal(ticketTypeCode(undefined), undefined);
});
