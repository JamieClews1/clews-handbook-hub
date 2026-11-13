import { test } from "node:test";
import assert from "node:assert/strict";
import {
  containerChipLabel,
  INBOUND_CONTAINER_GROUPS,
  isPickedContainer,
} from "./weighone-container-groups";

test("Waste In and Skip offer Van, FEL and Pickup first", () => {
  assert.deepEqual(
    INBOUND_CONTAINER_GROUPS.map(g => g.vehicle),
    ["Van", "FEL", "Pickup", "Skip", "Ro Ro", "Artic"],
  );
});

test("Van, FEL and Pickup store their own name as the container", () => {
  assert.deepEqual(INBOUND_CONTAINER_GROUPS.slice(0, 3).map(g => g.options), [["Van"], ["FEL"], ["Pickup"]]);
});

test("Skip, Ro Ro and Artic keep the shared sizes", () => {
  const skip = INBOUND_CONTAINER_GROUPS.find(g => g.vehicle === "Skip")!;
  assert.equal(skip.options.length, 7);
  assert.ok(skip.options.includes("SKIP · 12 yd ENC Asbestos"));
  assert.ok(skip.options.includes("SKIP · 8 yd"));
  assert.ok(INBOUND_CONTAINER_GROUPS.find(g => g.vehicle === "Ro Ro")!.options.includes("RORO · 35 yd Enclosed"));
  assert.ok(INBOUND_CONTAINER_GROUPS.find(g => g.vehicle === "Artic")!.options.includes("ARTIC · Walking Floor"));
});

test("chip text drops the group prefix", () => {
  assert.equal(containerChipLabel("SKIP · 8 yd"), "8 yd");
  assert.equal(containerChipLabel("Van"), "Van");
});

test("only picker values keep Other vehicle type closed", () => {
  assert.equal(isPickedContainer("Van"), true);
  assert.equal(isPickedContainer("SKIP · 8 yd"), true);
  assert.equal(isPickedContainer("Skip"), false);
  assert.equal(isPickedContainer(""), false);
  assert.equal(isPickedContainer(null), false);
});
