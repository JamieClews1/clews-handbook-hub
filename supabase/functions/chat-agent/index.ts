import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Tables Claude is allowed to READ. Mirrors the "Ask One" assistant whitelist so
// Claude can explore the operational dataset like a colleague with DB access.
const READ_WHITELIST = new Set<string>([
  // Movements / weights
  "data_hub_jobs",
  "data_hub_jobs_archive",
  "weighbridge_transactions",
  "weighbridge_customers",
  "weighbridge_vehicles",
  "weighbridge_waste_types",
  // Load reports
  "load_reports",
  "load_line_items",
  "load_waste_types",
  "load_report_settings",
  // Rentals / live jobs
  "rental_chases",
  "rental_agreements",
  "rental_chase_emails",
  "live_jobs_settings",
  // Stock / inventory
  "skip_inventory",
  "skip_tracker_reports",
  "stock_checks",
  "stock_check_daily_entries",
  "stock_check_container_types",
  "stock_check_items",
  "stock_check_excluded_sites",
  "stock_reports",
  "stock_report_items",
  // Pricing
  "pricing_rate_cards",
  "pricing_rate_card_rows",
  "pricing_rate_card_values",
  "pricing_rate_card_zones",
  "pricing_zone_postcodes",
  "pricing_entries",
  "pricing_settings",
  "pricing_skip_sizes",
  "pricing_waste_types",
  "postcode_zones",
  "fuel_surcharge_rates",
  // Customers / sites / contacts
  "customers",
  "customer_sites",
  "customer_contacts",
  "customer_reporting_periods",
  "customer_portal_memberships",
  "customer_skip_rebates",
  "customer_site_skip_rebates",
  // Rebates / reporting
  "rebate_items",
  "rebate_rules",
  "rebate_monthly_values",
  "rebate_price_sets",
  "rebate_price_set_items",
  "locked_rebate_reports",
  "staci_monthly_reports",
  "staci_pallet_entries",
  "staci_pallet_rates",
  "staci_pallet_charges",
  "facility_recycling_forms",
  "facility_recycling_waste_entries",
  // CRM
  "crm_tickets",
  "crm_ticket_messages",
  "crm_team_members",
  "crm_pricing",
  "crm_email_templates",
  // RouteOne / drivers
  "route_one_jobs",
  "route_one_drivers",
  "route_one_vehicles",
  "driver_locations",
  // Contaminations
  "contamination_queries",
  "contamination_points",
  "contamination_charge_matrix",
  "contamination_waste_types",
  // Compliance / safety
  "near_miss_reports",
  "riddor_incidents",
  "toolbox_talks",
  "rams",
  "rams_hazards",
  "site_inspection_reports",
  "partners",
  "partner_documents",
  "partner_document_requirements",
  // Company / misc
  "company_profile",
  "company_contacts",
  "company_documents",
  "diary_cards",
  "bookings",
  "enquiries",
  "credit_account_applications",
  "profiles",
]);

// Tables Claude may UPDATE / DELETE — every change requires explicit user
// confirmation in the UI before it runs.
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

// Tables Claude may INSERT into — also gated behind user confirmation.
const INSERT_WHITELIST = new Set<string>([
  "rental_agreements",
  "customer_contacts",
  "crm_ticket_messages",
  "pricing_entries",
  "fuel_surcharge_rates",
  "customer_reporting_periods",
]);

const ACTION_TOOL_NAMES = new Set<string>([
  "update_records",
  "delete_records",
  "insert_records",
  "mark_rental_collected",
  "create_load_reports",
  "update_load_reports",
  "delete_load_reports",
  "send_email",
]);

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const MAX_TOOL_ROUNDS = 8;

type ChatMessage = { role: "user" | "assistant"; content: unknown };

