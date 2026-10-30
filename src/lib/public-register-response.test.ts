import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { normaliseResponse } from "./public-register-response";

describe("public register response", () => {
  it("keeps a carrier returned with the API business_name field", () => {
    const result = normaliseResponse({
      records: [{ business_name: "SHAW-HAUL-CLEARS ALL LTD", registration_number: "CBDU627697", postcode: "CV23 9QU" }],
      page: 1, total_pages: 1, attribution: "Environment Agency",
    });
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0]?.name, "SHAW-HAUL-CLEARS ALL LTD");
    assert.equal(result.records[0]?.registrationNumber, "CBDU627697");
    assert.equal(result.records[0]?.postcode, "CV23 9QU");
    assert.equal(result.attribution, "Environment Agency");
  });

  it("preserves waste-operation site and facility mappings", () => {
    const result = normaliseResponse({ records: [{ site_name: "Ling Hall", permit_number: "EPR/TEST", licence_holder: "Veolia", facility_type: "Landfill" }], facility_types: [{ facility_type: "Landfill", total: 1 }], total_pages: 2 });
    assert.equal(result.records[0]?.name, "Ling Hall");
    assert.equal(result.records[0]?.operator, "Veolia");
    assert.equal(result.records[0]?.registrationNumber, "EPR/TEST");
    assert.deepEqual(result.facilityTypes, ["Landfill"]);
    assert.equal(result.totalPages, 2);
  });
});