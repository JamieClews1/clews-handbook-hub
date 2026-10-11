import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dailyBoardVehicle, groupDriversByVehicle, useDriverAccordion, vehicleKind, VISIBLE_DRIVER_COLUMNS } from "./route-one-vehicle-groups";

describe("RouteOne daily driver presentation", () => {
  it("recognises Jaroslaw's Monday artic despite the saved Skip type", () => {
    assert.equal(dailyBoardVehicle([{ registration: "FJ18FDM", containerType: "Curtain side Trailer" }], { registration: "FJ18FDM", vehicle_type: "Skip" }, [], ["FJ18 FDM"]).type, "Artic");
  });
  it("places Lee in Monday's RoRo rather than his usual artic", () => {
    const result = dailyBoardVehicle([{ registration: "BF67OPZ", containerType: "40 yd Ro Ro" }], { registration: "FG61 SYV", vehicle_type: "Artic" }, [{ registration: "BF67 OPZ", vehicle_type: "Skip" }], ["FG61 SYV"]);
    assert.equal(result.type, "Ro Ro");
    assert.equal(result.registration, "BF67OPZ");
  });
  it("falls back to the usual vehicle only when the day has no registration", () => {
    assert.equal(dailyBoardVehicle([], { registration: "FG61 SYV", vehicle_type: "Artic" }, [], ["FG61 SYV"]).type, "Artic");
  });
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