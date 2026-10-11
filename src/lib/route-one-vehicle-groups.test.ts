import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupDriversByVehicle, useDriverAccordion, vehicleKind, VISIBLE_DRIVER_COLUMNS } from "./route-one-vehicle-groups";

describe("RouteOne daily driver presentation", () => {
  it("sets the visible driver limit to six", () => assert.equal(VISIBLE_DRIVER_COLUMNS, 6));
  it("uses accordion groups only above eight drivers", () => {
    assert.equal(useDriverAccordion(8), false);
    assert.equal(useDriverAccordion(9), true);
    assert.equal(useDriverAccordion(12), true);
  });
  it("groups each day's drivers by vehicle type preserving their order", () => {
    const drivers = [{ id: 1, type: "Artic" }, { id: 2, type: "Skip Loader" }, { id: 3, type: "Artic" }];
    assert.deepEqual(groupDriversByVehicle(drivers, d => d.type).map(g => [g.type, g.drivers.map(d => d.id)]), [["Skip Loader", [2]], ["Artic", [1, 3]]]);
    assert.deepEqual(groupDriversByVehicle(drivers.slice(0, 1), d => d.type).map(g => g.type), ["Artic"]);
  });
  it("normalises RoRo and unknown vehicles without omitting a driver", () => {
    assert.equal(vehicleKind("Ro-Ro"), "Ro Ro");
    assert.equal(vehicleKind(null), "Other");
  });
});