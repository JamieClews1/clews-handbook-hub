import { it } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const session = sessionJson ? JSON.parse(sessionJson) : null;
const url = process.env.VITE_SUPABASE_URL || "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const enabled = Boolean(session && url && key);
const client = enabled ? createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${session.access_token}` } } }) : null;

it("site search includes only sites used within the last six calendar months", { skip: !enabled }, async () => {
  assert.ok(client);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(year, month - 7, 1));
  cutoff.setUTCDate(Math.min(day, new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate()));
  const result = await client.rpc("search_recent_booking_sites", { p_query: "", p_limit: 2000 });
  assert.equal(result.error, null);
  assert.ok(result.data?.length);
  for (const row of result.data || []) {
    assert.ok(row.last_used >= cutoff.toISOString().slice(0, 10));
    assert.ok(row.last_used <= today);
  }
});

it("unsigned visitors cannot search the internal site bank", { skip: !enabled }, async () => {
  const anonymous = createClient(url, key, { auth: { persistSession: false } });
  const result = await anonymous.rpc("search_recent_booking_sites", { p_query: "SUEZ" });
  assert.ok(result.error);
});

it("staff cannot directly write the automatically maintained site bank", { skip: !enabled }, async () => {
  assert.ok(client);
  const result = await client.from("route_one_recent_sites").update({ site: "must not save" }).eq("site_key", "no-such-key");
  assert.ok(result.error);
});