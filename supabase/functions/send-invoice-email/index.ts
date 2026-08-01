import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = "Clews Recycling Accounts <accounts@noreply.clewsrecycling.co.uk>";

type Payload = {
  invoiceId: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  pdfPath: string;
  fileName?: string;
  isReminder?: boolean;
};

async function fetchPdfBase64(path: string): Promise<string | null> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/invoices/${path}`, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  });
  if (!res.ok) {
    console.error("Invoice PDF download failed", res.status, await res.text());
    return null;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function htmlBody(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-wrap">${escaped}</div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    const { invoiceId, to, cc, subject, body, pdfPath, fileName, isReminder } = payload;

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "Missing recipient or subject" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const attachments: { filename: string; content: string }[] = [];
    if (pdfPath) {
      const content = await fetchPdfBase64(pdfPath);
      if (content) {
        attachments.push({ filename: fileName || "invoice.pdf", content });
      }
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        ...(cc ? { cc: [cc] } : {}),
        reply_to: "accounts@clewsrecycling.co.uk",
        subject,
        html: htmlBody(body || ""),
        attachments,
      }),
    });

    const emailJson = await emailRes.json();
    if (!emailRes.ok) {
      console.error("Resend error", emailJson);
      throw new Error(emailJson?.message || "Email provider rejected the message");
    }

    // Record the send against the invoice.
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (invoiceId && SUPABASE_URL && SERVICE_KEY) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.4");
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: current } = await admin
        .from("invoices")
        .select("send_count, status")
        .eq("id", invoiceId)
        .maybeSingle();

      const update: Record<string, unknown> = isReminder
        ? { last_reminder_at: new Date().toISOString() }
        : {
            sent_at: new Date().toISOString(),
            sent_to: to,
            send_count: Number(current?.send_count ?? 0) + 1,
          };
      // Leaving draft on first send.
      if (!isReminder && current?.status === "draft") update.status = "unpaid";

      await admin.from("invoices").update(update).eq("id", invoiceId);
    }

    return new Response(JSON.stringify({ success: true, id: emailJson?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-invoice-email error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
