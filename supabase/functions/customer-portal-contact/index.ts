import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  customerId: string;
  customerName: string;
  userEmail: string;
  subject: string;
  message: string;
  urgency: "low" | "normal" | "high";
}

const subjectLabels: Record<string, string> = {
  general: "General Enquiry",
  billing: "Billing & Invoices",
  collection: "Collection Schedule",
  rebate: "Rebate Query",
  report: "Report Issue",
  complaint: "Complaint",
  other: "Other",
};

const urgencyLabels: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "HIGH - URGENT",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerId, customerName, userEmail, subject, message, urgency }: ContactRequest = await req.json();

    if (!customerName || !userEmail || !subject || !message) {
      throw new Error("Missing required fields");
    }

    const subjectLabel = subjectLabels[subject] || subject;
    const urgencyLabel = urgencyLabels[urgency] || urgency;

    const emailSubject = urgency === "high" 
      ? `[URGENT] Customer Portal: ${subjectLabel} - ${customerName}`
      : `Customer Portal: ${subjectLabel} - ${customerName}`;

    const emailResponse = await resend.emails.send({
      from: "Customer Portal <noreply@clewsrecycling.co.uk>",
      to: ["orders@clewsrecycling.co.uk"],
      reply_to: userEmail,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #333; margin: 0; font-size: 24px;">Customer Portal Request</h1>
          </div>
          
          <div style="padding: 20px; background-color: #ffffff; border: 1px solid #e9ecef; border-top: none;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>Customer:</strong></td>
                <td style="padding: 8px 0;">${customerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>From:</strong></td>
                <td style="padding: 8px 0;"><a href="mailto:${userEmail}">${userEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Subject:</strong></td>
                <td style="padding: 8px 0;">${subjectLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Urgency:</strong></td>
                <td style="padding: 8px 0;">
                  <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; ${
                    urgency === "high" 
                      ? "background-color: #fee2e2; color: #dc2626;" 
                      : urgency === "normal" 
                        ? "background-color: #fef3c7; color: #d97706;" 
                        : "background-color: #e0f2fe; color: #0284c7;"
                  }">${urgencyLabel}</span>
                </td>
              </tr>
            </table>
            
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">
            
            <h3 style="color: #333; margin-bottom: 10px;">Message:</h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap;">${message}</div>
          </div>
          
          <div style="padding: 15px 20px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This email was sent from the Clews Recycling Customer Portal. 
              Reply directly to this email to respond to the customer.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Customer portal email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in customer-portal-contact function:", error);
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
