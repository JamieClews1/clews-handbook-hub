import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterSiteMapEntries, siteMapEntries, siteMapPostcodes, type SiteMapEntry } from "./site-map";
import type { HistoryJob } from "./site-history";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

const settings = {
  rental_free_days: 30,
  artic_vehicle_regs: ["FG61 SYV"],
  artic_container_keywords: ["curtain side"],
  roro_container_keywords: ["ro ro", "roll on roll off"],
  skip_container_keywords: ["skip", "yard", "yd", "chain lift"],
  waste_truck_months: 6,
  rental_skip_rate: 18,
  rental_roro_rate: 42,
  rental_chase_email_template: "",
} satisfies LiveJobsSettings;

const TODAY = "2026-11-06";
const SINCE = "2025-11-01";

const job = (over: Partial<HistoryJob>): HistoryJob => ({
  id: Math.random().toString(36).slice(2),
  source: "skiptrak",
  job_number: "1000",
  job_date: "2026-10-01",
  customer: "Acme",
  site: "Depot",
  container_type: "6 yd Skip",
  movement_type: "Deliver",
  waste_description: "General waste",
  vehicle_registration: "AB12 CDE",
  ewc: "20 03 01",
  postcode: "CV21 1AA",
  rental_status: "Y",
  ...over,
});

const entry = (over: Partial<SiteMapEntry>): SiteMapEntry => ({
  key: "depot",
  site: "Depot",
  names: ["Depot"],
  customers: ["Acme"],
  address: "1 High Street",
  postcode: "CV21 1AA",
  containers: [],
  total: 1,
  ...over,
});

describe("siteMapEntries", () => {
  it("keeps each site separate with its own container count, customer and postcode", () => {
    const entries = siteMapEntries(
      [
        job({ site: "Willoughby Park", customer: "Darren Warner", postcode: "CV23 8AJ", container_type: "12 yd Skip DOM" }),
        job({ site: "Ford IPR", customer: "IPR", postcode: "NN11 8NT", container_type: "40 yd Ro Ro" }),
        job({ site: "Ford IPR", customer: "IPR", postcode: "NN11 8NT", container_type: "40 yd Ro Ro" }),
      ],
      [],
      settings,
      SINCE,
      TODAY,
    );
    assert.deepEqual(entries.map(e => e.site), ["Ford IPR", "Willoughby Park"]);
    const ford = entries.find(e => e.site === "Ford IPR")!;
    assert.equal(ford.total, 2);
    assert.equal(ford.postcode, "NN11 8NT");
    assert.deepEqual(ford.customers, ["IPR"]);
    const willoughby = entries.find(e => e.site === "Willoughby Park")!;
    assert.equal(willoughby.total, 1);
    assert.equal(willoughby.postcode, "CV23 8AJ");
    assert.equal(willoughby.containers[0].category, "skip");
  });

  it("reports zero for a site whose container was collected, and ignores future bookings", () => {
    const entries = siteMapEntries(
      [
        job({ site: "Cleared Site", job_date: "2026-09-01", movement_type: "Deliver" }),
        job({ site: "Cleared Site", job_date: "2026-10-05", movement_type: "Collect" }),
        job({ site: "Booked Site", job_date: "2026-12-01", movement_type: "Deliver" }),
      ],
      [],
      settings,
      SINCE,
      TODAY,
    );
    assert.equal(entries.find(e => e.site === "Cleared Site")!.total, 0);
    assert.equal(entries.find(e => e.site === "Booked Site")!.total, 0);
  });

  it("ignores job rows with no site name", () => {
    assert.deepEqual(siteMapEntries([job({ site: null })], [], settings, SINCE, TODAY), []);
  });
});

describe("filterSiteMapEntries", () => {
  const entries = [
    entry({ key: "a", site: "Royal Oak Way", customers: ["IPR Vehicle Components"], postcode: "NN11 8NT", address: "Old Stratford Road" }),
    entry({ key: "b", site: "Willoughby Park", customers: ["Darren Warner"], postcode: "CV23 8AJ", address: "Onley Grounds" }),
  ];

  it("matches company, site name and address text", () => {
    assert.deepEqual(filterSiteMapEntries(entries, "vehicle components").map(e => e.key), ["a"]);
    assert.deepEqual(filterSiteMapEntries(entries, "willoughby").map(e => e.key), ["b"]);
    assert.deepEqual(filterSiteMapEntries(entries, "onley grounds").map(e => e.key), ["b"]);
  });

  it("matches a postcode with or without its space", () => {
    assert.deepEqual(filterSiteMapEntries(entries, "CV238AJ").map(e => e.key), ["b"]);
    assert.deepEqual(filterSiteMapEntries(entries, "cv23 8aj").map(e => e.key), ["b"]);
    assert.deepEqual(filterSiteMapEntries(entries, "nn11").map(e => e.key), ["a"]);
  });

  it("returns everything for a blank search", () => {
    assert.deepEqual(filterSiteMapEntries(entries, "   "), entries);
  });
});

describe("siteMapPostcodes", () => {
  it("normalises, dedupes and drops unusable postcodes", () => {
    const postcodes = siteMapPostcodes([
      entry({ key: "a", postcode: "cv23 8aj" }),
      entry({ key: "b", postcode: "CV238AJ" }),
      entry({ key: "c", postcode: "" }),
      entry({ key: "d", postcode: "CV21" }),
    ]);
    assert.deepEqual(postcodes, ["CV238AJ"]);
  });
});
