import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const driverName: string = String(body?.driverName ?? "").trim();
    const date: string = String(body?.date ?? "").trim();

    if (!driverName || !date) {
      return json({ error: "driverName and date are required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("data_hub_jobs")
      .select(
        "job_number, job_date, customer, site, postcode, movement_type, container_type, waste_description, weight_t, vehicle_registration, driver, tipping_location",
      )
      .eq("source", "skiptrak")
      .eq("job_date", date)
      .not("driver", "is", null)
      .order("job_date");

    if (error) throw error;

    const normalized = driverName.toLowerCase().trim().replace(/[.\-_]/g, " ");
    const jobs = (data ?? []).filter((j: any) => {
      const d = (j.driver || "").toLowerCase().trim().replace(/[.\-_]/g, " ");
      return d === normalized || d.includes(normalized) || normalized.includes(d);
    });

    return json({ jobs });
  } catch (err) {
    console.error("driver-jobs error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
