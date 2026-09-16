import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_RUN = 25;

function render(tpl: string, vars: Record<string, unknown>) {
  return (tpl || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === null || v === undefined ? "" : String(v);
  });
}

function ukDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { timeZone: "UTC" });
}

const compact = (s: unknown) => String(s ?? "").toUpperCase().replace(/\s+/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase
      .from("permit_settings").select("*").order("created_at").limit(1).maybeSingle();
    if (!settings) return json({ error: "Permit settings are not configured" }, 400);
    if (!settings.expiry_check_enabled) return json({ ok: true, skipped: "expiry check disabled", chased: 0 });

    const leadHours = Number(settings.chase_lead_hours) || 72;
    const horizon = new Date(Date.now() + leadHours * 36e5).toISOString().slice(0, 10);

    const { data: permits = [] } = await supabase
      .from("permit_applications")
      .select("*")
      .in("status", ["confirmed", "active", "applied"])
      .not("expiry_date", "is", null)
      .lte("expiry_date", horizon)
      .order("expiry_date")
      .limit(MAX_PER_RUN);

    if (permits.length === 0) return json({ ok: true, chased: 0 });

    // Which postcodes still have a skip on site (12 months of Skiptrak movements)
    const from = new Date();
    from.setMonth(from.getMonth() - 12);
    const { data: movements = [] } = await supabase
      .from("data_hub_jobs")
      .select("postcode, movement_type")
      .eq("source", "skiptrak")
      .gte("job_date", from.toISOString().slice(0, 10))
      .not("postcode", "is", null);

    const balance = new Map<string, number>();
    for (const m of movements as any[]) {
      const pc = compact(m.postcode);
      if (!pc) continue;
      const mt = String(m.movement_type ?? "").toLowerCase();
      if (mt.includes("deliver")) balance.set(pc, (balance.get(pc) ?? 0) + 1);
      else if (mt.includes("collect")) balance.set(pc, (balance.get(pc) ?? 0) - 1);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email sending is not configured" }, 500);

    let chased = 0;
    for (const p of permits as any[]) {
      const onSite = (balance.get(compact(p.site_postcode)) ?? 0) > 0;
      if (!onSite) continue;

      // one chase per permit per expiry date
      const window = `${p.expiry_date}`;
      if (p.last_chase_window === window) continue;

      const hoursRemaining = Math.max(
        0,
        Math.round((new Date(`${p.expiry_date}T23:59:59Z`).getTime() - Date.now()) / 36e5),
      );

      const vars = {
        job_number: p.job_number,
        customer_name: p.customer_name,
        site_address: p.site_address,
        site_postcode: p.site_postcode,
        area: p.area,
        permit_reference: p.permit_reference,
        expiry_date: ukDate(p.expiry_date),
        start_date: ukDate(p.start_date),
        permit_days: p.permit_days,
        hours_remaining: hoursRemaining,
      };

      const subject = render(settings.chase_subject, vars);
      const html = render(settings.chase_body, vars);
      const to = [settings.chase_recipient];

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: `${settings.sender_name} <${settings.sender_email}>`, to, subject, html }),
      });
      const result = await res.json();

      await supabase.from("permit_email_log").insert({
        permit_application_id: p.id,
        email_type: "expiry_chase",
        recipients: to,
        subject,
        body_html: html,
        status: res.ok ? "sent" : "failed",
        error: res.ok ? null : JSON.stringify(result),
      });

      if (res.ok) {
        chased++;
        await supabase
          .from("permit_applications")
          .update({ last_chase_at: new Date().toISOString(), last_chase_window: window })
          .eq("id", p.id);
      }
    }

    return json({ ok: true, considered: permits.length, chased });
  } catch (e) {
    console.error("permit-expiry-check error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
