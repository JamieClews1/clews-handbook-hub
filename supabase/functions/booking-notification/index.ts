import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  requestType: string;
  customerName: string;
  siteName: string;
  containerType: string;
  wasteType: string;
  preferredDate: string | null;
  specialInstructions: string | null;
  bookingReference: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BookingNotificationRequest = await req.json();
    const { requestType, customerName, siteName, containerType, wasteType, preferredDate, specialInstructions, bookingReference } = body;

    if (!customerName || !siteName || !containerType) {
      throw new Error("Missing required fields");
    }

    const typeLabel = requestType === "exchange" ? "Exchange" : requestType === "collection" ? "Collection" : "New Service";
    const dateStr = preferredDate || "ASAP / Not specified";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">📦 New ${typeLabel} Request</h1>
          <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.8;">${bookingReference}</p>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280; width: 140px;">Customer</td><td style="padding: 8px 0; font-weight: 600;">${customerName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Site</td><td style="padding: 8px 0; font-weight: 600;">${siteName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Container</td><td style="padding: 8px 0;">${containerType}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Waste Type</td><td style="padding: 8px 0;">${wasteType}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Preferred Date</td><td style="padding: 8px 0;">${dateStr}</td></tr>
            ${specialInstructions ? `<tr><td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Notes</td><td style="padding: 8px 0;">${specialInstructions}</td></tr>` : ""}
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">Submitted via Customer Portal</p>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "Clews Portal <accounts@noreply.clewsrecycling.co.uk>",
      to: ["orders@clewsrecycling.co.uk"],
      subject: `${typeLabel} Request – ${customerName} – ${siteName} [${bookingReference}]`,
      html: emailHtml,
    });

    console.log("Booking notification sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending booking notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
