import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentSiteContainers, historySearchText, historyStatus, type HistoryJob } from "./site-history";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";
const settings = { skip_container_keywords: ["yard"], roro_container_keywords: ["ro ro"], artic_container_keywords: [], artic_vehicle_regs: [] } as unknown as LiveJobsSettings;
const job = (movement: string, date = "2026-11-05"): HistoryJob => ({id: movement+date,source:"skiptrak",job_number:"123",job_date:date,customer:"IPR Environmental",site:"Ford Motor Company",postcode:"NN11 8NT",address:"Royal Oak Way",container_type:"40 yd Ro Ro",movement_type:movement,waste_description:"Vehicle components",vehicle_registration:null,ewc:"16 01 22",rental_status:"Y"});
describe("site history", () => {
  it("search text includes company, site address and postcode", () => { const text=historySearchText(job("Exchange")); for(const value of ["IPR Environmental","Ford Motor Company","Royal Oak Way","NN11 8NT"]) assert.ok(text.includes(value)); });
  it("a booked collection does not remove the current container", () => { const rows=[job("Deliver"),job("Collect","2026-11-09")];assert.equal(currentSiteContainers(rows,[],settings,"2025-12-01","2026-11-06")[0]?.count,1);assert.equal(historyStatus(rows[1],"2026-11-06"),"Booked"); });
  it("a completed collection clears the site despite a changed waste code", () => { assert.equal(currentSiteContainers([job("Deliver","2026-11-01"),{...job("Collect"),ewc:"17 09 04"}],[],settings,"2025-12-01","2026-11-06").length,0); });
  it("confirmed two-bin history survives exchanges", () => { assert.equal(currentSiteContainers([job("Exchange")],[{id:"rule",site:"Ford Motor Company",customer:"IPR Environmental",container_type:"40 yd Ro Ro",ewc:"16 01 22",bin_count:2,active:true}],settings,"2025-12-01","2026-11-06")[0]?.count,2); });
});