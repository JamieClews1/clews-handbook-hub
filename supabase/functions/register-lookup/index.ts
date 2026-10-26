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
    const operator = String(body?.operator ?? "").trim().slice(0, 120).toLowerCase();
    const page = Math.max(1, Math.min(1000, Number(body?.page) || 1));
    if (facility && register === "companies") return json({ error: "Facility filter only applies to waste operations" }, 400);

    const fetchPage = async (p: number) => {
      const params = new URLSearchParams({ register, page: String(p) });
      if (q) params.set("q", q);
      if (facility) params.set("facility", facility);
      const upstream = await fetch(`${REGISTER_API}?${params}`);
      if (upstream.status === 400) return { error: "Check your search values", status: 400 };
      if (!upstream.ok) return { error: "Register temporarily unavailable", status: 503 };
      const data = await upstream.json().catch(() => null);
      if (!data || typeof data !== "object") return { error: "Register temporarily unavailable", status: 503 };
      return { data };
    };

    const matchesOperator = (rec: Record<string, unknown>) => {
      if (!operator) return true;
      const holder = `${rec?.licence_holder ?? ""} ${rec?.trading_name ?? ""} ${rec?.company_name ?? ""} ${rec?.operator_name ?? ""}`.toLowerCase();
      return operator.split(/\s+/).every(w => holder.includes(w));
    };

    const first = await fetchPage(page);
    if ("error" in first) return json({ error: first.error, retry: first.status === 503 }, first.status);
    const data = first.data as any;

    // The register's q matches a single field, so "Veolia Ling Hall" finds nothing.
    // With an operator filter, scan a few pages of the site search and keep matches for that operator.
    if (operator && register === "waste-operations" && Array.isArray(data.records)) {
      const collected: any[] = [];
      let scanned = 0;
      let current = data;
      const maxPages = Math.min(Number(data.total_pages) || 1, page + 5);
      for (let p = page; p <= maxPages; p++) {
        const recs = Array.isArray(current.records) ? current.records : [];
        scanned += recs.length;
        collected.push(...recs.filter(matchesOperator));
        if (collected.length >= 25 || p >= maxPages) break;
        const next = await fetchPage(p + 1);
        if ("error" in next) break;
        current = next.data;
      }
      return json({
        ...data,
        records: collected.slice(0, 25),
        total: collected.length >= 25 ? `${collected.length}+` : collected.length,
        page: 1,
        total_pages: 1,
        operator_filter: operator,
        scanned,
      });
    }

    return json(data);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Register lookup failed" }, 500);
  }
});
