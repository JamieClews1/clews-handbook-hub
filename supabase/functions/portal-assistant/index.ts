import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables the assistant is allowed to READ via the generic query_data tool.
const READ_WHITELIST = new Set<string>([
  "data_hub_jobs",
  "load_reports",
  "load_line_items",
  "load_waste_types",
  "rental_chases",
  "rental_agreements",
  "rental_chase_emails",
  "skip_inventory",
  "skip_tracker_reports",
  "stock_checks",
  "stock_check_daily_entries",
  "stock_check_container_types",
  "pricing_rate_cards",
  "pricing_rate_card_rows",
  "pricing_rate_card_values",
  "pricing_rate_card_zones",
  "pricing_zone_postcodes",
  "pricing_entries",
  "pricing_settings",
  "pricing_skip_sizes",
  "pricing_waste_types",
  "customers",
  "customer_sites",
  "customer_contacts",
  "customer_reporting_periods",
  "crm_tickets",
  "crm_ticket_messages",
  "fuel_surcharge_rates",
  "postcode_zones",
  "contamination_queries",
  "weighbridge_transactions",
  "route_one_jobs",
  "route_one_drivers",
  "bookings",
  "enquiries",
]);

// Tables the assistant is allowed to WRITE (update/delete) via the generic tools.
// Every write still requires explicit user confirmation in the UI.
const WRITE_WHITELIST = new Set<string>([
  "load_reports",
  "load_line_items",
  "pricing_entries",
  "pricing_rate_card_values",
  "pricing_rate_card_rows",
  "pricing_settings",
  "pricing_skip_sizes",
  "pricing_waste_types",
  "rental_chases",
  "rental_agreements",
  "skip_inventory",
  "skip_tracker_reports",
  "crm_tickets",
  "crm_ticket_messages",
  "customers",
  "customer_sites",
  "customer_contacts",
  "customer_reporting_periods",
  "fuel_surcharge_rates",
]);

