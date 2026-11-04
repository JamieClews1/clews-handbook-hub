import { test } from "node:test";
import assert from "node:assert/strict";
import { routeOneSkipDetails } from "./routeone-skip-ticket";

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