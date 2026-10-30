import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allAccessSiteIds } from "./portal-site-access";

const sites = [
  { id: "a", customer_id: "cust-1", is_archived: false },
  { id: "b", customer_id: "cust-1", is_archived: true },
  { id: "c", customer_id: "cust-1" },
  { id: "d", customer_id: "cust-2", is_archived: false },
];

describe("allAccessSiteIds", () => {
  it("selects every active site on the user's own account", () => {
    assert.deepEqual(allAccessSiteIds(sites, "cust-1"), ["a", "c"]);
  });

  it("never reaches another customer's sites", () => {
    assert.deepEqual(allAccessSiteIds(sites, "cust-2"), ["d"]);
  });

  it("returns nothing when the account has only archived sites", () => {
    assert.deepEqual(allAccessSiteIds([{ id: "x", customer_id: "cust-3", is_archived: true }], "cust-3"), []);
  });
});
