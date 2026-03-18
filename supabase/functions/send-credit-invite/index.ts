import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, shareToken, applicationId } = await req.json();

    if (!email || !shareToken || !applicationId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update the application with invited email
    await supabase
      .from("credit_account_applications")
      .update({ invited_email: email })
      .eq("id", applicationId);

    // Build the application link
    // Use the published URL or fallback
    const siteUrl = "https://clewshandbook.lovable.app";
    const applicationLink = `${siteUrl}/credit-application/${shareToken}`;

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "accounts@noreply.clewsrecycling.co.uk",
        to: [email],
        subject: "Clews Recycling – Credit Account Application",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #1a1a1a; margin: 0;">Clews Recycling</h2>
              <p style="color: #666; font-size: 14px;">Unit 17, Hunters Lane, Rugby, CV21 1EA</p>
            </div>
            
            <h3 style="color: #1a1a1a;">Credit Account Application</h3>
            
            <p style="color: #333; line-height: 1.6;">
              Thank you for your interest in opening a credit account with Clews Recycling.
            </p>
            
            <p style="color: #333; line-height: 1.6;">
              Please click the button below to complete your credit account application form. 
              Once submitted, our accounts team will review your application and get back to you.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${applicationLink}" 
                 style="background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Complete Application
              </a>
            </div>
            
            <p style="color: #666; font-size: 13px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${applicationLink}" style="color: #16a34a;">${applicationLink}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              Clews Recycling Ltd | Company No 3856771 | VAT No 747 3166 19<br>
              Waste Carriers No. CBDU203180<br>
              Tel: 01788 541549 | www.clewsrecycling.co.uk
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      throw new Error(`Resend API error: ${emailRes.status} ${errBody}`);
    }

    await emailRes.json();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending credit invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
