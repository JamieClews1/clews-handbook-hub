import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body, customer, site } = await req.json();

    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const detailRows = [
      customer ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Customer</td><td style="padding:4px 0;color:#111;font-weight:600;">${customer}</td></tr>` : "",
      site ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Site</td><td style="padding:4px 0;color:#111;font-weight:600;">${site}</td></tr>` : "",
    ].join("");

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #14532d; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">Clews Recycling — Container Rental Notice</h2>
        </div>
        <div style="padding: 24px; background: #ffffff; border: 1px solid #e0e0e0;">
          ${detailRows ? `<table style="margin-bottom:16px;border-collapse:collapse;">${detailRows}</table>` : ""}
          ${body.split("\n").map((line: string) => `<p style="margin: 6px 0; color: #333; line-height:1.5;">${line}</p>`).join("")}
        </div>
        <div style="padding: 16px; text-align: center; font-size: 12px; color: #999;">
          Clews Recycling Limited
        </div>
      </div>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Clews Recycling <noreply@noreply.clewsrecycling.co.uk>",
        to: [to],
        subject,
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errorText = await emailRes.text();
      throw new Error(`Resend error: ${errorText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending rental chase email:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