// Tables the assistant is allowed to INSERT into via the generic insert tool.
// Every insert still requires explicit user confirmation in the UI.
const INSERT_WHITELIST = new Set<string>([
  "rental_agreements",
  "customer_contacts",
  "crm_ticket_messages",
  "pricing_entries",
  "fuel_surcharge_rates",
  "customer_reporting_periods",
]);

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

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

    // Verify the user — any signed-in staff member may use the assistant.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const body = await req.json();
    const { messages, action, actionData } = body;

    // ---- Action execution requests (non-streamed) ----
    if (action) {
      let result: unknown;
      switch (action) {
        case "query_data":
          result = await queryData(adminClient, actionData || {});
          break;
        case "rental_positions":
          result = await rentalPositions(adminClient);
          break;
        case "query_reports":
          result = await queryReports(adminClient, actionData || { filters: {} });
          break;
        case "create_load_reports":
          result = await createLoadReports(adminClient, actionData, user.id, profile?.full_name || "Assistant");
          break;
        case "update_load_reports":
          result = await updateLoadReports(adminClient, actionData);
          break;
        case "delete_load_reports":
          result = await deleteLoadReports(adminClient, actionData);
          break;
        case "update_records":
          result = await updateRecords(adminClient, actionData);
          break;
        case "delete_records":
          result = await deleteRecords(adminClient, actionData);
          break;
        case "insert_records":
          result = await insertRecords(adminClient, actionData, user.id);
          break;
        case "mark_rental_collected":
          result = await markRentalCollected(adminClient, actionData, user.id);
          break;
        default:
          result = { error: `Unknown action: ${action}` };
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Chat request (streamed) ----
    const systemPrompt = buildSystemPrompt(profile?.full_name || "there");

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
          ...(messages as ChatMessage[]),
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
    console.error("portal-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(name: string): string {
  return `You are "Ask One", the AI assistant inside WasteOne / One Portal — Clews Recycling's waste-management platform. You help staff read & interpret their data and carry out admin tasks, like a sharp, helpful colleague. You are talking to ${name}.

COMMUNICATION STYLE:
- Keep replies SHORT, warm and conversational. Use plain English, not technical jargon.
- Never show UUIDs, database column names, SQL, JSON or code blocks in your visible reply.
- Summarise results with bullet points and clear numbers. Round weights sensibly.
- If a request is ambiguous, ask a brief clarifying question.

HOW YOU WORK (no training — you reason over live data using tools):
You can read data and propose actions by emitting a hidden action block at the VERY END of your message. The app strips it out, runs it, and (for reads) feeds results back to you, or (for writes) shows the user a Confirm button. Write your friendly message first, THEN the action block.

READING DATA — use this for any question about jobs, weights, reports, rentals, stock, pricing, customers, CRM, fuel surcharges, etc. This runs automatically and returns rows to you:
\`\`\`action
{"action":"query_data","table":"data_hub_jobs","select":"job_number, job_date, customer, site, weight_t, movement_type, container_type, ewc, source","filters":[{"column":"customer","operator":"ilike","value":"%amazon%"},{"column":"job_date","operator":"gte","value":"2026-01-01"}],"orderBy":{"column":"job_date","ascending":false},"limit":100}
\`\`\`
- Allowed operators: eq, neq, gt, gte, lt, lte, like, ilike, in (value = array or comma list), is (value "null" or "true"/"false").
- For totals/breakdowns add "groupBy":["customer"] and "aggregate":{"sum":"weight_t"} — the system returns counts and sums per group.
- Readable tables include: data_hub_jobs (Skiptrak/Midweigh movements — weight_t is TONNES), load_reports + load_line_items, rental_chases + rental_agreements, skip_inventory + skip_tracker_reports, stock_checks, pricing_rate_cards + pricing_rate_card_values + pricing_entries + pricing_settings, customers + customer_sites + customer_contacts, crm_tickets, fuel_surcharge_rates, weighbridge_transactions, route_one_jobs, bookings.
- For "what is on site / over-rental" questions about Skiptrak containers, use:
\`\`\`action
{"action":"rental_positions"}
\`\`\`

TAKING ACTIONS (always require user confirmation — propose them in plain English first):
- Generic edit (only tables: load_reports, load_line_items, pricing_entries, pricing_rate_card_values, rental_chases, skip_inventory, crm_tickets, customer_sites, fuel_surcharge_rates). ALWAYS query_data first to find the real ids:
\`\`\`action
{"action":"update_records","table":"crm_tickets","updates":[{"id":"<real-id>","changes":{"status":"closed"}}],"description":"Close 3 CRM tickets"}
\`\`\`
- Generic delete (same whitelist):
\`\`\`action
{"action":"delete_records","table":"skip_inventory","ids":["<real-id>"],"description":"Remove 1 inventory record"}
\`\`\`
- Load reports have dedicated tools that also manage line items: create_load_reports, update_load_reports, delete_load_reports.

CRITICAL RULES:
- ALWAYS read with query_data BEFORE proposing any update/delete — never invent ids.
- Only one action block per message, at the very end.
- Convert tonnes↔kg correctly (×1000) and DD/MM/YYYY dates to YYYY-MM-DD.
- Never propose a write to a table outside the whitelist; instead explain you can only read it.`;
}

// ---------- Generic read ----------
async function queryData(
  supabase: any,
  spec: { table?: string; select?: string; filters?: any[]; orderBy?: { column: string; ascending?: boolean }; limit?: number; groupBy?: string[]; aggregate?: { sum?: string } },
) {
  const table = spec.table;
  if (!table || !READ_WHITELIST.has(table)) {
    return { error: `Table "${table}" is not available to read.`, rows: [], count: 0 };
  }
  try {
    const limit = Math.min(spec.limit || 100, 500);
    let q: any = supabase.from(table).select(spec.select && spec.select.trim() ? spec.select : "*");

    for (const f of spec.filters || []) {
      const { column, operator, value } = f || {};
      if (!column || !operator) continue;
      switch (operator) {
        case "eq": q = q.eq(column, value); break;
        case "neq": q = q.neq(column, value); break;
        case "gt": q = q.gt(column, value); break;
        case "gte": q = q.gte(column, value); break;
        case "lt": q = q.lt(column, value); break;
        case "lte": q = q.lte(column, value); break;
        case "like": q = q.like(column, value); break;
        case "ilike": q = q.ilike(column, value); break;
        case "in": q = q.in(column, Array.isArray(value) ? value : String(value).split(",").map((v) => v.trim())); break;
        case "is": q = q.is(column, value === "null" ? null : value === "true"); break;
        default: break;
      }
    }

    if (spec.orderBy?.column) {
      q = q.order(spec.orderBy.column, { ascending: spec.orderBy.ascending ?? false });
    }
    q = q.limit(limit);

    const { data, error } = await q;
    if (error) return { error: error.message, rows: [], count: 0 };
    let rows: any[] = data || [];

    if (spec.groupBy && spec.groupBy.length > 0) {
      rows = aggregateRows(rows, spec.groupBy, spec.aggregate?.sum);
    }

    return { rows, count: rows.length };
  } catch (err: any) {
    return { error: err.message, rows: [], count: 0 };
  }
}

function aggregateRows(rows: any[], groupBy: string[], sumField?: string) {
  const map = new Map<string, any>();
  for (const row of rows) {
    const key = groupBy.map((g) => String(row?.[g] ?? "—")).join(" | ");
    if (!map.has(key)) {
      const base: any = { count: 0 };
      groupBy.forEach((g) => (base[g] = row?.[g] ?? null));
      if (sumField) base[`sum_${sumField}`] = 0;
      map.set(key, base);
    }
    const agg = map.get(key);
    agg.count += 1;
    if (sumField) {
      const n = Number(row?.[sumField]);
      if (!isNaN(n)) agg[`sum_${sumField}`] += n;
    }
  }
  if (sumField) {
    for (const agg of map.values()) {
      agg[`sum_${sumField}`] = Math.round(agg[`sum_${sumField}`] * 1000) / 1000;
    }
  }
  return Array.from(map.values());
}

async function rentalPositions(supabase: any) {
  try {
    const { data, error } = await supabase.rpc("get_skiptrak_rental_positions");
    if (error) return { error: error.message, rows: [], count: 0 };
    const rows = (data || []).filter((r: any) => (r.delivered + r.exchanged) - r.collected > 0);
    return { rows, count: rows.length };
  } catch (err: any) {
    return { error: err.message, rows: [], count: 0 };
  }
}

// ---------- Generic writes (whitelisted, confirmed) ----------
async function updateRecords(
  supabase: any,
  data: { table?: string; updates?: { id: string; changes: any }[] },
) {
  const results: { updated: number; errors: string[] } = { updated: 0, errors: [] };
  if (!data?.table || !WRITE_WHITELIST.has(data.table)) {
    results.errors.push(`Editing "${data?.table}" is not permitted.`);
    return results;
  }
  for (const u of data.updates || []) {
    try {
      const { error } = await supabase.from(data.table).update(u.changes).eq("id", u.id);
      if (error) results.errors.push(`${u.id}: ${error.message}`);
      else results.updated++;
    } catch (err: any) {
      results.errors.push(`${u.id}: ${err.message}`);
    }
  }
  return results;
}

async function deleteRecords(
  supabase: any,
  data: { table?: string; ids?: string[] },
) {
  const results: { deleted: number; errors: string[] } = { deleted: 0, errors: [] };
  if (!data?.table || !WRITE_WHITELIST.has(data.table)) {
    results.errors.push(`Deleting from "${data?.table}" is not permitted.`);
    return results;
  }
  for (const id of data.ids || []) {
    try {
      if (data.table === "load_reports") {
        await supabase.from("load_line_items").delete().eq("load_report_id", id);
      }
      const { error } = await supabase.from(data.table).delete().eq("id", id);
      if (error) results.errors.push(`${id}: ${error.message}`);
      else results.deleted++;
    } catch (err: any) {
      results.errors.push(`${id}: ${err.message}`);
    }
  }
  return results;
}

// ---------- Load report tools (ported from admin-agent) ----------
async function createLoadReports(
  supabase: any,
  data: { reports?: any[]; site_id?: string | null; site_name?: string },
  userId: string,
  userName: string,
) {
  const results: { created: number; errors: string[] } = { created: 0, errors: [] };

  for (const report of data.reports || []) {
    try {
      const reportDate = report.report_date;
      let totalWeightKg = Number(report.total_weight_kg) || 0;
      const totalPallets = Number(report.total_pallets) || 0;

      if ((!totalWeightKg || report.lookup_weight) && report.job_number) {
        const { data: job } = await supabase
          .from("data_hub_jobs")
          .select("weight_t")
          .eq("job_number", String(report.job_number))
          .eq("source", "skiptrak")
          .maybeSingle();
        if (job?.weight_t) totalWeightKg = Number(job.weight_t) * 1000;
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

      if (newReport) {
        const wasteType = report.waste_type || "Card Loose";
        const palletWeightPerUnit = 20;
        const totalPalletWeightKg = totalPallets * palletWeightPerUnit;
        const netMaterialWeightKg = Math.max(0, totalWeightKg - totalPalletWeightKg);

        await supabase.from("load_line_items").insert({
          load_report_id: newReport.id,
          waste_type: wasteType,
          pallet_count: totalPallets,
          avg_weight_kg: totalPallets > 0 ? netMaterialWeightKg / totalPallets : netMaterialWeightKg,
          total_weight_kg: netMaterialWeightKg,
          display_order: 0,
        });

        if (totalPallets > 0 && totalPalletWeightKg > 0) {
          await supabase.from("load_line_items").insert({
            load_report_id: newReport.id,
            waste_type: "Pallet Weight Charge",
            pallet_count: 0,
            avg_weight_kg: totalPalletWeightKg,
            total_weight_kg: totalPalletWeightKg,
            display_order: 1,
          });
        }
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

  for (const update of data.updates || []) {
    try {
      const { error } = await supabase.from("load_reports").update(update.changes).eq("id", update.report_id);
      if (error) results.errors.push(`Report ${update.report_id}: ${error.message}`);
      else results.updated++;
    } catch (err: any) {
      results.errors.push(`Report ${update.report_id}: ${err.message}`);
    }
  }

  for (const update of data.line_item_updates || []) {
    try {
      const { error } = await supabase.from("load_line_items").update(update.changes).eq("load_report_id", update.report_id);
      if (error) results.errors.push(`Line items for ${update.report_id}: ${error.message}`);
    } catch (err: any) {
      results.errors.push(`Line items for ${update.report_id}: ${err.message}`);
    }
  }

  return results;
}

async function deleteLoadReports(supabase: any, data: { report_ids: string[] }) {
  const results: { deleted: number; errors: string[] } = { deleted: 0, errors: [] };
  for (const id of data.report_ids || []) {
    try {
      await supabase.from("load_line_items").delete().eq("load_report_id", id);
      const { error } = await supabase.from("load_reports").delete().eq("id", id);
      if (error) results.errors.push(`Report ${id}: ${error.message}`);
      else results.deleted++;
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

    let query: any = supabase
      .from("load_reports")
      .select("id, report_date, notes, total_weight_kg, total_pallets, status, site_id, customer_sites(id, site_name, customers(customer_name))")
      .order("report_date", { ascending: false })
      .limit(200);

    if (siteIds.length > 0) query = query.in("site_id", siteIds);
    if (data.filters.date_from) query = query.gte("report_date", data.filters.date_from);
    if (data.filters.date_to) query = query.lte("report_date", data.filters.date_to);
    if (data.filters.job_number) query = query.eq("notes", data.filters.job_number);

    const { data: reports, error } = await query;
    if (error) return { reports: [], error: error.message };

    let filtered = reports || [];
    if (data.filters.customer_name) {
      const cn = data.filters.customer_name.toLowerCase();
      filtered = filtered.filter((r: any) => r.customer_sites?.customers?.customer_name?.toLowerCase().includes(cn));
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
