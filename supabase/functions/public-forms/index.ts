import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// UUID v4-ish validation for share tokens
const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Fields the public submitter is never allowed to set directly.
const PROTECTED_FIELDS: Record<string, string[]> = {
  credit_account_applications: [
    "id", "share_token", "created_at", "updated_at", "created_by", "status",
    "approved", "approved_by_name", "approved_by_signature", "approved_at",
    "customer_id", "account_number", "credit_limit_set", "invited_email", "submitted_at",
  ],
  partner_questionnaires: [
    "id", "share_token", "created_at", "updated_at", "created_by", "status",
    "partner_id", "template_id", "reviewed_by", "reviewed_signature",
    "reviewed_position", "reviewed_at", "partner_ranking", "submitted_at",
  ],
};

const ALLOWED_RESOURCES = Object.keys(PROTECTED_FIELDS);

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const resource = String(body?.resource ?? "");
    const token = body?.token;

    if (!ALLOWED_RESOURCES.includes(resource)) {
      return json({ error: "Invalid resource" }, 400);
    }
    if (!isUuid(token)) {
      return json({ error: "Invalid or missing token" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (action === "get") {
      const { data, error } = await supabase
        .from(resource)
        .select("*")
        .eq("share_token", token)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ record: null }, 404);
      return json({ record: data });
    }

    if (action === "submit") {
      // Confirm the token maps to a record that can still be edited
      const { data: existing, error: fetchErr } = await supabase
        .from(resource)
        .select("id, status")
        .eq("share_token", token)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!existing) return json({ error: "Not found" }, 404);
      if (!["pending", "submitted"].includes(existing.status)) {
        return json({ error: "This form can no longer be edited" }, 403);
      }

      const incoming = (body?.payload && typeof body.payload === "object") ? body.payload : {};
      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(incoming)) {
        if (!PROTECTED_FIELDS[resource].includes(k)) sanitized[k] = v;
      }
      sanitized.status = "submitted";
      sanitized.submitted_at = new Date().toISOString();

      const { data, error } = await supabase
        .from(resource)
        .update(sanitized)
        .eq("share_token", token)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return json({ ok: true, id: data?.id });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("public-forms error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
