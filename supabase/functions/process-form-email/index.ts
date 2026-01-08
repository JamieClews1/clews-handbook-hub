import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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

interface CellMapping {
  cell: string;
  field: string;
  value: string;
}

interface AttachmentInfo {
  file: File;
  name: string;
  type: string;
  content: Uint8Array;
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

function getCompanyProfileData(companyProfile: any): Record<string, string> {
  if (!companyProfile) return {};
  
  return {
    "company_name": companyProfile.company_name || "",
    "trading_name": companyProfile.trading_name || "",
    "company_registration_number": companyProfile.company_registration_number || "",
    "vat_number": companyProfile.vat_number || "",
    "sic_code": companyProfile.sic_code || "",
    "date_of_incorporation": companyProfile.date_of_incorporation || "",
    "registered_address": companyProfile.registered_address || "",
    "operational_address": companyProfile.operational_address || "",
    "telephone": companyProfile.telephone || "",
    "email": companyProfile.email || "",
    "website": companyProfile.website || "",
    "bank_name": companyProfile.bank_name || "",
    "bank_account_name": companyProfile.bank_account_name || "",
    "bank_account_number": companyProfile.bank_account_number || "",
    "bank_sort_code": companyProfile.bank_sort_code || "",
    "bank_iban": companyProfile.bank_iban || "",
    "bank_swift_bic": companyProfile.bank_swift_bic || "",
    "credit_terms": companyProfile.credit_terms || "",
    "waste_carriers_licence_number": companyProfile.waste_carriers_licence_number || "",
    "waste_carriers_licence_expiry": companyProfile.waste_carriers_licence_expiry || "",
    "environment_agency_reference": companyProfile.environment_agency_reference || "",
    "public_liability_insurance_provider": companyProfile.public_liability_insurance_provider || "",
    "public_liability_insurance_expiry": companyProfile.public_liability_insurance_expiry || "",
    "employers_liability_insurance_provider": companyProfile.employers_liability_insurance_provider || "",
    "employers_liability_insurance_expiry": companyProfile.employers_liability_insurance_expiry || "",
    "iso_9001_certified": companyProfile.iso_9001_certified ? "Yes" : "No",
    "iso_14001_certified": companyProfile.iso_14001_certified ? "Yes" : "No",
    "health_safety_policy": companyProfile.health_safety_policy ? "Yes" : "No",
    "environmental_policy": companyProfile.environmental_policy ? "Yes" : "No",
  };
}

async function analyzeExcelForMapping(workbook: XLSX.WorkBook, companyProfile: any): Promise<CellMapping[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  // Extract all cell contents from the workbook
  const cellData: { sheet: string; cell: string; value: string }[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = sheet[cellAddress];
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          cellData.push({
            sheet: sheetName,
            cell: cellAddress,
            value: String(cell.v)
          });
        }
      }
    }
  }

  const profileData = getCompanyProfileData(companyProfile);
  const profileDataStr = Object.entries(profileData)
    .map(([key, value]) => `- ${key}: ${value || "N/A"}`)
    .join("\n");

  const cellDataStr = cellData
    .map(c => `Sheet: ${c.sheet}, Cell: ${c.cell}, Content: "${c.value}"`)
    .join("\n");

  const systemPrompt = `You are an expert at analyzing spreadsheet forms and identifying cells that need to be filled with company data.

Available Company Data:
${profileDataStr}

Analyze the spreadsheet cells provided and identify which cells should be filled with company data. 
Look for labels like "Company Name", "VAT", "Bank Details", "Address", etc., and find the adjacent cell (usually to the right or below) where the value should go.

Return a JSON array of cell mappings. Each mapping should have:
- "cell": The cell address where the value should be inserted (e.g., "B5", "C10")
- "field": The company data field key that matches (e.g., "company_name", "vat_number")
- "value": The actual value to insert from the company data

IMPORTANT:
- Only include cells that have a clear label indicating what data goes there
- The "cell" should be where the VALUE goes, not where the label is
- If a cell already contains a value that looks like an answer, skip it
- Look for patterns like "Company Name:" in cell A5 means the answer goes in B5
- For bank details, look for sort code, account number, bank name separately
- Return ONLY a valid JSON array, no explanation text

Example response:
[
  {"cell": "B5", "field": "company_name", "value": "Clews Recycling Ltd"},
  {"cell": "B6", "field": "vat_number", "value": "747-3166-19"}
]`;

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
        { role: "user", content: `Analyze these spreadsheet cells and identify where to fill company data:\n\n${cellDataStr}` }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices?.[0]?.message?.content || "[]";
  
  console.log("AI mapping response:", aiResponse);
  
  // Parse the JSON response
  try {
    // Clean up the response - remove markdown code blocks if present
    let cleanResponse = aiResponse.trim();
    if (cleanResponse.startsWith("```json")) {
      cleanResponse = cleanResponse.slice(7);
    }
    if (cleanResponse.startsWith("```")) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith("```")) {
      cleanResponse = cleanResponse.slice(0, -3);
    }
    
    const mappings = JSON.parse(cleanResponse.trim());
    return Array.isArray(mappings) ? mappings : [];
  } catch (e) {
    console.error("Failed to parse AI mapping response:", e);
    return [];
  }
}

