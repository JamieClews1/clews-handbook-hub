import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ProfileDriver {
  id: string;
  full_name: string | null;
  driver_number: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "login";
    const supabase = createClient(supabaseUrl, serviceKey);

    if (action === "login") {
      const number = parseInt(String(body?.number ?? ""), 10);
      const pin = String(body?.pin ?? "");
      if (!Number.isFinite(number) || !pin) {
        return json({ error: "Driver number and PIN are required" }, 400);
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, driver_number, user_types")
        .eq("driver_number", number)
        .eq("driver_pin", pin)
        .maybeSingle();

      if (error) throw error;
      if (!data || !(data.user_types || []).includes("driver")) {
        return json({ user: null });
      }

      return json({ user: toUser(data) });
    }

    if (action === "restore") {
      const id = String(body?.id ?? "");
      if (!id) return json({ error: "id is required" }, 400);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, driver_number, user_types")
        .eq("id", id)
        .not("driver_number", "is", null)
        .maybeSingle();

      if (error) throw error;
      if (!data || !(data.user_types || []).includes("driver")) {
        return json({ user: null });
      }

      return json({ user: toUser(data) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("driver-auth error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});

function toUser(data: ProfileDriver) {
  return {
    id: data.id,
    name: data.full_name || `Driver ${data.driver_number}`,
    driver_number: data.driver_number,
  };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
