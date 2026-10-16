import { it } from "node:test";
import assert from "node:assert/strict";
import { matchMatrixPostcode, parsePostcodeParts } from "./matrix-postcode-zone";

const row = (postcode_prefix: string, zone_code: string, area: string | null = null) => ({ postcode_prefix, zone_code, area });
const matrix = [
  row("CV21", "Zone 1", "All CV21"),
  row("CV21 1", "Zone 1"),
  row("CV22 7", "Zone 1"),
  row("CV23 0", "Zone 1"),
  row("CV23 8", "Zone 1"),
  row("CV23 9", "Zone 1"),
  row("CV2 1", "Zone 2"),
  row("CV34 5", "Zone 3"),
  row("NN6 7", "Zone 1", "Crick (DIRFT) only"),
  row("NN6 7", "Zone 3", "Non Crick"),
  row("NN5 4", "Zone 3 RoRo Only"),
];

it("CV23 sectors on the matrix are Zone 1", () => {
  for (const pc of ["CV23 0AB", "CV23 8AB", "CV239AB"]) {
    assert.equal(matchMatrixPostcode(pc, matrix).zone, "Zone 1");
  }
});

it("CV23 sectors not on the matrix are not priced (never Zone 3)", () => {
  const m = matchMatrixPostcode("CV23 7DT", matrix);
  assert.equal(m.status, "none");
  assert.equal(m.zone, null);
});

it("postcodes outside the matrix are not priced", () => {
  assert.equal(matchMatrixPostcode("AB12 3DT", matrix).status, "none");
  assert.equal(matchMatrixPostcode("B91 2AA", matrix).status, "none");
});

it("all CV21 postcodes are Zone 1, including CV21 7DT", () => {
  assert.equal(matchMatrixPostcode("CV21 7DT", matrix).zone, "Zone 1");
});

it("CV2 1 is Zone 2 and is not confused with CV21", () => {
  assert.equal(matchMatrixPostcode("CV2 1AB", matrix).zone, "Zone 2");
  assert.deepEqual(parsePostcodeParts("CV21AB"), { outward: "CV2", sector: "1", inward: "AB" });
});

it("a sector split between zones needs staff to choose", () => {
  const m = matchMatrixPostcode("NN6 7AB", matrix);
  assert.equal(m.status, "ambiguous");
  assert.equal(m.matches.length, 2);
});

it("sector-only postcodes match", () => {
  assert.equal(matchMatrixPostcode("NN5 4", matrix).zone, "Zone 3 RoRo Only");
  assert.equal(matchMatrixPostcode("cv34 5", matrix).zone, "Zone 3");
});
