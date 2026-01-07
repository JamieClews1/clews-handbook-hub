import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MailgunWebhookPayload {
  sender: string;
  from: string;
  subject: string;
  "body-plain"?: string;
  "body-html"?: string;
  "stripped-text"?: string;
  attachments?: string;
  "attachment-count"?: string;
  "message-headers"?: string;
  recipient: string;
  timestamp: string;
  token: string;
  signature: string;
}

async function fetchCompanyProfile(supabase: any) {
  const { data, error } = await supabase
    .from("company_profile")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching company profile:", error);
    return null;
  }
  return data;
}

async function analyzeFormWithAI(formContent: string, companyProfile: any): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const profileData = companyProfile ? `
Company Information Available:
- Company Name: ${companyProfile.company_name || "N/A"}
- Trading Name: ${companyProfile.trading_name || "N/A"}
- Company Registration Number: ${companyProfile.company_registration_number || "N/A"}
- VAT Number: ${companyProfile.vat_number || "N/A"}
- SIC Code: ${companyProfile.sic_code || "N/A"}
- Date of Incorporation: ${companyProfile.date_of_incorporation || "N/A"}
- Registered Address: ${companyProfile.registered_address || "N/A"}
- Operational Address: ${companyProfile.operational_address || "N/A"}
- Telephone: ${companyProfile.telephone || "N/A"}
- Email: ${companyProfile.email || "N/A"}
- Website: ${companyProfile.website || "N/A"}
- Bank Name: ${companyProfile.bank_name || "N/A"}
- Bank Account Name: ${companyProfile.bank_account_name || "N/A"}
- Bank Account Number: ${companyProfile.bank_account_number || "N/A"}
- Bank Sort Code: ${companyProfile.bank_sort_code || "N/A"}
- Bank IBAN: ${companyProfile.bank_iban || "N/A"}
- Bank SWIFT/BIC: ${companyProfile.bank_swift_bic || "N/A"}
- Credit Terms: ${companyProfile.credit_terms || "N/A"}
- Waste Carriers Licence Number: ${companyProfile.waste_carriers_licence_number || "N/A"}
- Waste Carriers Licence Expiry: ${companyProfile.waste_carriers_licence_expiry || "N/A"}
- Environment Agency Reference: ${companyProfile.environment_agency_reference || "N/A"}
- Public Liability Insurance Provider: ${companyProfile.public_liability_insurance_provider || "N/A"}
- Public Liability Insurance Expiry: ${companyProfile.public_liability_insurance_expiry || "N/A"}
- Employers Liability Insurance Provider: ${companyProfile.employers_liability_insurance_provider || "N/A"}
- Employers Liability Insurance Expiry: ${companyProfile.employers_liability_insurance_expiry || "N/A"}
- ISO 9001 Certified: ${companyProfile.iso_9001_certified ? "Yes" : "No"}
- ISO 14001 Certified: ${companyProfile.iso_14001_certified ? "Yes" : "No"}
- Health & Safety Policy: ${companyProfile.health_safety_policy ? "Yes" : "No"}
- Environmental Policy: ${companyProfile.environmental_policy ? "Yes" : "No"}
` : "No company profile data available.";

  const systemPrompt = `You are an expert form-filling assistant. Your task is to analyze incoming form documents and identify fields that can be auto-filled using the provided company information.

${profileData}

When analyzing forms:
1. Identify all form fields that require input
2. Match fields to available company data
3. For each identified field, provide the appropriate value from the company profile
4. If a field cannot be auto-filled, mark it as "[REQUIRES MANUAL INPUT]"
5. Preserve the original form structure as much as possible

Return your analysis in a clear, structured format showing:
- Field Name → Suggested Value (or [REQUIRES MANUAL INPUT])
- Any notes about fields that need human review`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please analyze this form/document and identify which fields can be auto-filled:\n\n${formContent}` }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Unable to analyze form";
}

async function sendResponseEmail(resend: any, toEmail: string, subject: string, analysis: string, originalSubject: string) {
  const { data, error } = await resend.emails.send({
    from: "Clews Form Assistant <noreply@noreply.clewsrecycling.co.uk>",
    to: [toEmail],
    subject: `RE: ${originalSubject} - Form Analysis Complete`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #1a5f2a; color: white; padding: 20px; }
          .content { padding: 20px; }
          .analysis { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Clews Form Assistant</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We have analyzed the form you sent and identified the following fields that can be auto-filled from our company records:</p>
          
          <div class="analysis">
            <h3>Form Analysis Results:</h3>
            <pre>${analysis}</pre>
          </div>
          
          <p><strong>Note:</strong> Fields marked as [REQUIRES MANUAL INPUT] need to be completed manually as we don't have this information on file.</p>
          
          <p>If you need any changes to the company information, please update it in the Duty of Care portal.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from Clews Recycling Form Assistant.</p>
          <p>© ${new Date().getFullYear()} Clews Recycling Ltd</p>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error("Error sending email:", error);
    throw error;
  }

  console.log("Response email sent:", data);
  return data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received webhook request");
    console.log("Method:", req.method);
    console.log("Headers:", Object.fromEntries(req.headers.entries()));

    // Parse form data from Mailgun webhook
    const contentType = req.headers.get("content-type") || "";
    let webhookData: MailgunWebhookPayload;

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      webhookData = {
        sender: formData.get("sender") as string || "",
        from: formData.get("from") as string || "",
        subject: formData.get("subject") as string || "",
        "body-plain": formData.get("body-plain") as string || "",
        "body-html": formData.get("body-html") as string || "",
        "stripped-text": formData.get("stripped-text") as string || "",
        attachments: formData.get("attachments") as string || "",
        "attachment-count": formData.get("attachment-count") as string || "0",
        recipient: formData.get("recipient") as string || "",
        timestamp: formData.get("timestamp") as string || "",
        token: formData.get("token") as string || "",
        signature: formData.get("signature") as string || "",
      };

      // Log attachment info
      const attachmentCount = parseInt(webhookData["attachment-count"] || "0");
      console.log(`Received ${attachmentCount} attachments`);
      
      // Get actual attachment files if present
      for (let i = 1; i <= attachmentCount; i++) {
        const attachment = formData.get(`attachment-${i}`);
        if (attachment && attachment instanceof File) {
          console.log(`Attachment ${i}: ${attachment.name}, ${attachment.type}, ${attachment.size} bytes`);
        }
      }
    } else {
      webhookData = await req.json();
    }

    console.log("Webhook data received:");
    console.log("From:", webhookData.from);
    console.log("Subject:", webhookData.subject);
    console.log("Body length:", webhookData["body-plain"]?.length || 0);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    const resend = new Resend(resendApiKey);

    // Fetch company profile
    const companyProfile = await fetchCompanyProfile(supabase);
    console.log("Company profile fetched:", companyProfile?.company_name);

    // Get the content to analyze
    const contentToAnalyze = webhookData["stripped-text"] || webhookData["body-plain"] || webhookData["body-html"] || "";

    if (!contentToAnalyze) {
      console.log("No content to analyze in the email");
      return new Response(JSON.stringify({ success: true, message: "No content to analyze" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze form with AI
    console.log("Analyzing form content with AI...");
    const analysis = await analyzeFormWithAI(contentToAnalyze, companyProfile);
    console.log("AI analysis complete");

    // Extract sender email - handle various formats safely
    const fromField = webhookData.from || webhookData.sender || "";
    const emailMatch = fromField.match(/<(.+)>/);
    const senderEmail = emailMatch?.[1] || fromField;
    
    if (!senderEmail) {
      console.log("No sender email found, cannot send response");
      return new Response(JSON.stringify({ success: true, message: "Processed but no sender to reply to" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Sending response to:", senderEmail);

    // Send response email
    await sendResponseEmail(resend, senderEmail, webhookData.subject, analysis, webhookData.subject);

    return new Response(
      JSON.stringify({ success: true, message: "Form processed and response sent" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing form email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