function buildSystemPrompt(name: string, context: string): string {
  const nowDate = new Date();
  const fullDate = nowDate.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const isoDate = nowDate.toISOString().slice(0, 10);
  const curYear = nowDate.getUTCFullYear();

  const base = `You are the AI Assistant inside WasteOne / One Portal — Clews Recycling's waste-management platform. You help staff work faster and smarter, and you can read & interpret the company's live operational data to answer questions. You are talking to ${name}.

⚠️ CURRENT DATE — READ THIS FIRST: Today is ${fullDate} (${isoDate}). The current year is ${curYear}. Do NOT rely on training data for the date — it is ${curYear}. Whenever a question involves "this year", "this month", "recently", "latest" or a month with no year, anchor it to ${isoDate} and use ${curYear} as the current year.

WHAT YOU CAN HELP WITH:
- Answering questions about the company's data — jobs & weights, load reports, rentals, stock & inventory, pricing & rate cards, rebates & reporting, customers/sites/contacts, CRM, RouteOne/drivers, contaminations, compliance, bookings and more.
- Drafting client emails, proposals and reports; summarising notes; building checklists, agendas and action plans; brainstorming and problem-solving.

READING DATA (tools):
- Use the "query_data" tool for any factual question about the business. It returns rows from the live database.
- Use "schema_info" to discover what tables exist (call with no table) or to see a table's columns + a sample row (call with a table) before querying — don't guess table or column names.
- Use "rental_positions" for "what is on site / over-rental" questions about Skiptrak containers.

GETTING GREAT ANSWERS (matching rules):
- Match text loosely with the "ilike" operator and wrap values in % wildcards (e.g. "%cbre%"). Never use "eq" for names, sites, EWC codes or descriptions.
- A customer/broker name (e.g. "Reconomy (UK) Limited") and the physical site (e.g. "CBRE") live in DIFFERENT columns. When the user names both, search BOTH with the "or" field, using * as the wildcard, e.g. "customer.ilike.*reconomy*,site.ilike.*cbre*".
- EWC codes are stored with spaces and sometimes a trailing "*". Always match EWC with ilike + % (e.g. "%20 03 07%").
- For totals/breakdowns add "groupBy":["customer"] and "aggregate":{"sum":"weight_t"}.
- DEDUPE sources: the same job can appear twice in data_hub_jobs — source "skiptrak" (weight_t already in TONNES) and "midweigh" (weight in KG, divide by 1000). For movements/containers use skiptrak; for weighbridge tonnage use midweigh ÷1000. Don't double-count.
- DISAMBIGUATE NAMES FIRST. Short names match several places — list the distinct matches before totalling, and tell the user which you included/excluded. Watch for substring false matches (e.g. "%ford%" matches "Telford").
- SANITY-CHECK numbers and state your assumptions and the period you used.

BE DETERMINED: you have many tool turns. A good answer often takes several queries — orient with schema_info, list distinct matches, pull rows, cross-check, then answer. If a query returns nothing, broaden it and try again before giving up.

STYLE:
- Be concise and direct. Use bullet points and clear numbers. Round weights sensibly.
- Never show UUIDs, raw column names, SQL or JSON in your visible reply.
- If a request is ambiguous, ask one brief clarifying question.
- Never make up facts. When drafting documents, offer to refine the output.`;

  return context ? `${base}\n\nAdditional context:\n${context}` : base;
}

