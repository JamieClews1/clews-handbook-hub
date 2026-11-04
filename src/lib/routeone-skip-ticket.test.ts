import { test } from "node:test";
import assert from "node:assert/strict";
import { routeOneSkipDetails, importedSkipWaste } from "./routeone-skip-ticket";

const job = { site_name: "Warehouse", site_address: "Unit 2, 17 High Street", site_address_2: "Rugby", site_postcode: "CV21 1AA", waste_type: "Mixed construction waste", ewc_code: "17 09 04" };
test("Skip tickets retain Route One waste description", () => {
  assert.equal(routeOneSkipDetails(job).waste_description, "Mixed construction waste");
});
test("Skip tickets retain Route One EWC", () => {
  assert.equal(routeOneSkipDetails(job).ewc_code, "17 09 04");
});
test("Skip tickets carry the complete site address including unit and postcode", () => {
  assert.equal(routeOneSkipDetails(job).site, "Warehouse, Unit 2, 17 High Street, Rugby, CV21 1AA");
});
test("Postcode already in address is not repeated", () => {
  assert.equal(routeOneSkipDetails({ ...job, site_address_2: "Rugby, CV21 1AA" }).site, "Warehouse, Unit 2, 17 High Street, Rugby, CV21 1AA");
});
test("Imported Route One Skip jobs copy waste and EWC using their source fields", () => {
  assert.deepEqual(importedSkipWaste({ waste_description: "Mixed Municipal Waste", ewc: "20 03 01" }), { waste_description: "Mixed Municipal Waste", ewc_code: "20 03 01" });
});