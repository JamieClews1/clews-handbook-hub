import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { combineTickets, ticketWeightTonnes, type CombinedTicket } from "./weighone-ticket-list";

const ticket = (source: CombinedTicket["source"], date: string): CombinedTicket => ({
  id: source, source, date, ticket: "86232", customer: null, site: null, vehicle: null,
  driver: null, waste: null, ewc: null, movement: null, status: null, weightTonnes: null,
});

describe("combined WeighOne tickets", () => {
  it("combines RouteOne and Midweigh even when ticket numbers match", () => {
    const result = combineTickets([ticket("routeone", "2026-10-08")], [ticket("midweigh", "2026-10-09")]);
    assert.deepEqual(result.map(row => row.source), ["midweigh", "routeone"]);
    assert.equal(result.length, 2);
  });
  it("converts Midweigh kilograms to tonnes", () => {
    assert.equal(ticketWeightTonnes(2780, "midweigh"), 2.78);
  });
  it("keeps RouteOne tonnage unchanged", () => {
    assert.equal(ticketWeightTonnes(2.78, "routeone"), 2.78);
    assert.equal(ticketWeightTonnes(2.78, "skiptrak"), 2.78);
  });
});