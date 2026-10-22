import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Opt-in authenticated checks: PL_ACCESS_TEST_SESSION_FILE points to a locally minted Jamie session.
const sessionFile = process.env.PL_ACCESS_TEST_SESSION_FILE;
const enabled = Boolean(sessionFile);
const session = sessionFile ? JSON.parse(readFileSync(sessionFile, "utf8")).session : null;
const url = process.env.VITE_SUPABASE_URL ?? "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const client = enabled ? createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${session.access_token}` } } }) : null;

it("Jamie can manage P&L access", { skip: !enabled }, async () => {
  assert.ok(client);
  const result = await client.rpc("can_manage_company_pl_access");
  assert.equal(result.error, null);
  assert.equal(result.data, true);
});

it("other staff cannot become P&L access managers", { skip: !enabled }, async () => {
  assert.ok(client);
  const list = await client.rpc("list_company_pl_access");
  assert.equal(list.error, null);
  const staff = list.data?.find((user: { is_manager: boolean }) => !user.is_manager);
  assert.ok(staff);
  const result = await client.rpc("can_manage_company_pl_access", { _user_id: staff.user_id });
  assert.equal(result.error, null);
  assert.equal(result.data, false);
});

it("Jamie cannot remove their own permanent P&L access", { skip: !enabled }, async () => {
  assert.ok(client);
  const result = await client.rpc("set_company_pl_access", { _user_id: session.user.id, _enabled: false });
  assert.ok(result.error);
  const access = await client.rpc("has_company_pl_access");
  assert.equal(access.data, true);
});

it("unsigned callers cannot grant P&L access", { skip: !enabled }, async () => {
  const anonymous = createClient(url, key, { auth: { persistSession: false } });
  const result = await anonymous.rpc("set_company_pl_access", { _user_id: session.user.id, _enabled: true });
  assert.ok(result.error);
});