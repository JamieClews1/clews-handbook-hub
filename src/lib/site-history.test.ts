import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentSiteContainers, historySiteIdentity, historySourceLabel, historySearchText, siteHistorySearchFilters, historyStatus, type HistoryJob } from "./site-history";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";
const settings = { skip_container_keywords: ["yard"], roro_container_keywords: ["ro ro"], artic_container_keywords: [], artic_vehicle_regs: [] } as unknown as LiveJobsSettings;
const job = (movement: string, date = "2026-11-05"): HistoryJob => ({id: movement+date,source:"skiptrak",job_number:"123",job_date:date,customer:"IPR Environmental",site:"Ford Motor Company",postcode:"NN11 8NT",address:"Royal Oak Way",container_type:"40 yd Ro Ro",movement_type:movement,waste_description:"Vehicle components",vehicle_registration:null,ewc:"16 01 22",rental_status:"Y"});
describe("site history", () => {
  it("distinguishes Skip from Weighbridge records", () => {
    assert.equal(historySourceLabel("skiptrak"), "Skip");
    assert.equal(historySourceLabel("midweigh"), "Weighbridge");
    assert.equal(historyStatus({...job("INWARD"),source:"midweigh"}, "2026-11-06"), "Recorded");
  });
  it("keeps unlocated Weighbridge customers separate without inventing sites", () => {
    assert.equal(historySiteIdentity({customer:"Element",site:null}, "midweigh")?.site, "Site not recorded");
    assert.notEqual(historySiteIdentity({customer:"Element",site:null}, "midweigh")?.key, historySiteIdentity({customer:"Biffa",site:null}, "midweigh")?.key);
    assert.equal(historySiteIdentity({customer:"Element",site:null}, "skiptrak"), null);
  });
  it("searches every company, address line, postcode and saved site alias", () => {
    const filters = siteHistorySearchFilters("nn11");
    for (const field of ["customer", "site", "postcode", "raw->>Location Postc_1", "raw->>Address 2nd LIne", "raw->>Address 3"]) assert.ok(filters.jobs.split(",").includes(`${field}.ilike.%nn11%`));
    for (const field of ["site_name", "data_hub_customer", "data_hub_site", "data_hub_site_2", "data_hub_site_3", "data_hub_site_4", "data_hub_site_5", "address_1", "address_2", "postcode"]) assert.ok(filters.mappings.split(",").includes(`${field}.ilike.%nn11%`));
  });
  it("matches postcodes regardless of spacing and escapes query operators", () => {
    assert.ok(siteHistorySearchFilters("NN11 8NT").jobs.includes("postcode.ilike.%NN11%8NT%"));
    assert.ok(!siteHistorySearchFilters('nn11,site.eq.other').jobs.includes('site.eq.other,'));
  });
  it("search text includes company, site address and postcode", () => { const text=historySearchText(job("Exchange")); for(const value of ["IPR Environmental","Ford Motor Company","Royal Oak Way","NN11 8NT"]) assert.ok(text.includes(value)); });
  it("a booked collection does not remove the current container", () => { const rows=[job("Deliver"),job("Collect","2026-11-09")];assert.equal(currentSiteContainers(rows,[],settings,"2025-12-01","2026-11-06")[0]?.count,1);assert.equal(historyStatus(rows[1],"2026-11-06"),"Booked"); });
  it("a completed collection clears the site despite a changed waste code", () => { assert.equal(currentSiteContainers([job("Deliver","2026-11-01"),{...job("Collect"),ewc:"17 09 04"}],[],settings,"2025-12-01","2026-11-06").length,0); });
  it("confirmed two-bin history survives exchanges", () => { assert.equal(currentSiteContainers([job("Exchange")],[{id:"rule",site:"Ford Motor Company",customer:"IPR Environmental",container_type:"40 yd Ro Ro",ewc:"16 01 22",bin_count:2,active:true}],settings,"2025-12-01","2026-11-06")[0]?.count,2); });
});describe("site history last moved", () => {
  const settings = { skip_container_keywords: ["yard"], roro_container_keywords: ["ro ro"], artic_container_keywords: [], artic_vehicle_regs: [] } as unknown as LiveJobsSettings;
  const row = (movement: string, date: string): HistoryJob => ({id:movement+date,source:"skiptrak",job_number:date.slice(-2),job_date:date,customer:"IPR Environmental",site:"Ford Motor Company",postcode:"NN11 8NT",container_type:"40 yd Ro Ro",movement_type:movement,waste_description:"Vehicle components",vehicle_registration:null,ewc:"16 01 22",rental_status:"Y"});
  it("reports the latest completed movement, not a future booking", () => {
    const [c] = currentSiteContainers([row("Deliver","2026-06-01"),row("Exchange","2026-10-20"),row("Exchange","2026-11-20")],[],settings,"2025-12-01","2026-11-13");
    assert.equal(c.lastMoved?.date,"2026-10-20");
    assert.equal(c.lastMoved?.movement,"Exchange");
  });
  it("standing-bin top-ups never become the last moved date", () => {
    const [c] = currentSiteContainers([row("Exchange","2026-09-15")],[{id:"r",site:"Ford Motor Company",customer:null,container_type:"40 yd Ro Ro",ewc:"16 01 22",bin_count:2,active:true}],settings,"2025-12-01","2026-11-13");
    assert.equal(c.count,2);
    assert.equal(c.lastMoved?.date,"2026-09-15");
  });
});
describe("site history across mapped Skiptrak site names", () => {
  const settings = { skip_container_keywords: ["yard"], roro_container_keywords: ["ro ro"], artic_container_keywords: [], artic_vehicle_regs: [] } as unknown as LiveJobsSettings;
  const ex = (site: string, ewc: string, date: string, waste = "Waste"): HistoryJob => ({id:site+ewc+date,source:"skiptrak",job_number:date,job_date:date,customer:"Biffa Waste",site,postcode:"CV21 1HA",container_type:"40 yd Ro Ro",movement_type:"Exchange",waste_description:waste,vehicle_registration:null,ewc,rental_status:"Y"});
  it("counts one exchanged Ro Ro per Skiptrak site name, as Live Jobs does", () => {
    const [c] = currentSiteContainers([ex("New  Waste Yard (Rugby 1)","15 01 02","2026-11-06"),ex("Britvic - Waste Yard Rugby 1 (New)","15 01 03","2026-11-06"),ex("Rugby 3","20 03 01","2026-11-07")],[],settings,"2025-12-01","2026-11-13");
    assert.equal(c.count,3);
    assert.equal(c.bins.length,3);
  });
  it("a changed waste code on one site name is still one bin, shown under the newest code", () => {
    const [c] = currentSiteContainers([ex("Rugby 3","15 01 02","2026-06-01","Plastic"),ex("Rugby 3","20 03 01","2026-11-07","General")],[],settings,"2025-12-01","2026-11-13");
    assert.equal(c.count,1);
    assert.equal(c.bins[0].ewc,"20 03 01");
  });
});