function fillExcelWithMappings(workbook: XLSX.WorkBook, mappings: CellMapping[]): XLSX.WorkBook {
  console.log(`Filling ${mappings.length} cells with company data`);
  
  for (const mapping of mappings) {
    // Default to first sheet if not specified
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    if (sheet && mapping.cell && mapping.value) {
      console.log(`Setting ${mapping.cell} = "${mapping.value}" (${mapping.field})`);
      sheet[mapping.cell] = { t: 's', v: mapping.value };
    }
  }
  
  return workbook;
}

async function analyzeFormWithAI(formContent: string, companyProfile: any): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const profileData = getCompanyProfileData(companyProfile);
  const profileDataStr = Object.entries(profileData)
    .map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value || "N/A"}`)
    .join("\n");

  const systemPrompt = `You are an expert form-filling assistant. Your task is to analyze incoming form documents and identify fields that can be auto-filled using the provided company information.

Company Information Available:
${profileDataStr}

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

async function sendResponseEmailWithAttachment(
  resend: any, 
  toEmail: string, 
  analysis: string, 
  originalSubject: string,
  attachment?: { filename: string; content: string }
) {
  const attachments = attachment ? [{
    filename: attachment.filename,
    content: attachment.content,
  }] : [];

  const attachmentNote = attachment 
    ? `<p><strong>📎 Completed Form Attached:</strong> We have auto-filled your form with our company information. Please find the completed document attached to this email.</p>`
    : `<p><strong>Note:</strong> We analyzed your form but could not auto-fill it. Please see the field mappings below.</p>`;

  const { data, error } = await resend.emails.send({
    from: "Clews Form Assistant <noreply@noreply.clewsrecycling.co.uk>",
    to: [toEmail],
    subject: `RE: ${originalSubject} - Form Completed`,
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
          .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Clews Form Assistant</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          
          ${attachment ? `
          <div class="success">
            <h3>✅ Form Auto-Filled Successfully!</h3>
            <p>Your form has been automatically filled with our company information. Please find the completed document attached.</p>
          </div>
          ` : ''}
          
          ${attachmentNote}
          
          <div class="analysis">
            <h3>Fields Identified:</h3>
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
    attachments: attachments,
  });

  if (error) {
    console.error("Error sending email:", error);
    throw error;
  }

  console.log("Response email sent:", data);
  return data;
}

