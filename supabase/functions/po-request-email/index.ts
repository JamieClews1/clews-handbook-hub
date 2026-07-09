import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PORequestItem {
  siteName: string;
  wasteType: string;
  periodLabel?: string | null;
  jobCount: number;
  totalWeight: number;
  totalCost: number;
}

interface PORequestBody {
  customerName: string;
  siteName?: string | null;
  recipients: string[];
  requestedBy?: string;
  contactName?: string | null;
  items: PORequestItem[];
}

const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PORequestBody = await req.json();
    const { customerName, requestedBy, contactName, siteName } = body;

    const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
      .map((e) => e?.trim())
      .filter((e): e is string => !!e);

    const items = Array.isArray(body.items) ? body.items : [];

    if (!customerName || recipients.length === 0 || items.length === 0) {
      throw new Error("Missing required fields (customerName, recipients, items)");
    }

    const totalJobs = items.reduce((s, i) => s + (i.jobCount || 0), 0);
    const totalValue = items.reduce((s, i) => s + (i.totalCost || 0), 0);

    const rows = items
      .map(
        (i) => `
              <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e9ecef;">${i.siteName || "N/A"}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e9ecef;">${i.wasteType || "Unspecified waste"}</td>
                ${i.periodLabel ? `<td style="padding: 8px 10px; border-bottom: 1px solid #e9ecef;">${i.periodLabel}</td>` : `<td style="padding: 8px 10px; border-bottom: 1px solid #e9ecef;">-</td>`}
                <td style="padding: 8px 10px; border-bottom: 1px solid #e9ecef; text-align: center;">${i.jobCount}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e9ecef; text-align: right;">${(i.totalWeight || 0).toFixed(2)} t</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: bold;">${gbp(i.totalCost || 0)}</td>
              </tr>`
      )
      .join("");

    const emailResponse = await resend.emails.send({
      from: "Clews Recycling <orders@noreply.clewsrecycling.co.uk>",
      to: recipients,
      subject: `Purchase Order request - ${customerName}${siteName ? ` - ${siteName}` : ""} - ${totalJobs} job${totalJobs === 1 ? "" : "s"} outstanding`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto;">
          <div style="background-color: #16a34a; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">Purchase Order Request</h1>
          </div>

          <div style="padding: 20px; background-color: #ffffff; border: 1px solid #e9ecef; border-top: none;">
            <p style="margin: 0 0 12px; color: #333;">
              ${contactName ? `Dear ${contactName},` : "Hello,"}
            </p>
            <p style="margin: 0 0 12px; color: #333;">
              The following jobs for <strong>${customerName}${siteName ? ` - ${siteName}` : ""}</strong> are currently missing a Purchase Order number.
              Please could you provide the relevant PO number(s) so we can complete our records. One PO number can
              cover multiple jobs of the same waste type.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <thead>
                <tr style="background-color: #f8f9fa;">
                  <th style="padding: 8px 10px; text-align: left; border-bottom: 2px solid #e9ecef; color: #666;">Site</th>
                  <th style="padding: 8px 10px; text-align: left; border-bottom: 2px solid #e9ecef; color: #666;">Waste Type</th>
                  <th style="padding: 8px 10px; text-align: left; border-bottom: 2px solid #e9ecef; color: #666;">Period</th>
                  <th style="padding: 8px 10px; text-align: center; border-bottom: 2px solid #e9ecef; color: #666;">Jobs</th>
                  <th style="padding: 8px 10px; text-align: right; border-bottom: 2px solid #e9ecef; color: #666;">Weight</th>
                  <th style="padding: 8px 10px; text-align: right; border-bottom: 2px solid #e9ecef; color: #666;">Value</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr style="background-color: #f8f9fa; font-weight: bold;">
                  <td style="padding: 8px 10px;" colspan="3">Total</td>
                  <td style="padding: 8px 10px; text-align: center;">${totalJobs}</td>
                  <td style="padding: 8px 10px;"></td>
                  <td style="padding: 8px 10px; text-align: right;">${gbp(totalValue)}</td>
                </tr>
              </tfoot>
            </table>

            <p style="margin: 12px 0 0; color: #333;">
              Thank you,<br/>
              Clews Recycling Accounts Team
            </p>
          </div>

          <div style="padding: 15px 20px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This is an automated request sent from the Clews Recycling portal${requestedBy ? ` by ${requestedBy}` : ""}.
            </p>
          </div>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend returned an error:", emailResponse.error);
      throw new Error(emailResponse.error.message || "Failed to send email");
    }

    console.log("PO request email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, recipients, items: items.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in po-request-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
