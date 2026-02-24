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
    const { to, subject, body, photos, queryId } = await req.json();

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

    // Build HTML body
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: #1a1a2e; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">Clews Recycling — Contamination Notice</h2>
        </div>
        <div style="padding: 24px; background: #ffffff; border: 1px solid #e0e0e0;">
          ${body.split("\n").map((line: string) => `<p style="margin: 4px 0; color: #333;">${line}</p>`).join("")}
          ${
            photos && photos.length > 0
              ? `
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;" />
            <h3 style="color: #333;">Contamination Evidence</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
              ${photos.map((url: string) => `<img src="${url}" alt="Contamination photo" style="max-width: 250px; max-height: 200px; border-radius: 4px; border: 1px solid #ddd;" />`).join("")}
            </div>
          `
              : ""
          }
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
        from: "Clews Recycling <onboarding@resend.dev>",
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
    console.error("Error sending contamination email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