const TOOLS = [
  {
    name: "query_data",
    description:
      "Read rows from the live operational database. Use ilike + % wildcards for names/sites/EWC. Supports filters, an OR group, ordering, limit, and groupBy with sum aggregation.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name to read from." },
        select: { type: "string", description: "Comma-separated columns, or omit for all." },
        filters: {
          type: "array",
          description: "List of filters.",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              operator: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"],
              },
              value: { type: "string" },
            },
            required: ["column", "operator", "value"],
          },
        },
        or: {
          type: "string",
          description: "PostgREST OR group, e.g. 'customer.ilike.*reconomy*,site.ilike.*cbre*' (use * as wildcard).",
        },
        orderBy: {
          type: "object",
          properties: { column: { type: "string" }, ascending: { type: "boolean" } },
        },
        limit: { type: "number", description: "Max rows (default 100, max 500)." },
        groupBy: { type: "array", items: { type: "string" } },
        aggregate: { type: "object", properties: { sum: { type: "string" } } },
      },
      required: ["table"],
    },
  },
  {
    name: "schema_info",
    description:
      "Discover the data model. Call with no table to list all readable tables. Call with a table to get its columns and a sample row.",
    input_schema: {
      type: "object",
      properties: { table: { type: "string" } },
    },
  },
  {
    name: "rental_positions",
    description:
      "Get current Skiptrak container positions on site (net delivered minus collected) — use for 'what is on site' / over-rental questions.",
    input_schema: { type: "object", properties: {} },
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function aggregateRows(rows: any[], groupBy: string[], sumField?: string) {
  const map = new Map<string, any>();
  for (const row of rows) {
    const key = groupBy.map((g) => String(row?.[g] ?? "—")).join(" | ");
    if (!map.has(key)) {
      const b: any = { count: 0 };
      groupBy.forEach((g) => (b[g] = row?.[g] ?? null));
      if (sumField) b[`sum_${sumField}`] = 0;
      map.set(key, b);
    }
    const agg = map.get(key);
    agg.count += 1;
    if (sumField) {
      const n = Number(row?.[sumField]);
      if (!isNaN(n)) agg[`sum_${sumField}`] += n;
    }
  }
  if (sumField) for (const agg of map.values()) agg[`sum_${sumField}`] = Math.round(agg[`sum_${sumField}`] * 1000) / 1000;
  return Array.from(map.values());
}

async function queryData(supabase: any, spec: any) {
  const table = spec?.table;
  if (!table || !READ_WHITELIST.has(table)) return { error: `Table "${table}" is not available to read.`, rows: [], count: 0 };
  try {
    const limit = Math.min(Number(spec.limit) || 100, 500);
    let q: any = supabase.from(table).select(spec.select && String(spec.select).trim() ? spec.select : "*");
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
    if (spec.or && typeof spec.or === "string" && spec.or.trim()) q = q.or(spec.or.trim());
    if (spec.orderBy?.column) q = q.order(spec.orderBy.column, { ascending: spec.orderBy.ascending ?? false });
    q = q.limit(limit);
    const { data, error } = await q;
    if (error) return { error: error.message, rows: [], count: 0 };
    let rows: any[] = data || [];
    if (spec.groupBy && spec.groupBy.length > 0) rows = aggregateRows(rows, spec.groupBy, spec.aggregate?.sum);
    return { rows, count: rows.length };
  } catch (err: any) {
    return { error: err.message, rows: [], count: 0 };
  }
}

async function schemaInfo(supabase: any, spec: { table?: string }) {
  if (!spec?.table) return { tables: Array.from(READ_WHITELIST).sort() };
  if (!READ_WHITELIST.has(spec.table)) return { error: `Table "${spec.table}" is not readable.`, tables: Array.from(READ_WHITELIST).sort() };
  try {
    const { data, error } = await supabase.from(spec.table).select("*").limit(1);
    if (error) return { error: error.message, columns: [] };
    const columns = data && data[0] ? Object.keys(data[0]) : [];
    return { table: spec.table, columns, sample: data?.[0] ?? null };
  } catch (err: any) {
    return { error: err.message, columns: [] };
  }
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

async function runTool(supabase: any, name: string, input: any) {
  switch (name) {
    case "query_data": return await queryData(supabase, input || {});
    case "schema_info": return await schemaInfo(supabase, input || {});
    case "rental_positions": return await rentalPositions(supabase);
    default: return { error: `Unknown tool: ${name}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { error: "The Anthropic API key is not configured. An administrator needs to add it before the assistant can be used." },
        500,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user — any signed-in staff member may use the assistant.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "You must be signed in to use the assistant." }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized." }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await adminClient.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

    let body: { messages?: unknown; context?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const rawMessages = body?.messages;
    const context = typeof body?.context === "string" ? body.context : "";
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return jsonResponse({ error: "A non-empty 'messages' array is required." }, 400);
    }

    // Normalise the incoming history. Frontend sends string content; keep only valid turns.
    const messages: ChatMessage[] = [];
    for (const m of rawMessages) {
      if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "") {
        messages.push({ role: m.role, content: m.content });
      }
    }
    if (messages.length === 0) return jsonResponse({ error: "No valid messages were provided." }, 400);

    const system = buildSystemPrompt(profile?.full_name || "there", context);

    // Agentic tool loop with Anthropic.
    let finalText = "";
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, tools: TOOLS, messages }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error("Anthropic API error", anthropicRes.status, errText);
        let detail = errText;
        try { detail = JSON.parse(errText)?.error?.message ?? errText; } catch { /* keep raw */ }
        const status = anthropicRes.status === 429 ? 429 : anthropicRes.status >= 500 ? 502 : 400;
        return jsonResponse({ error: `Anthropic API error: ${detail}` }, status);
      }

      const data = await anthropicRes.json();
      const contentBlocks: any[] = Array.isArray(data?.content) ? data.content : [];

      // Collect any text from this turn.
      const textThisTurn = contentBlocks
        .filter((b) => b?.type === "text")
        .map((b) => b?.text ?? "")
        .join("")
        .trim();
      if (textThisTurn) finalText = textThisTurn;

      const toolUses = contentBlocks.filter((b) => b?.type === "tool_use");
      if (data?.stop_reason !== "tool_use" || toolUses.length === 0) {
        break; // Final answer reached.
      }

      // Run the requested tools and feed results back.
      messages.push({ role: "assistant", content: contentBlocks });
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const result = await runTool(adminClient, tu.name, tu.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result).slice(0, 100_000),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }

    if (!finalText) return jsonResponse({ error: "The assistant returned an empty response." }, 502);
    return jsonResponse({ reply: finalText });
  } catch (err) {
    console.error("chat-agent unexpected error", err);
    return jsonResponse({ error: "Something went wrong while contacting the assistant." }, 500);
  }
});
