import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  loadId: string;
  to: string;
  cc?: string;
  replyTo?: string;
  subject: string;
  body: string;
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function filenameFromPath(path: string, fallback: string) {
  const base = path.split("/").pop() || fallback;
  return base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY not configured");

    const payload = (await req.json()) as Payload;
    if (!payload.loadId || !payload.to || !payload.subject) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: load, error } = await supabase
      .from("container_loads")
      .select("*")
      .eq("id", payload.loadId)
      .single();
    if (error || !load) throw new Error(error?.message || "Load not found");

    // Gather attachments (photos + uploaded paperwork)
    const attachments: { filename: string; content: string }[] = [];

    const photos = Array.isArray(load.photos) ? load.photos : [];
    for (const [idx, p] of photos.entries()) {
      try {
        const content = await fetchAsBase64(p.url);
        attachments.push({
          filename: filenameFromPath(p.path, `photo-${idx + 1}.jpg`),
          content,
        });
      } catch (e) {
        console.warn("photo skipped", e);
      }
    }

    for (const kind of ["annex7_upload", "packing_upload"] as const) {
      const file = (load as any)[kind];
      if (file?.url) {
        try {
          const content = await fetchAsBase64(file.url);
          attachments.push({
            filename: file.name || filenameFromPath(file.path, `${kind}.pdf`),
            content,
          });
        } catch (e) {
          console.warn(`${kind} skipped`, e);
        }
      }
    }

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111;white-space:pre-wrap">${payload.body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</div>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#666;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
        Please reply to <a href="mailto:${payload.replyTo || "orders@clewsrecycling.co.uk"}">${payload.replyTo || "orders@clewsrecycling.co.uk"}</a> with any questions.
      </p>`;

    const ORDERS = "orders@clewsrecycling.co.uk";
    const toList = payload.to
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!toList.length) throw new Error("No recipient email provided");
    const ccList = (payload.cc || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // orders@ must always receive a copy
    if (
      !ccList.some((c) => c.toLowerCase() === ORDERS) &&
      !toList.some((t) => t.toLowerCase() === ORDERS)
    ) {
      ccList.push(ORDERS);
    }

    const emailPayload: any = {
      from: "Clews Recycling <noreply@noreply.clewsrecycling.co.uk>",
      to: toList,
      subject: payload.subject,
      html,
      reply_to: payload.replyTo || ORDERS,
      attachments,
    };
    if (ccList.length) emailPayload.cc = ccList;

    const logRow: Record<string, unknown> = {
      load_id: load.id,
      reference: load.reference,
      load_name: (load as any).load_name ?? null,
      to_email: toList.join(", "),
      cc_email: ccList.join(", "),

      reply_to_email: payload.replyTo || ORDERS,
      subject: payload.subject,
      body: payload.body,
      attachment_count: attachments.length,
      attachment_names: attachments.map((a) => a.filename),
    };

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const respText = await resp.text();
    if (!resp.ok) {
      console.error("resend error", resp.status, respText);
      await supabase
        .from("container_load_send_log")
        .insert({ ...logRow, status: "failed", error_message: respText.slice(0, 1000) });
      throw new Error(`Email send failed: ${respText}`);
    }

    await supabase
      .from("container_loads")
      .update({ sent_at: new Date().toISOString(), supplier_email: toList[0] })
      .eq("id", payload.loadId);

    await supabase.from("container_load_send_log").insert({ ...logRow, status: "sent" });

    return new Response(
      JSON.stringify({ ok: true, attachments: attachments.length, cc: ccList }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
