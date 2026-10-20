import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planDay, resolveDriverId, sameDriverName } from "./route-planner";
import { DEFAULT_ROUTING_RULES } from "@/hooks/useRoutingRules";

describe("RouteOne driver name matching", () => {
  it("treats Skiptrak's Lee.Gane as the Lee Gane driver profile", () => {
    assert.equal(sameDriverName("Lee.Gane", "Lee Gane"), true);
    assert.equal(resolveDriverId("Lee.Gane", [{ id: "lee", name: "Lee Gane" }]), "lee");
  });
  it("counts Lee as working when his jobs say Lee.Gane", () => {
    const plan = planDay(
      [{ id: "1", source: "skiptrak", jobNumber: "1", movement: "Delivery", containerType: "40 yd Ro Ro", customer: "C", site: "S", postcode: "CV21 1AA", currentDriverId: null, currentDriverName: "Lee.Gane" }],
      [{ id: "lee", name: "Lee Gane", registration: "AB12CDE", vehicleType: "Ro Ro", category: "Ro Ro" }],
      { ...DEFAULT_ROUTING_RULES, travel_model: "fixed" },
    );
    assert.deepEqual(plan.drivers.map(d => d.driver.name), ["Lee Gane"]);
    assert.equal(plan.drivers[0].jobs[0].movedFrom, null);
  });
});