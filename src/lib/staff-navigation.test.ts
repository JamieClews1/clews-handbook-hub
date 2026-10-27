import { it } from "node:test";
import assert from "node:assert/strict";
import { QUICK_LINKS, STAFF_NAV_GROUPS, navigationAllowed, navigationActive } from "./staff-navigation";
const all = STAFF_NAV_GROUPS.flatMap(g => g.items);
const staff = { isAdmin: false, canAccessFinance: false, canAccessPl: false };
it("moving admin pages does not expose them to ordinary staff", () => {
  for (const path of ["/admin/customers", "/admin/questionnaires", "/performance-hub/data", "/admin/users", "/admin/apps", "/admin/settings"]) {
    const item = all.find(i => i.path === path);
    assert.ok(item);
    assert.equal(navigationAllowed(item, staff), false);
    assert.equal(navigationAllowed(item, { ...staff, isAdmin: true }), true);
  }
});
it("P&L stays grant-controlled even for other admins and finance users", () => {
  const item = all.find(i => i.path === "/finance/company-pl");
  assert.ok(item);
  assert.equal(navigationAllowed(item, { ...staff, isAdmin: true, canAccessFinance: true }), false);
  assert.equal(navigationAllowed(item, { ...staff, canAccessPl: true }), true);
});
it("invoicing keeps the finance gate", () => {
  const item = all.find(i => i.path === "/finance");
  assert.ok(item);
  assert.equal(navigationAllowed(item, staff), false);
  assert.equal(navigationAllowed(item, { ...staff, canAccessFinance: true }), true);
});
it("rebates sits under Customers & Sales and keeps the finance gate", () => {
  const item = STAFF_NAV_GROUPS.find(group => group.key === "nav-customers-sales")?.items.find(item => item.path === "/rebate-values");
  assert.ok(item);
  assert.equal(navigationAllowed(item, staff), false);
  assert.equal(navigationAllowed(item, { ...staff, canAccessFinance: true }), true);
  assert.equal(navigationActive(item.path, "/rebate-values"), true);
});
it("weighbridge pricing has its own active destination", () => {
  assert.equal(navigationActive("/weigh-one", "/weigh-one/pricing"), false);
  assert.equal(navigationActive("/weigh-one/pricing", "/weigh-one/pricing"), true);
});
it("Company P&L selects only its own page, not Invoicing", () => {
  const selected = all.filter(item => navigationActive(item.path, "/finance/company-pl"));
  assert.deepEqual(selected.map(item => item.path), ["/finance/company-pl"]);
});
it("nested P&L pages keep the most specific selection", () => {
  assert.equal(navigationActive("/finance", "/finance/company-pl/settings"), false);
  assert.equal(navigationActive("/finance/company-pl", "/finance/company-pl/settings"), true);
});
it("Invoicing still selects Finance itself", () => {
  assert.equal(navigationActive("/finance", "/finance"), true);
  assert.equal(navigationActive("/finance/company-pl", "/finance"), false);
});
it("Diary sits in quick links and under Operations, and selects only itself", () => {
  const quick = QUICK_LINKS.find(item => item.path === "/diary");
  const operations = STAFF_NAV_GROUPS.find(g => g.key === "nav-site-operations")?.items.some(item => item.path === "/diary");
  assert.ok(quick);
  assert.equal(operations, true);
  assert.equal(navigationActive("/diary", "/diary"), true);
  assert.deepEqual(all.filter(item => navigationActive(item.path, "/diary")).map(item => item.path), ["/diary"]);
});