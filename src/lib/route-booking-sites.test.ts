import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importedSiteDetails, applyBookingSite } from "./route-booking-sites";

describe("established booking sites", () => {
  it("uses the full service address, never the Clews tipping location", () => {
    const site = importedSiteDetails({ "Address 2": "Britvic Soft Drinks Ltd", "Address 3": "Aventine Way", "Address 3_1": "Glebe Farm Industrial Estate", "Address 4": "Rugby", Location: "Clews Recycling Ltd", Postcode: "CV21 1HA" });
    assert.equal(site.address, "Britvic Soft Drinks Ltd\nAventine Way\nGlebe Farm Industrial Estate\nRugby");
    assert.equal(site.postcode, "CV21 1HA");
  });
  it("does not invent an address when only a depot is present", () => {
    assert.equal(importedSiteDetails({ Location: "Clews Recycling Ltd" }).address, "");
  });
  it("replaces previous site details instead of retaining another site's address", () => {
    const form = applyBookingSite({ site_address: "Clews depot", site_address_2: "Old line", site_contact_phone: "old", haulage_cost: 150 }, { name: "Established site", address: "Actual address", postcode: "CV21 1HA" });
    assert.equal(form.site_address, "Actual address");
    assert.equal(form.site_address_2, "");
    assert.equal(form.site_contact_phone, "");
    assert.equal(form.haulage_cost, 150);
  });
});