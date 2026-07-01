import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface POChangeRequest {
  notificationEmail?: string;
  customerName: string;
  siteName: string;
  jobNumber: string;
  jobDate: string;
  oldPONumber: string | null;
  newPONumber: string;
  changedBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      customerName,
      siteName,
      jobNumber,
      jobDate,
      oldPONumber,
      newPONumber,
      changedBy,
    }: POChangeRequest = await req.json();

    if (!customerName || !jobNumber || !newPONumber) {
      throw new Error("Missing required fields");
    }

    // Check whether PO notifications are enabled
    const { data: config } = await supabase
      .from("po_notification_config")
      .select("enabled")
      .eq("id", true)
      .maybeSingle();

    if (config && config.enabled === false) {
      console.log("PO notifications are disabled — skipping email.");
      return new Response(JSON.stringify({ success: true, skipped: "disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch active recipients configured in Settings
    const { data: recipientRows } = await supabase
      .from("po_notification_recipients")
      .select("email")
      .eq("is_active", true);

    let recipients = (recipientRows ?? [])
      .map((r: { email: string }) => r.email?.trim())
      .filter((e: string) => !!e);

    // Fallback to the default orders inbox if none configured
    if (recipients.length === 0) {
      recipients = ["orders@clewsrecycling.co.uk"];
    }

    console.log("Sending PO change notification to:", recipients.join(", "));

    const emailSubject = `PO Number Updated - ${customerName} - Job ${jobNumber}`;

    const emailResponse = await resend.emails.send({
      from: "Customer Portal <accounts@noreply.clewsrecycling.co.uk>",
      to: recipients,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #16a34a; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">PO Number Updated</h1>
          </div>
          
          <div style="padding: 20px; background-color: #ffffff; border: 1px solid #e9ecef; border-top: none;">
            <p style="margin: 0 0 20px; color: #666;">A customer has updated a PO number via the Customer Portal.</p>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; color: #666; width: 140px; border-bottom: 1px solid #e9ecef;"><strong>Customer:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">${customerName}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #666; border-bottom: 1px solid #e9ecef;"><strong>Site:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">${siteName || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #666; border-bottom: 1px solid #e9ecef;"><strong>Job Number:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-family: monospace;">${jobNumber}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #666; border-bottom: 1px solid #e9ecef;"><strong>Job Date:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">${jobDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #666; border-bottom: 1px solid #e9ecef;"><strong>Previous PO:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-family: monospace;">${oldPONumber || "<em>Not set</em>"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #666; border-bottom: 1px solid #e9ecef;"><strong>New PO:</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #e9ecef; font-family: monospace; color: #16a34a; font-weight: bold;">${newPONumber}</td>
              </tr>
              <tr>
                <td style="padding: 10px; color: #666;"><strong>Changed By:</strong></td>
                <td style="padding: 10px;">${changedBy}</td>
              </tr>
            </table>
          </div>
          
          <div style="padding: 15px 20px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This is an automated notification from the Clews Recycling Customer Portal.
            </p>
          </div>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend returned an error:", emailResponse.error);
      throw new Error(emailResponse.error.message || "Failed to send email");
    }

    console.log("PO change notification sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in po-change-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
