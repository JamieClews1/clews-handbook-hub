import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { driverNameKey, verifyDriverPass } from "../_shared/driver-session.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const pass = await verifyDriverPass(body?.token);
    if (!pass) return json({ error: "Your driver session has expired. Please sign in again.", session_expired: true }, 401);
    const date = String(body?.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "date is required" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey);

    // The driver's name comes from their own record, never from the request.
    const { data: me } = pass.src === "profile"
      ? await supabase.from("profiles").select("driver_name:full_name").eq("id", pass.d).maybeSingle()
      : await supabase.from("route_one_drivers").select("driver_name").eq("id", pass.d).eq("is_active", true).maybeSingle();
    const myKey = driverNameKey((me as any)?.driver_name);
    if (!myKey) return json({ jobs: [] });

    const { data, error } = await supabase
      .from("data_hub_jobs")
      .select("job_number, job_date, customer, site, postcode, movement_type, container_type, waste_description, weight_t, vehicle_registration, driver, tipping_location")
      .eq("source", "skiptrak")
      .eq("job_date", date)
      .not("driver", "is", null)
      .order("job_date");
    if (error) throw error;

    // Exact match only ("Lee.Gane" = "Lee Gane"); partial names never match another driver.
    const jobs = (data ?? []).filter((j: any) => driverNameKey(j.driver) === myKey);
    return json({ jobs });
  } catch (err) {
    console.error("driver-jobs error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
