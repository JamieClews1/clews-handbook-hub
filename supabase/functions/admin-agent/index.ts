import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Verify the user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Check if user is management
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, user_types")
      .eq("id", user.id)
      .single();

    const isManagement = profile?.user_types?.includes("management");
    if (!isManagement) throw new Error("Access denied - management only");

    const { messages, action, actionData } = await req.json();

    // If this is an action execution request
    if (action === "create_load_reports") {
      const result = await createLoadReports(adminClient, actionData, user.id, profile?.full_name || "Agent");
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise, it's a chat request - use AI to understand intent
    const systemPrompt = `You are an AI admin assistant for a waste management portal called "One Portal". You help with administrative tasks.

Your capabilities:
1. **Create Load Reports** - When given Excel/spreadsheet data containing load information (dates, job numbers, weights, pallets), you can create load reports in bulk.

When the user provides spreadsheet data for creating load reports, respond with a JSON action block like this:
\`\`\`action
{
  "action": "create_load_reports",
  "reports": [
    {
      "report_date": "YYYY-MM-DD",
      "job_number": "string",
      "order_number": "string or null",
      "total_weight_kg": number,
      "total_pallets": number,
      "pallet_weight_kg": number,
      "net_weight_kg": number,
      "site_id": "uuid or null"
    }
  ],
  "site_name": "name of the site/customer if mentioned"
}
\`\`\`

Important rules:
- Dates in Excel are often DD/MM/YYYY - convert to YYYY-MM-DD format
- Weight in spreadsheets may be in tonnes - convert to KG (multiply by 1000)
- Always confirm the number of reports you'll create before the user confirms
- If a site/customer is mentioned, note it so we can match it to a site_id
- Ask for clarification if the data is ambiguous

If the user asks about something you can't do yet, explain what you can currently help with.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function createLoadReports(
  supabase: any,
  data: { reports: any[]; site_id?: string; operator_id: string; operator_name: string },
  userId: string,
  userName: string,
) {
  const results: { created: number; errors: string[] } = { created: 0, errors: [] };

  for (const report of data.reports) {
    try {
      // Parse date - handle DD/MM/YYYY format
      let reportDate = report.report_date;
      if (reportDate && reportDate.includes("/")) {
        const parts = reportDate.split("/");
        if (parts.length === 3) {
          reportDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }

      const totalWeightKg = report.total_weight_kg || (report.weight_t ? report.weight_t * 1000 : 0);
      const totalPallets = report.total_pallets || report.number_of_pallets || 0;

      const { data: newReport, error: reportError } = await supabase
        .from("load_reports")
        .insert({
          operator_id: userId,
          operator_name: userName,
          notes: report.job_number?.toString() || null,
          site_id: data.site_id || report.site_id || null,
          report_date: reportDate,
          status: "submitted",
          total_pallets: totalPallets,
          total_weight_kg: totalWeightKg,
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (reportError) {
        results.errors.push(`Job ${report.job_number}: ${reportError.message}`);
        continue;
      }

      // Create a line item for the full load using the waste type from the data
      if (newReport) {
        const wasteType = report.waste_type || "Card Loose";
        await supabase.from("load_line_items").insert({
          load_report_id: newReport.id,
          waste_type: wasteType,
          pallet_count: totalPallets,
          avg_weight_kg: totalPallets > 0 ? totalWeightKg / totalPallets : totalWeightKg,
          total_weight_kg: totalWeightKg,
          display_order: 0,
        });
      }

      results.created++;
    } catch (err: any) {
      results.errors.push(`Job ${report.job_number}: ${err.message}`);
    }
  }

  return results;
}
