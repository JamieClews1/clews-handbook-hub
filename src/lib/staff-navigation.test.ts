import { it } from "node:test";
import assert from "node:assert/strict";
import { STAFF_NAV_GROUPS, navigationAllowed, navigationActive } from "./staff-navigation";
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
it("weighbridge pricing has its own active destination", () => {
  assert.equal(navigationActive("/weigh-one", "/weigh-one/pricing"), false);
  assert.equal(navigationActive("/weigh-one/pricing", "/weigh-one/pricing"), true);
});