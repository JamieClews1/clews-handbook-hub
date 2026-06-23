import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type QuoteLine = {
  label: string;
  detail?: string;
  unitPrice: number;
  qty: number;
  total: number;
};

type Payload = {
  to: string;
  subject?: string;
  body?: string;
  customerName?: string;
  reference?: string;
  senderName?: string;
  intro?: string;
  rateCardName?: string;
  vatInclusive?: boolean;
  lines?: QuoteLine[];
  fuelNet?: number;
  subtotal?: number;
  vat?: number;
  total?: number;
  freeRentalWeeks?: number;
  rentalSkip?: number;
  rentalRoRo?: number;
  bespokeRules?: string;
  termsUrl?: string;
  attachmentPath?: string;
  attachmentName?: string;
};

// Download an attachment from the private storage bucket and base64-encode it for Resend.
async function buildAttachments(
  path?: string,
  name?: string,
): Promise<{ filename: string; content: string }[]> {
  if (!path) return [];
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return [];
  try {
    const fileRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/pricing-attachments/${path}`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
    );
    if (!fileRes.ok) {
      console.error("Attachment download failed:", fileRes.status, await fileRes.text());
      return [];
    }
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const filename = (name && name.trim()) ? name.trim() : (path.split("/").pop() || "attachment.pdf");
    return [{ filename, content: base64 }];
  } catch (e) {
    console.error("Attachment error:", (e as Error).message);
    return [];
  }
}

const money = (n: number) =>
  `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const p = (await req.json()) as Payload;

    const hasBody = typeof p.body === "string" && p.body.trim().length > 0;

    if (!p.to || (!hasBody && (!Array.isArray(p.lines) || p.lines.length === 0))) {
      return new Response(JSON.stringify({ error: "Missing recipient or quote content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    // When the client supplies an edited plain-text body, send that wrapped in the branded shell.
    if (hasBody) {
      const safe = esc(p.body as string)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#14532d;font-weight:600;">$1</a>')
        .replace(/\n/g, "<br/>");

      const htmlText = `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; background:#f5f5f5; padding:0;">
          <div style="background:#14532d; padding:22px 24px; text-align:center;">
            <h2 style="color:#ffffff; margin:0; font-size:20px;">Clews Recycling — Rate Proposal</h2>
          </div>
          <div style="padding:24px; background:#ffffff; border:1px solid #e0e0e0; border-top:none; color:#333; line-height:1.6; font-size:14px;">
            ${safe}
          </div>
          <div style="padding:16px; text-align:center; font-size:12px; color:#999;">Clews Recycling Limited</div>
        </div>
      `;

      const subjectText = (p.subject && p.subject.trim())
        ? p.subject.trim()
        : `Clews Recycling — Rate Proposal${p.reference ? ` (${p.reference})` : ""}`;

      const attachments = await buildAttachments(p.attachmentPath, p.attachmentName);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Clews Recycling <noreply@noreply.clewsrecycling.co.uk>",
          to: [p.to],
          subject: subjectText,
          html: htmlText,
          ...(attachments.length ? { attachments } : {}),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Resend error: ${errorText}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    const greetingName = p.customerName ? esc(p.customerName) : "there";
    const introText = (p.intro && p.intro.trim())
      ? p.intro.trim()
      : `Thank you for your enquiry. We're pleased to propose the following rates for your waste management requirements.`;

    const lineRows = p.lines
      .map(
        (l) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#111;">
              <span style="font-weight:600;">${esc(l.label)}</span>
              ${l.detail ? `<br/><span style="font-size:12px;color:#777;">${esc(l.detail)}</span>` : ""}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;color:#333;">${l.qty}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#333;">${money(l.unitPrice)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#111;">${money(l.total)}</td>
          </tr>`,
      )
      .join("");

    const vatNote = p.vatInclusive
      ? "Prices shown are inclusive of VAT."
      : "Prices shown are net of VAT.";

    const rentalBits: string[] = [];
    if (p.freeRentalWeeks != null) {
      rentalBits.push(
        `A free rental period of <strong>${p.freeRentalWeeks} week${p.freeRentalWeeks === 1 ? "" : "s"}</strong> is included.`,
      );
    }
    if (p.rentalSkip != null || p.rentalRoRo != null) {
      const parts: string[] = [];
      if (p.rentalSkip != null) parts.push(`${money(p.rentalSkip)} + VAT per week for skips`);
      if (p.rentalRoRo != null) parts.push(`${money(p.rentalRoRo)} + VAT per week for RoRo containers`);
      rentalBits.push(`After this period, rental is charged at ${parts.join(" and ")}.`);
    }

    const htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; background:#f5f5f5; padding:0;">
        <div style="background:#14532d; padding:22px 24px; text-align:center;">
          <h2 style="color:#ffffff; margin:0; font-size:20px;">Clews Recycling — Rate Proposal</h2>
        </div>

        <div style="padding:24px; background:#ffffff; border:1px solid #e0e0e0; border-top:none;">
          <p style="margin:0 0 12px; color:#333; line-height:1.6;">Dear ${greetingName},</p>
          <p style="margin:0 0 16px; color:#333; line-height:1.6;">${esc(introText)}</p>

          ${
            p.reference || p.rateCardName
              ? `<table style="margin:0 0 16px; border-collapse:collapse; font-size:13px;">
                  ${p.reference ? `<tr><td style="padding:2px 12px 2px 0;color:#777;">Quote reference</td><td style="padding:2px 0;color:#111;font-weight:600;">${esc(p.reference)}</td></tr>` : ""}
                  ${p.rateCardName ? `<tr><td style="padding:2px 12px 2px 0;color:#777;">Rate schedule</td><td style="padding:2px 0;color:#111;font-weight:600;">${esc(p.rateCardName)}</td></tr>` : ""}
                </table>`
              : ""
          }

          <table style="width:100%; border-collapse:collapse; margin:0 0 8px; font-size:13px;">
            <thead>
              <tr style="background:#f0f4f1;">
                <th style="padding:10px 12px;text-align:left;color:#14532d;border-bottom:2px solid #14532d;">Item</th>
                <th style="padding:10px 12px;text-align:center;color:#14532d;border-bottom:2px solid #14532d;">Qty</th>
                <th style="padding:10px 12px;text-align:right;color:#14532d;border-bottom:2px solid #14532d;">Unit</th>
                <th style="padding:10px 12px;text-align:right;color:#14532d;border-bottom:2px solid #14532d;">Total</th>
              </tr>
            </thead>
            <tbody>${lineRows}</tbody>
          </table>

          <table style="width:100%; border-collapse:collapse; margin:0 0 8px; font-size:13px;">
            ${
              p.fuelNet && p.fuelNet > 0
                ? `<tr><td style="padding:4px 12px;text-align:right;color:#777;">Fuel surcharge (net)</td><td style="padding:4px 12px;text-align:right;width:120px;color:#333;">${money(p.fuelNet)}</td></tr>`
                : ""
            }
            <tr><td style="padding:4px 12px;text-align:right;color:#777;">Subtotal (net)</td><td style="padding:4px 12px;text-align:right;width:120px;color:#333;">${money(p.subtotal)}</td></tr>
            <tr><td style="padding:4px 12px;text-align:right;color:#777;">VAT (20%)</td><td style="padding:4px 12px;text-align:right;color:#333;">${money(p.vat)}</td></tr>
            <tr><td style="padding:8px 12px;text-align:right;font-weight:700;color:#111;border-top:1px solid #ddd;">Total</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:#111;border-top:1px solid #ddd;">${money(p.total)}</td></tr>
          </table>

          <p style="margin:4px 0 18px; color:#999; font-size:12px;">${vatNote}</p>

          ${
            rentalBits.length
              ? `<div style="background:#f0f4f1; border-radius:6px; padding:14px 16px; margin:0 0 16px;">
                  <h3 style="margin:0 0 6px; color:#14532d; font-size:14px;">Container rental</h3>
                  <p style="margin:0; color:#333; line-height:1.6; font-size:13px;">${rentalBits.join(" ")}</p>
                </div>`
              : ""
          }

          ${
            p.bespokeRules && p.bespokeRules.trim()
              ? `<div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:6px; padding:14px 16px; margin:0 0 16px;">
                  <h3 style="margin:0 0 6px; color:#9a3412; font-size:14px;">Important — waste acceptance</h3>
                  <p style="margin:0; color:#7c2d12; line-height:1.6; font-size:13px;">${esc(p.bespokeRules)}</p>
                </div>`
              : ""
          }

          ${
            p.termsUrl
              ? `<p style="margin:0 0 16px; color:#333; line-height:1.6; font-size:13px;">This proposal is subject to our standard terms and conditions, which you can review here: <a href="${esc(p.termsUrl)}" style="color:#14532d; font-weight:600;">${esc(p.termsUrl)}</a></p>`
              : ""
          }

          <p style="margin:0 0 4px; color:#333; line-height:1.6;">We look forward to working with you. Please don't hesitate to get in touch if you have any questions.</p>
          <p style="margin:16px 0 0; color:#333; line-height:1.6;">Kind regards,<br/>${p.senderName ? esc(p.senderName) + "<br/>" : ""}Clews Recycling</p>
        </div>

        <div style="padding:16px; text-align:center; font-size:12px; color:#999;">
          Clews Recycling Limited
        </div>
      </div>
    `;

    const subject = `Clews Recycling — Rate Proposal${p.reference ? ` (${p.reference})` : ""}`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Clews Recycling <noreply@noreply.clewsrecycling.co.uk>",
        to: [p.to],
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
    console.error("Error sending quote email:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
