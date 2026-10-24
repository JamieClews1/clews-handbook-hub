import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ROUTING_RULES } from "@/hooks/useRoutingRules";
import { estimateDriverDay } from "./driver-day-estimate";

const rules = { ...DEFAULT_ROUTING_RULES, yard_postcode: "YARD", speed_bands_enabled: false, avg_speed_mph: 30, road_distance_factor: 1, mins_travel_min: 0 };
const ctx = { coords: new Map([["YARD", { lat: 52, lng: -1 }], ["SITEA", { lat: 52.1, lng: -1 }], ["SITEB", { lat: 52.2, lng: -1 }]]) };
describe("Driver day time estimate", () => {
  it("has a 10-hour day including 45 minutes break, leaving 555 working minutes", () => {
    const result = estimateDriverDay([{ postcode: "SITEA", movement: "delivery" }], rules, ctx);
    assert.equal(result.limitMinutes, 600);
    assert.equal(result.breakMinutes, 45);
    assert.equal(result.limitMinutes - result.breakMinutes, 555);
    assert.equal(result.totalMinutes, result.travelMinutes + result.handlingMinutes + 45);
  });
  it("includes outbound and final return postcode journeys", () => {
    const result = estimateDriverDay([{ postcode: "SITEA", movement: "delivery" }], rules, ctx);
    assert.equal(result.legs, 2);
    assert.equal(result.travelMinutes, 28);
    assert.equal(result.handlingMinutes, 20);
    assert.equal(result.totalMinutes, 93);
  });
  it("nearby and distant jobs have different day estimates regardless of job count", () => {
    const a = estimateDriverDay([{ postcode: "SITEA", movement: "delivery" }], rules, ctx);
    const b = estimateDriverDay([{ postcode: "SITEB", movement: "delivery" }], rules, ctx);
    assert.equal(b.travelMinutes, 56);
    assert.ok(b.totalMinutes > a.totalMinutes);
  });
  it("loaded collections return to the yard before the next job, adding tipping", () => {
    const result = estimateDriverDay([{ postcode: "SITEA", movement: "collect" }, { postcode: "SITEB", movement: "delivery" }], rules, ctx);
    assert.equal(result.legs, 4);
    assert.equal(result.travelMinutes, 84);
    assert.equal(result.handlingMinutes, 65);
  });
  it("flags missing postcode travel as fallback without omitting the leg", () => {
    const result = estimateDriverDay([{ postcode: "", movement: "delivery" }], rules, ctx);
    assert.equal(result.fallbackLegs, 2);
    assert.equal(result.travelMinutes, 50);
  });
});