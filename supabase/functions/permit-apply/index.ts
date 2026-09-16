import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { permitId } = await req.json();
    if (!permitId) return json({ error: "permitId is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: permit, error: pErr } = await supabase
      .from("permit_applications").select("*").eq("id", permitId).maybeSingle();
    if (pErr) throw pErr;
    if (!permit) return json({ error: "Permit not found" }, 404);

    const { data: settings } = await supabase
      .from("permit_settings").select("*").order("created_at").limit(1).maybeSingle();
    if (!settings) return json({ error: "Permit settings are not configured" }, 400);

    const { data: council } = await supabase
      .from("permit_councils").select("*").eq("area", permit.area ?? "").maybeSingle();

    const to: string[] = council?.application_emails ?? permit.council_emails ?? [];
    if (to.length === 0) return json({ error: `No council email set for ${permit.area ?? "this area"}` }, 400);

    let skipSize: string | null = null;
    if (permit.route_one_job_id) {
      const { data: job } = await supabase
        .from("route_one_jobs").select("container_size, container_type").eq("id", permit.route_one_job_id).maybeSingle();
      skipSize = [job?.container_size, job?.container_type].filter(Boolean).join(" ") || null;
    }

    const vars = {
      job_number: permit.job_number,
      customer_name: permit.customer_name,
      site_address: permit.site_address,
      site_postcode: permit.site_postcode,
      skip_size: skipSize ?? "Skip",
      area: permit.area,
      start_date: ukDate(permit.start_date),
      expiry_date: ukDate(permit.expiry_date),
      permit_days: permit.permit_days,
      permit_reference: permit.permit_reference,
      price_exc_vat: permit.price_exc_vat != null ? Number(permit.price_exc_vat).toFixed(2) : "",
      notice_required: permit.notice_required,
    };

    const subject = render(settings.application_subject, vars);
    const bodyHtml = render(settings.application_body, vars);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email sending is not configured" }, 500);

    const cc = [...(council?.cc_emails ?? []), settings.chase_recipient].filter(Boolean);

    // Attach the completed council application form when one has been generated.
    const attachments: { filename: string; content: string }[] = [];
    if (permit.application_pdf_path) {
      const { data: file, error: dlErr } = await supabase.storage
        .from("permit-documents")
        .download(permit.application_pdf_path);
      if (dlErr || !file) return json({ error: "Could not load the completed application form" }, 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      attachments.push({
        filename: permit.application_pdf_path.split("/").pop() ?? "application.pdf",
        content: btoa(binary),
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${settings.sender_name} <${settings.sender_email}>`,
        to,
        cc: [...new Set(cc)],
        subject,
        html: bodyHtml,
        ...(attachments.length ? { attachments } : {}),
      }),
    });
    const result = await res.json();

    await supabase.from("permit_email_log").insert({
      permit_application_id: permit.id,
      email_type: "application",
      recipients: to,
      cc: [...new Set(cc)],
      subject,
      body_html: bodyHtml,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : JSON.stringify(result),
    });

    if (!res.ok) return json({ error: result?.message ?? "Email provider rejected the message" }, 502);

    await supabase
      .from("permit_applications")
      .update({ status: "applied", applied_at: new Date().toISOString(), council_emails: to })
      .eq("id", permit.id);

    return json({ ok: true, to });
  } catch (e) {
    console.error("permit-apply error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
