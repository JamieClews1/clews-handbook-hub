import { describe, expect, it } from "bun:test";
import { combineTickets, ticketWeightTonnes, type CombinedTicket } from "./weighone-ticket-list";

const ticket = (source: CombinedTicket["source"], date: string): CombinedTicket => ({
  id: source, source, date, ticket: "86232", customer: null, site: null, vehicle: null,
  driver: null, waste: null, ewc: null, movement: null, status: null, weightTonnes: null,
});

describe("combined WeighOne tickets", () => {
  it("combines RouteOne and Midweigh even when ticket numbers match", () => {
    const result = combineTickets([ticket("routeone", "2026-10-08")], [ticket("midweigh", "2026-10-09")]);
    expect(result.map(row => row.source)).toEqual(["midweigh", "routeone"]);
    expect(result).toHaveLength(2);
  });
  it("converts Midweigh kilograms to tonnes", () => {
    expect(ticketWeightTonnes(2780, "midweigh")).toBe(2.78);
  });
  it("keeps RouteOne tonnage unchanged", () => {
    expect(ticketWeightTonnes(2.78, "routeone")).toBe(2.78);
    expect(ticketWeightTonnes(2.78, "skiptrak")).toBe(2.78);
  });
});