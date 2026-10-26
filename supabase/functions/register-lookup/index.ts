import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (p: unknown, status = 200) =>
  new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const REGISTER_API = "https://comply.wasteone.ai/api/public/register/search";
const REGISTERS = new Set(["companies", "waste-operations"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Staff-only: require a valid user JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return json({ error: "Not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const register = String(body?.register ?? "waste-operations");
    if (!REGISTERS.has(register)) return json({ error: "Unknown register" }, 400);
    const q = String(body?.q ?? "").trim().slice(0, 120);
    const facility = String(body?.facility ?? "").trim().slice(0, 120);
    const page = Math.max(1, Math.min(1000, Number(body?.page) || 1));
    if (facility && register === "companies") return json({ error: "Facility filter only applies to waste operations" }, 400);

    const params = new URLSearchParams({ register, page: String(page) });
    if (q) params.set("q", q);
    if (facility) params.set("facility", facility);

    const upstream = await fetch(`${REGISTER_API}?${params}`);
    if (upstream.status === 400) return json({ error: "Check your search values" }, 400);
    if (!upstream.ok) return json({ error: "Register temporarily unavailable", retry: true }, 503);

    const data = await upstream.json().catch(() => null);
    if (!data || typeof data !== "object") return json({ error: "Register temporarily unavailable", retry: true }, 503);
    return json(data);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Register lookup failed" }, 500);
  }
});
