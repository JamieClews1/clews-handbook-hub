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

    if (action === "update_load_reports") {
      const result = await updateLoadReports(adminClient, actionData);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_load_reports") {
      const result = await deleteLoadReports(adminClient, actionData);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "query_reports") {
      const result = await queryReports(adminClient, actionData);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise, it's a chat request - use AI to understand intent
    const systemPrompt = `You are a friendly admin assistant bot for "One Portal", a waste management system. Staff use you to manage load reports quickly.

COMMUNICATION STYLE:
- Keep replies SHORT and conversational - like a helpful colleague, not a developer
- Never show UUIDs, database column names, or technical details to the user
- Use plain English: "I'll create 5 load reports for Amazon BHX4" not "inserting into load_reports table"
- Use bullet points for summaries, not code blocks
- Never show JSON or code in your response text
- If you need to propose an action, describe it in plain English then include the action block at the very end

CAPABILITIES:
1. Create load reports from spreadsheet data
2. Update load reports (move between sites, change waste types/weights/dates)
3. Delete load reports
4. Query/search load reports
5. Answer questions about customers, sites, and reports

CRITICAL - QUERY BEFORE UPDATE/DELETE:
- You MUST ALWAYS query the database first before proposing any update or delete action
- NEVER guess or fabricate report IDs - always use query_reports first to find them
- When a user says "move all reports from EMA1 to BHX4", first query to find the actual reports, then propose the update with real IDs
- The query action is automatic - the system will execute it and feed results back to you

HIDDEN ACTION FORMAT (user never sees this - the app strips it automatically):
When you want to perform an action, write your friendly message first, then at the very end put the action block.

To QUERY reports first (always do this before update/delete):
\`\`\`action
{"action":"query_reports","filters":{"site_name":"EMA1","date_from":"2026-01-01","date_to":"2026-12-31","customer_name":"Amazon"}}
\`\`\`

To create reports:
\`\`\`action
{"action":"create_load_reports","reports":[{"report_date":"YYYY-MM-DD","job_number":"string","total_weight_kg":0,"total_pallets":0,"waste_type":"Card Loose"}],"site_name":"site name"}
\`\`\`

To update reports (only after querying to get real IDs):
\`\`\`action
{"action":"update_load_reports","updates":[{"report_id":"actual-uuid-from-query","changes":{"site_id":"uuid"}}],"line_item_updates":[{"report_id":"uuid","changes":{"waste_type":"new type"}}],"description":"summary"}
\`\`\`

To delete reports (only after querying to get real IDs):
\`\`\`action
{"action":"delete_load_reports","report_ids":["actual-uuid-from-query"],"description":"summary"}
\`\`\`

DATA CONTEXT:
Available tables: customers, customer_sites, load_reports, load_line_items, rebate_price_sets, rebate_items, customer_site_price_sets, data_hub_jobs

IMPORTANT - WEIGHT LOOKUP:
- Amazon load reports get their weights from Skiptrak job numbers in the data_hub_jobs table
- When creating Amazon reports, if no weight is provided in the spreadsheet, the system automatically looks up the weight from data_hub_jobs using the job_number
- Skiptrak stores weight in TONNES (weight_t column), so it must be multiplied by 1000 to get KG
- You can set total_weight_kg to 0 and include "lookup_weight": true in the report - the system will fetch it from Skiptrak

RULES:
- Convert DD/MM/YYYY dates to YYYY-MM-DD
- Convert tonnes to KG (×1000)
- Always confirm before acting
- Ask for clarification if data is ambiguous
- ALWAYS query first before updating or deleting - never use placeholder IDs
- Waste types include: Card Loose, Card Bales, Films Baled- Clear, Paper Bales / loose, Waste, Pallet Weight Charge, etc.`;

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

      let totalWeightKg = report.total_weight_kg || (report.weight_t ? report.weight_t * 1000 : 0);
      const totalPallets = report.total_pallets || report.number_of_pallets || 0;

      // If weight is 0 or lookup_weight flag is set, try to get weight from Skiptrak (data_hub_jobs)
      if ((totalWeightKg === 0 || report.lookup_weight) && report.job_number) {
        const jobNum = report.job_number.toString();
        const { data: jobMatch } = await supabase
          .from("data_hub_jobs")
          .select("weight_t, source")
          .eq("job_number", jobNum)
          .limit(1)
          .maybeSingle();

        if (jobMatch && jobMatch.weight_t) {
          // Skiptrak stores in tonnes, convert to KG
          totalWeightKg = jobMatch.source === "midweigh"
            ? jobMatch.weight_t  // Midweigh already in KG
            : jobMatch.weight_t * 1000;  // Skiptrak in tonnes
        }
      }

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

async function updateLoadReports(
  supabase: any,
  data: { updates?: any[]; line_item_updates?: any[] },
) {
  const results: { updated: number; errors: string[] } = { updated: 0, errors: [] };

  if (data.updates) {
    for (const update of data.updates) {
      try {
        const { error } = await supabase
          .from("load_reports")
          .update(update.changes)
          .eq("id", update.report_id);
        if (error) {
          results.errors.push(`Report ${update.report_id}: ${error.message}`);
        } else {
          results.updated++;
        }
      } catch (err: any) {
        results.errors.push(`Report ${update.report_id}: ${err.message}`);
      }
    }
  }

  if (data.line_item_updates) {
    for (const update of data.line_item_updates) {
      try {
        const { error } = await supabase
          .from("load_line_items")
          .update(update.changes)
          .eq("load_report_id", update.report_id);
        if (error) {
          results.errors.push(`Line items for ${update.report_id}: ${error.message}`);
        }
      } catch (err: any) {
        results.errors.push(`Line items for ${update.report_id}: ${err.message}`);
      }
    }
  }

  return results;
}

async function deleteLoadReports(
  supabase: any,
  data: { report_ids: string[] },
) {
  const results: { deleted: number; errors: string[] } = { deleted: 0, errors: [] };

  for (const id of data.report_ids) {
    try {
      // Delete line items first
      await supabase.from("load_line_items").delete().eq("load_report_id", id);
      const { error } = await supabase.from("load_reports").delete().eq("id", id);
      if (error) {
        results.errors.push(`Report ${id}: ${error.message}`);
      } else {
        results.deleted++;
      }
    } catch (err: any) {
      results.errors.push(`Report ${id}: ${err.message}`);
    }
  }

  return results;
}

async function queryReports(
  supabase: any,
  data: { filters: { site_name?: string; customer_name?: string; date_from?: string; date_to?: string; job_number?: string } },
) {
  try {
    // If site_name filter provided, resolve to site_id first for efficient DB filtering
    let siteIds: string[] = [];
    if (data.filters.site_name) {
      const { data: sites } = await supabase
        .from("customer_sites")
        .select("id, site_name")
        .ilike("site_name", `%${data.filters.site_name}%`);
      siteIds = (sites || []).map((s: any) => s.id);
      if (siteIds.length === 0) {
        return { reports: [], count: 0, message: `No site found matching "${data.filters.site_name}"` };
      }
    }

    let query = supabase
      .from("load_reports")
      .select("id, report_date, notes, total_weight_kg, total_pallets, status, site_id, customer_sites(id, site_name, customers(customer_name))")
      .order("report_date", { ascending: false })
      .limit(200);

    if (siteIds.length > 0) {
      query = query.in("site_id", siteIds);
    }
    if (data.filters.date_from) {
      query = query.gte("report_date", data.filters.date_from);
    }
    if (data.filters.date_to) {
      query = query.lte("report_date", data.filters.date_to);
    }
    if (data.filters.job_number) {
      query = query.eq("notes", data.filters.job_number);
    }

    const { data: reports, error } = await query;
    if (error) return { reports: [], error: error.message };

    let filtered = reports || [];
    if (data.filters.customer_name) {
      const cn = data.filters.customer_name.toLowerCase();
      filtered = filtered.filter((r: any) => 
        r.customer_sites?.customers?.customer_name?.toLowerCase().includes(cn)
      );
    }

    const simplified = filtered.map((r: any) => ({
      id: r.id,
      date: r.report_date,
      job_number: r.notes,
      weight_kg: r.total_weight_kg,
      pallets: r.total_pallets,
      site: r.customer_sites?.site_name || "Unassigned",
      customer: r.customer_sites?.customers?.customer_name || "Unknown",
      status: r.status,
    }));

    return { reports: simplified, count: simplified.length };
  } catch (err: any) {
    return { reports: [], error: err.message };
  }
}
