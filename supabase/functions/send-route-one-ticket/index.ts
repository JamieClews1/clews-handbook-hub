const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Attachment {
  filename: string;
  url?: string;
  content?: string; // base64
}

interface Payload {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  replyTo?: string;
  attachments?: Attachment[];
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY not configured");

    const payload = (await req.json()) as Payload;
    if (!payload?.to || !payload?.subject) {
      return new Response(JSON.stringify({ error: "Missing recipient or subject" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attachments: { filename: string; content: string }[] = [];
    for (const a of payload.attachments ?? []) {
      try {
        const content = a.content ?? (a.url ? await fetchAsBase64(a.url) : null);
        if (content) attachments.push({ filename: a.filename, content });
      } catch (e) {
        console.warn("attachment skipped", a.filename, e);
      }
    }

    const replyTo = payload.replyTo || "orders@clewsrecycling.co.uk";
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111;white-space:pre-wrap">${esc(payload.body || "")}</div>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
        Please reply to <a href="mailto:${replyTo}">${replyTo}</a> with any questions.
      </p>`;

    const emailPayload: Record<string, unknown> = {
      from: "Clews Recycling <noreply@noreply.clewsrecycling.co.uk>",
      to: [payload.to],
      subject: payload.subject,
      html,
      reply_to: replyTo,
      attachments,
    };
    if (payload.cc) {
      const list = payload.cc.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length) emailPayload.cc = list;
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result?.message || "Resend error");

    return new Response(JSON.stringify({ success: true, id: result.id, attachments: attachments.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-route-one-ticket", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
