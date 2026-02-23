import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the report
    const { data: report, error: reportError } = await supabase
      .from("stock_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: "Report not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get line items
    const { data: items } = await supabase
      .from("stock_report_items")
      .select("*")
      .eq("stock_report_id", reportId)
      .order("display_order");

    // Get active email recipients
    const { data: recipients } = await supabase
      .from("stock_report_email_settings")
      .select("*")
      .eq("is_active", true);

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active recipients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email HTML
    const itemRows = (items || [])
      .filter((i: any) => i.on_stock > 0 || i.out > 0)
      .map(
        (i: any) =>
          `<tr><td style="padding:6px 12px;border:1px solid #ddd;">${i.material}</td><td style="padding:6px 12px;border:1px solid #ddd;text-align:center;">${i.on_stock}</td><td style="padding:6px 12px;border:1px solid #ddd;text-align:center;">${i.out}</td></tr>`
      )
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">Stock Report</h2>
        <p><strong>Date:</strong> ${report.report_date}</p>
        <p><strong>Operator:</strong> ${report.operator_name}</p>
        <p><strong>Totals:</strong> On Stock: ${report.total_on_stock} | Out: ${report.total_out}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Material</th>
              <th style="padding:8px 12px;border:1px solid #ddd;text-align:center;">On Stock</th>
              <th style="padding:8px 12px;border:1px solid #ddd;text-align:center;">Out</th>
            </tr>
          </thead>
          <tbody>${itemRows || '<tr><td colspan="3" style="padding:8px;text-align:center;">No items</td></tr>'}</tbody>
        </table>
      </div>
    `;

    if (!resendApiKey) {
      console.log("RESEND_API_KEY not set, skipping email");
      return new Response(
        JSON.stringify({ message: "Email skipped - no API key" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toEmails = recipients.map((r: any) => r.email);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Clews Recycling <noreply@updates.clewsrecycling.co.uk>",
        to: toEmails,
        subject: `Stock Report - ${report.report_date} - ${report.operator_name}`,
        html,
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(
      JSON.stringify({ success: true, emailResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
