import { test } from "node:test";
import assert from "node:assert/strict";
import { recogniseContainer, taxonomyContainer, WASTE_OUT_CONTAINERS } from "./weighone-waste-out";

test("Waste Out offers Skip, Ro Ro and Artic containers", () => {
  assert.deepEqual(WASTE_OUT_CONTAINERS.map(g => g.vehicle), ["Skip", "Ro Ro", "Artic"]);
  assert.ok(WASTE_OUT_CONTAINERS[2].options.includes("ARTIC · Walking Floor"));
});

test("FG61SYV history recognises an artic walking floor", () => {
  const history = [...Array(5).fill("Artic Walking Floor"), "Curtain side Trailer", null, "Artic ejector"];
  assert.deepEqual(recogniseContainer(history), { container: "ARTIC · Walking Floor", vehicle: "Artic" });
});

test("skip and roro descriptions map onto the shared sizes", () => {
  assert.equal(taxonomyContainer("8 yard skip"), "SKIP · 8 yd");
  assert.equal(taxonomyContainer("RoRo 40yd"), "RORO · 35 / 40 yd");
  assert.equal(recogniseContainer([null, "unknown"]), null);
});
