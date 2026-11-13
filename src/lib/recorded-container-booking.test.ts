import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordedContainerBooking } from "./recorded-container-booking";

describe("recorded container to booking choice", () => {
  it("maps Ro Ro wording to the RORO sizes", () => {
    assert.deepEqual(recordedContainerBooking("40 yd Ro Ro"), { container_type: "Ro Ro", container_size: "40yd" });
    assert.deepEqual(recordedContainerBooking("40 Yard Roll on Roll off"), { container_type: "Ro Ro", container_size: "40yd" });
    assert.deepEqual(recordedContainerBooking("20yd Inc 3T Ro Ro"), { container_type: "Ro Ro", container_size: "20yd_roro" });
    assert.deepEqual(recordedContainerBooking("35 yard Compactor Ro Ro"), { container_type: "Ro Ro", container_size: "35yd_compactor" });
    assert.deepEqual(recordedContainerBooking("35 yd Enclosed Ro Ro"), { container_type: "Ro Ro", container_size: "35yd_enclosed" });
  });
  it("maps skip wording to the SKIP sizes", () => {
    assert.deepEqual(recordedContainerBooking(".8 yd Skip"), { container_type: "Skip", container_size: "8yd" });
    assert.deepEqual(recordedContainerBooking("12 Yard Enc"), { container_type: "Skip", container_size: "12yd_enclosed" });
    assert.deepEqual(recordedContainerBooking("16 Yard"), { container_type: "Skip", container_size: "14_16yd" });
    assert.deepEqual(recordedContainerBooking("12 yard"), { container_type: "Skip", container_size: "12yd" });
  });
  it("maps merged and bespoke wordings from the agreed standard", () => {
    assert.deepEqual(recordedContainerBooking("Bale Collection"), { container_type: "Artic", container_size: "curtain_bale" });
    assert.deepEqual(recordedContainerBooking("Palletised Material Service"), { container_type: "Artic", container_size: "curtain" });
    assert.deepEqual(recordedContainerBooking("Loose Material Service"), { container_type: "Artic", container_size: "curtain" });
    assert.deepEqual(recordedContainerBooking("14 Enclosed Skip"), { container_type: "Skip", container_size: "12yd_asbestos" });
    assert.deepEqual(recordedContainerBooking("14 Yard Walk In"), { container_type: "Skip", container_size: "14yd_walkin" });
    assert.deepEqual(recordedContainerBooking("Artic Walking Floor"), { container_type: "Artic", container_size: "walking_floor" });
  });
  it("never guesses a size it cannot price", () => {
    assert.deepEqual(recordedContainerBooking("30 yd Ro Ro"), { container_type: "Ro Ro", container_size: "" });
    assert.deepEqual(recordedContainerBooking("10 Yard"), { container_type: "Skip", container_size: "" });
    assert.deepEqual(recordedContainerBooking("660 litre Wheelie Bin"), { container_type: "660 litre Wheelie Bin", container_size: "" });
  });
});
