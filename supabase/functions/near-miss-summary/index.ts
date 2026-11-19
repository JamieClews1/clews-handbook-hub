import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildClaudeInput, normaliseSummary, reportsInPeriod, SUMMARY_TOOL, SYSTEM_PROMPT, type NearMissRow } from "./summary.ts";

const MODEL = "claude-sonnet-4-6";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function callClaude(key: string, body: unknown) {
  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (res.status !== 429 && res.status < 500) return res;
    await res.body?.cancel();
    if (attempt < 2) await new Promise(r => setTimeout(r, 2 ** (attempt + 1) * 1000));
  }
  return res!;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json({ error: "Configuration unavailable." }, 503);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Please sign in." }, 401);
  const db = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: claims, error: claimsError } = await db.auth.getClaims(authorization.slice(7));
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) return json({ error: "Please sign in again." }, 401);

  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    db.rpc("has_role", { _user_id: userId, _role: "admin" }),
    db.rpc("is_management", { _user_id: userId }),
  ]);
  if (!isAdmin && !isManager) return json({ error: "Only managers can create near miss summaries." }, 403);

  try {
    const { data: last, error: lastError } = await db.from("near_miss_summaries").select("period_to").order("period_to", { ascending: false }).limit(1).maybeSingle();
    if (lastError) throw lastError;
    const from = (last?.period_to as string | undefined) ?? null;
    const to = new Date().toISOString();

    const { data: all, error: reportsError } = await db.from("near_miss_reports")
      .select("id,created_at,report_date,location,description,what_happened,potential_consequences,suggested_actions,reporter_department,status,review_notes");
    if (reportsError) throw reportsError;
    const rows = reportsInPeriod((all ?? []) as NearMissRow[], from, to);
    if (rows.length === 0) return json({ empty: true, from });

    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!claudeKey) return json({ error: "The Claude connection is not set up." }, 503);

    const [{ data: talks }, { data: rams }] = await Promise.all([
      db.from("toolbox_talks").select("reference_code,title").eq("is_published", true).limit(200),
      db.from("rams").select("title").limit(200),
    ]);
    const input = buildClaudeInput(rows, { from, to }, talks ?? [], rams ?? []);

    const res = await callClaude(claudeKey, {
      model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT,
      tools: [SUMMARY_TOOL], tool_choice: { type: "tool", name: SUMMARY_TOOL.name },
      messages: [{ role: "user", content: `Near-miss reports for review (JSON):\n${JSON.stringify(input)}` }],
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Claude error", res.status, err);
      const reason = String(err?.error?.message ?? "");
      const msg = /credit balance|billing/i.test(reason) ? "Claude account has run out of credit." : res.status === 429 ? "Claude is busy right now, please try again in a minute." : "Claude could not create the summary.";
      return json({ error: msg }, res.status === 429 ? 429 : 502);
    }
    const result = await res.json();
    const block = (result.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!block) return json({ error: "Claude returned no summary. Please try again." }, 502);
    const summary = normaliseSummary(block.input, rows.length);
    if (!summary.overview) return json({ error: "Claude returned an empty summary. Please try again." }, 502);

    const { data: saved, error: saveError } = await db.from("near_miss_summaries").insert({
      created_by: userId, period_from: from, period_to: to, report_count: rows.length,
      report_ids: rows.map(r => r.id), summary, model: MODEL,
    }).select("*").single();
    if (saveError) throw saveError;
    return json({ summary: saved });
  } catch (e) {
    console.error("near-miss-summary failed", e);
    return json({ error: "The summary could not be created." }, 500);
  }
});
