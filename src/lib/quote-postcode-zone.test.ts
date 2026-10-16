import { it } from "node:test";
import assert from "node:assert/strict";
import { matchQuotePostcodeZone } from "./quote-postcode-zone";

const zones = [
  { zone_name: "Zone 1", postcodes: ["CV21 1", "CV21 2", "CV21 3", "CV21 4", "CV22 7"] },
  { zone_name: "Zone 3", postcodes: ["CV34 5"] },
];

it("CV21 7DT is unmatched rather than priced in Zone 3", () => {
  assert.equal(matchQuotePostcodeZone("CV21 7DT", zones), null);
});

it("configured Rugby postcodes match Zone 1 with or without spaces", () => {
  assert.equal(matchQuotePostcodeZone("cv213dt", zones), "Zone 1");
  assert.equal(matchQuotePostcodeZone("CV22 7DT", zones), "Zone 1");
});

it("a specific sector overrides a broader district", () => {
  assert.equal(matchQuotePostcodeZone("CV21 3DT", [
    { zone_name: "Zone 3", postcodes: ["CV21"] }, ...zones,
  ]), "Zone 1");
});