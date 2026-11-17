import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySiteSearchHit, normaliseSiteSearchTerm, siteMatchesSearch, type SiteFinderForm, type SiteSearchHit } from "./site-postcode-finder";

const empty: SiteFinderForm = {
  site_name: "", data_hub_customer: "", data_hub_site: "", data_hub_site_2: "", data_hub_site_3: "", data_hub_site_4: "", data_hub_site_5: "",
  address_1: "", address_2: "", address_3: "", postcode: "",
};
const hit: SiteSearchHit = {
  source: "skiptrak", customer: "Biffa Waste", site: "Rugby 3", postcode: "CV21 1HA",
  address: "Britvic Soft Drinks Ltd", address2: "Aventine Way", address3: "Glebe Farm Industrial Estate", job_count: 249, last_date: "2026-12-18",
};

describe("normaliseSiteSearchTerm", () => {
  it("adds the space to a postcode typed without one", () => {
    assert.equal(normaliseSiteSearchTerm("cv211ha"), "CV21 1HA");
  });
  it("leaves names alone", () => {
    assert.equal(normaliseSiteSearchTerm("  britvic  rugby "), "britvic rugby");
  });
});

describe("applySiteSearchHit", () => {
  it("fills an empty new site from the chosen result", () => {
    const { form, status } = applySiteSearchHit(empty, hit);
    assert.equal(status, "added");
    assert.equal(form.data_hub_site, "Rugby 3");
    assert.equal(form.data_hub_customer, "Biffa Waste");
    assert.equal(form.site_name, "Britvic Soft Drinks Ltd");
    assert.equal(form.address_2, "Aventine Way");
    assert.equal(form.postcode, "CV21 1HA");
  });
  it("adds a second site to the next slot without overwriting typed details", () => {
    const first = applySiteSearchHit({ ...empty, site_name: "Britvic Rugby" }, hit).form;
    const { form, status } = applySiteSearchHit(first, { ...hit, site: "Waste yard" });
    assert.equal(status, "added");
    assert.equal(form.data_hub_site_2, "Waste yard");
    assert.equal(form.site_name, "Britvic Rugby");
  });
  it("does not add the same site twice or past five slots", () => {
    const linked = applySiteSearchHit(empty, hit).form;
    assert.equal(applySiteSearchHit(linked, hit).status, "already");
    const full = { ...empty, data_hub_site: "A", data_hub_site_2: "B", data_hub_site_3: "C", data_hub_site_4: "D", data_hub_site_5: "E" };
    assert.equal(applySiteSearchHit(full, hit).status, "full");
  });
});

describe("siteMatchesSearch", () => {
  const site = { site_name: "Britvic Rugby", postcode: "CV21 1HA", address_2: "Aventine Way" };
  it("finds a site by postcode typed with or without the space", () => {
    assert.equal(siteMatchesSearch(site, "cv211ha"), true);
    assert.equal(siteMatchesSearch(site, "CV21 1HA"), true);
    assert.equal(siteMatchesSearch(site, "cv21"), true);
    assert.equal(siteMatchesSearch({ site_name: "Paul Jackson", postcode: "CV2 1NE" }, "cv21"), false);
  });
  it("finds by name or address and hides sites that don't match", () => {
    assert.equal(siteMatchesSearch(site, "aventine"), true);
    assert.equal(siteMatchesSearch(site, "CV22 5AB"), false);
  });
});