async function processExcelAttachment(
  attachment: AttachmentInfo, 
  companyProfile: any
): Promise<{ workbook: XLSX.WorkBook; mappings: CellMapping[]; base64: string } | null> {
  try {
    console.log(`Processing Excel file: ${attachment.name}`);
    
    // Read the workbook
    const workbook = XLSX.read(attachment.content, { type: 'array' });
    console.log(`Workbook has ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(', ')}`);
    
    // Analyze and get cell mappings from AI
    const mappings = await analyzeExcelForMapping(workbook, companyProfile);
    console.log(`AI identified ${mappings.length} cells to fill`);
    
    if (mappings.length === 0) {
      console.log("No mappings found, returning null");
      return null;
    }
    
    // Fill the workbook with the mappings
    const filledWorkbook = fillExcelWithMappings(workbook, mappings);
    
    // Write to buffer
    const outputBuffer = XLSX.write(filledWorkbook, { type: 'base64', bookType: 'xlsx' });
    
    return {
      workbook: filledWorkbook,
      mappings,
      base64: outputBuffer
    };
  } catch (error) {
    console.error("Error processing Excel:", error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received webhook request");
    console.log("Method:", req.method);

    // Parse form data from Mailgun webhook
    const contentType = req.headers.get("content-type") || "";
    let webhookData: MailgunWebhookPayload;
    const attachments: AttachmentInfo[] = [];

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

      // Get actual attachment files if present
      const attachmentCount = parseInt(webhookData["attachment-count"] || "0");
      console.log(`Received ${attachmentCount} attachments`);
      
      for (let i = 1; i <= attachmentCount; i++) {
        const attachment = formData.get(`attachment-${i}`);
        if (attachment && attachment instanceof File) {
          console.log(`Attachment ${i}: ${attachment.name}, ${attachment.type}, ${attachment.size} bytes`);
          const arrayBuffer = await attachment.arrayBuffer();
          attachments.push({
            file: attachment,
            name: attachment.name,
            type: attachment.type,
            content: new Uint8Array(arrayBuffer)
          });
        }
      }
    } else {
      webhookData = await req.json();
    }

    console.log("Webhook data received:");
    console.log("From:", webhookData.from);
    console.log("Subject:", webhookData.subject);
    console.log("Attachments found:", attachments.length);

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

    // Extract sender email - handle various formats safely
    const fromField = webhookData.from || webhookData.sender || "";
    const emailMatch = fromField.match(/<([^>]+)>/);
    const simpleEmailMatch = fromField.match(/[\w.-]+@[\w.-]+\.\w+/);
    const senderEmail = emailMatch?.[1] || simpleEmailMatch?.[0] || "";
    
    if (!senderEmail || !senderEmail.includes("@")) {
      console.log("No valid sender email found, cannot send response. From field:", fromField);
      return new Response(JSON.stringify({ success: true, message: "Processed but no valid sender email to reply to" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Sending response to:", senderEmail);

    // Check for Excel attachments
    const excelAttachment = attachments.find(a => 
      a.name.endsWith('.xlsx') || 
      a.name.endsWith('.xls') ||
      a.type.includes('spreadsheet') ||
      a.type.includes('excel')
    );

    let analysis = "";
    let completedAttachment: { filename: string; content: string } | undefined;

    if (excelAttachment) {
      console.log("Processing Excel attachment:", excelAttachment.name);
      
      const result = await processExcelAttachment(excelAttachment, companyProfile);
      
      if (result && result.mappings.length > 0) {
        // Create analysis text from mappings
        analysis = result.mappings
          .map(m => `• ${m.field.replace(/_/g, ' ')}: ${m.value}`)
          .join("\n");
        
        completedAttachment = {
          filename: `Completed_${excelAttachment.name}`,
          content: result.base64
        };
        
        console.log("Excel file filled and ready to send");
      } else {
        // Fallback to text analysis
        const contentToAnalyze = webhookData["stripped-text"] || webhookData["body-plain"] || webhookData["body-html"] || "";
        analysis = await analyzeFormWithAI(contentToAnalyze, companyProfile);
      }
    } else {
      // No Excel - do text analysis
      const contentToAnalyze = webhookData["stripped-text"] || webhookData["body-plain"] || webhookData["body-html"] || "";
      
      if (!contentToAnalyze) {
        console.log("No content to analyze in the email");
        return new Response(JSON.stringify({ success: true, message: "No content to analyze" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log("Analyzing form content with AI...");
      analysis = await analyzeFormWithAI(contentToAnalyze, companyProfile);
    }

    console.log("AI analysis complete");

    // Send response email (with attachment if available)
    await sendResponseEmailWithAttachment(
      resend, 
      senderEmail, 
      analysis, 
      webhookData.subject,
      completedAttachment
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: completedAttachment 
          ? "Form filled and sent with attachment" 
          : "Form analyzed and response sent" 
      }),
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
