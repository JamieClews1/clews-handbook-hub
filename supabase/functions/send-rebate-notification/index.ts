import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RebateNotificationRequest {
  to: string;
  subject: string;
  body: string;
  customerName: string;
  attachment?: {
    base64: string;
    filename: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { to, subject, body, customerName, attachment }: RebateNotificationRequest = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending rebate notification to ${to} for ${customerName}`);

    // Fetch email template from database
    const { data: templateData } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "rebate_notification")
      .single();

    const htmlBody = body.replace(/\n/g, "<br>");

    // Use template from DB or fall back to defaults
    let senderName = "Clews Recycling";
    let senderEmail = "accounts@noreply.clewsrecycling.co.uk";
    let emailHtml: string;

    if (templateData) {
      senderName = templateData.sender_name;
      senderEmail = templateData.sender_email;
      // Replace variables in the template
      emailHtml = templateData.body_html
        .replace(/\{\{body\}\}/g, htmlBody)
        .replace(/\{\{subject\}\}/g, subject)
        .replace(/\{\{customerName\}\}/g, customerName || "");
    } else {
      // Fallback if template not found
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f4f4f4; padding: 20px; border-bottom: 3px solid #22c55e;">
            <h1 style="color: #333; margin: 0; font-size: 24px;">Rebate Notification</h1>
          </div>
          <div style="padding: 20px; background-color: #ffffff;">
            <p style="font-size: 14px; line-height: 1.6; color: #333;">
              ${htmlBody}
            </p>
          </div>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            <p style="margin: 0;">Clews Recycling Limited</p>
            <p style="margin: 5px 0 0 0;">This is an automated message. Please do not reply directly to this email.</p>
          </div>
        </div>
      `;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const emailPayload: Record<string, unknown> = {
      from: `${senderName} <${senderEmail}>`,
      to: [to],
      cc: ["accounts@clewsrecycling.co.uk"],
      subject: subject,
      html: emailHtml,
    };

    if (attachment?.base64 && attachment?.filename) {
      emailPayload.attachments = [
        {
          filename: attachment.filename,
          content: attachment.base64,
        },
      ];
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const responseData = await emailResponse.json();
    console.log("Email sent successfully:", responseData);

    return new Response(JSON.stringify({ success: true, id: responseData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-rebate-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
