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

DOING TASKS (action tools — these CHANGE data or send email):
- You can take actions on the staff member's behalf: update_records, delete_records, insert_records, create_load_reports, update_load_reports, delete_load_reports, mark_rental_collected, and send_email.
- NOTHING runs automatically. When you call an action tool, the portal shows ${name} a confirmation card and only runs it if they click Confirm. So always: (1) ALWAYS read with query_data FIRST to find the real records and their ids — never invent ids; (2) write a short, friendly message describing exactly what you're about to do; (3) THEN call the action tool(s).
- Every action tool MUST include a clear "description" field (a one-line plain-English summary of the change, e.g. "Close 3 CRM tickets" or "Email the quote to jane@acme.com") — this is what the user sees on the confirm button.
- For record edits use update_records {table, updates:[{id, changes}]}; for removals delete_records {table, ids:[]}; for new rows insert_records {table, rows:[]}. CRM status changes: update crm_tickets (status "open"/"closed", assigned_to, priority). Pricing edits: update pricing_entries / pricing_rate_card_values / pricing_skip_sizes after reading current values. Load reports have dedicated tools that also manage their line items.
- To email someone use send_email {to, subject, html, description}. Compose proper HTML. Confirm the recipient address before sending.
- After the user confirms, the portal runs the action and tells them the result — you do not need to do anything else.

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
        limit: { type: "number", description: "Max rows (default 50, max 200). Use groupBy+aggregate for totals instead of pulling many rows." },
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

// Action tools — these CHANGE data or send email. They are NEVER executed
// inside the model loop; instead they are returned to the UI as proposed
// actions and only run after the user clicks Confirm. Each requires a
// human-readable "description".
const ACTION_TOOLS = [
  {
    name: "update_records",
    description: "Update one or more existing rows in a writable table. Read the records first to get real ids.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table to update." },
        updates: {
          type: "array",
          description: "Each item updates one row by id.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              changes: { type: "object", description: "Column → new value map." },
            },
            required: ["id", "changes"],
          },
        },
        description: { type: "string", description: "Plain-English summary shown on the confirm button." },
      },
      required: ["table", "updates", "description"],
    },
  },
  {
    name: "delete_records",
    description: "Delete rows by id from a writable table. Read the records first to get real ids.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        ids: { type: "array", items: { type: "string" } },
        description: { type: "string" },
      },
      required: ["table", "ids", "description"],
    },
  },
  {
    name: "insert_records",
    description: "Insert new rows into an insertable table.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        rows: { type: "array", items: { type: "object" } },
        description: { type: "string" },
      },
      required: ["table", "rows", "description"],
    },
  },
  {
    name: "mark_rental_collected",
    description: "Mark one or more over-rental bins as collected so they drop off the chasing list.",
    input_schema: {
      type: "object",
      properties: {
        bins: {
          type: "array",
          items: {
            type: "object",
            properties: {
              bin_key: { type: "string" },
              customer: { type: "string" },
              site: { type: "string" },
              container_type: { type: "string" },
              category: { type: "string" },
              collected_date: { type: "string" },
              collection_ticket: { type: "string" },
            },
            required: ["bin_key"],
          },
        },
        description: { type: "string" },
      },
      required: ["bins", "description"],
    },
  },
  {
    name: "create_load_reports",
    description: "Create one or more load reports (with line items). Provide site_id when known.",
    input_schema: {
      type: "object",
      properties: {
        reports: { type: "array", items: { type: "object" } },
        site_id: { type: "string" },
        description: { type: "string" },
      },
      required: ["reports", "description"],
    },
  },
  {
    name: "update_load_reports",
    description: "Update existing load reports and/or their line items.",
    input_schema: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: { report_id: { type: "string" }, changes: { type: "object" } },
            required: ["report_id", "changes"],
          },
        },
        line_item_updates: {
          type: "array",
          items: {
            type: "object",
            properties: { report_id: { type: "string" }, changes: { type: "object" } },
            required: ["report_id", "changes"],
          },
        },
        description: { type: "string" },
      },
      required: ["description"],
    },
  },
  {
    name: "delete_load_reports",
    description: "Delete load reports (and their line items) by id.",
    input_schema: {
      type: "object",
      properties: {
        report_ids: { type: "array", items: { type: "string" } },
        description: { type: "string" },
      },
      required: ["report_ids", "description"],
    },
  },
  {
    name: "send_email",
    description: "Send an email from the company's noreply address. Compose proper HTML in the body.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email (comma-separate for multiple)." },
        cc: { type: "string", description: "Optional CC email(s), comma-separated." },
        subject: { type: "string" },
        html: { type: "string", description: "HTML email body." },
        description: { type: "string" },
      },
      required: ["to", "subject", "html", "description"],
    },
  },
];

const ALL_TOOLS = [...TOOLS, ...ACTION_TOOLS];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Call Anthropic, retrying transient rate-limit (429) / overload (529) errors.
// Honours the `retry-after` header when present, with a sane cap so the
// edge function never hangs. Returns the final Response (ok or not).
async function callAnthropicWithRetry(apiKey: string, payload: unknown): Promise<Response> {
  const MAX_ATTEMPTS = 4;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || (res.status !== 429 && res.status !== 529)) return res;

    // Transient — back off and retry unless we're out of attempts.
    if (attempt === MAX_ATTEMPTS - 1) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 20_000)
      : Math.min(1500 * 2 ** attempt, 12_000);
    await res.text().catch(() => {}); // drain body to free the connection
    console.warn(`Anthropic ${res.status}; retrying in ${waitMs}ms (attempt ${attempt + 1})`);
    await sleep(waitMs);
  }
  // Unreachable, but keeps the type-checker happy.
  return new Response(null, { status: 429 });
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
    const limit = Math.min(Number(spec.limit) || 50, 200);
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

// ---------- Action executors (only run after user confirmation) ----------
async function updateRecords(supabase: any, data: { table?: string; updates?: { id: string; changes: any }[] }) {
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

async function deleteRecords(supabase: any, data: { table?: string; ids?: string[] }) {
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

async function insertRecords(supabase: any, data: { table?: string; rows?: any[] }, userId: string) {
  const results: { created: number; errors: string[] } = { created: 0, errors: [] };
  if (!data?.table || !INSERT_WHITELIST.has(data.table)) {
    results.errors.push(`Adding to "${data?.table}" is not permitted.`);
    return results;
  }
  for (const row of data.rows || []) {
    try {
      const payload = { ...row };
      if (["rental_agreements", "rental_chases"].includes(data.table) && payload.created_by == null) {
        payload.created_by = userId;
      }
      const { error } = await supabase.from(data.table).insert(payload);
      if (error) results.errors.push(error.message);
      else results.created++;
    } catch (err: any) {
      results.errors.push(err.message);
    }
  }
  return results;
}

async function markRentalCollected(
  supabase: any,
  data: { bins?: { bin_key: string; customer?: string; site?: string; container_type?: string; category?: string; collected_date?: string; collection_ticket?: string }[] },
  userId: string,
) {
  const results: { updated: number; errors: string[] } = { updated: 0, errors: [] };
  for (const bin of data.bins || []) {
    try {
      if (!bin.bin_key) { results.errors.push("Missing bin reference."); continue; }
      let chaseId: string | null = null;
      const { data: existing } = await supabase.from("rental_chases").select("id").eq("bin_key", bin.bin_key).maybeSingle();
      if (existing) {
        chaseId = existing.id;
      } else {
        const { data: created, error: insErr } = await supabase.from("rental_chases").insert({
          bin_key: bin.bin_key,
          customer: bin.customer || null,
          site: bin.site || null,
          category: bin.category || null,
          container_type: bin.container_type || null,
          created_by: userId,
        }).select("id").single();
        if (insErr) { results.errors.push(insErr.message); continue; }
        chaseId = created.id;
      }
      const { error } = await supabase.from("rental_chases").update({
        collected: true,
        collected_date: bin.collected_date || new Date().toISOString().slice(0, 10),
        collection_ticket: bin.collection_ticket || null,
        chase_status: "resolved",
      }).eq("id", chaseId);
      if (error) results.errors.push(error.message);
      else results.updated++;
    } catch (err: any) {
      results.errors.push(err.message);
    }
  }
  return results;
}

async function createLoadReports(
  supabase: any,
  data: { reports?: any[]; site_id?: string | null },
  userId: string,
  userName: string,
) {
  const results: { created: number; errors: string[] } = { created: 0, errors: [] };
  for (const report of data.reports || []) {
    try {
      let totalWeightKg = Number(report.total_weight_kg) || 0;
      const totalPallets = Number(report.total_pallets) || 0;
      if ((!totalWeightKg || report.lookup_weight) && report.job_number) {
        const { data: job } = await supabase
          .from("data_hub_jobs").select("weight_t")
          .eq("job_number", String(report.job_number)).eq("source", "skiptrak").maybeSingle();
        if (job?.weight_t) totalWeightKg = Number(job.weight_t) * 1000;
      }
      const { data: newReport, error: reportError } = await supabase
        .from("load_reports").insert({
          operator_id: userId,
          operator_name: userName,
          notes: report.job_number?.toString() || null,
          site_id: data.site_id || report.site_id || null,
          report_date: report.report_date,
          status: "submitted",
          total_pallets: totalPallets,
          total_weight_kg: totalWeightKg,
          submitted_at: new Date().toISOString(),
        }).select("id").single();
      if (reportError) { results.errors.push(`Job ${report.job_number}: ${reportError.message}`); continue; }
      if (newReport) {
        const wasteType = report.waste_type || "Card Loose";
        const totalPalletWeightKg = totalPallets * 20;
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

async function updateLoadReports(supabase: any, data: { updates?: any[]; line_item_updates?: any[] }) {
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

async function deleteLoadReports(supabase: any, data: { report_ids?: string[] }) {
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

async function sendEmail(data: { to?: string; cc?: string; subject?: string; html?: string }) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return { error: "Email sending is not configured (missing API key)." };
  if (!data?.to || !data?.subject || !data?.html) return { error: "An email needs a recipient, subject and body." };
  const splitAddrs = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);
  try {
    const payload: Record<string, unknown> = {
      from: "WasteOne <noreply@noreply.clewsrecycling.co.uk>",
      to: splitAddrs(data.to),
      subject: data.subject,
      html: data.html,
    };
    const cc = splitAddrs(data.cc);
    if (cc && cc.length) payload.cc = cc;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      return { error: `Email failed to send: ${t}` };
    }
    return { sent: true, to: data.to };
  } catch (err: any) {
    return { error: `Email failed to send: ${err.message}` };
  }
}

async function executeAction(supabase: any, tool: string, input: any, userId: string, userName: string) {
  switch (tool) {
    case "update_records": return await updateRecords(supabase, input || {});
    case "delete_records": return await deleteRecords(supabase, input || {});
    case "insert_records": return await insertRecords(supabase, input || {}, userId);
    case "mark_rental_collected": return await markRentalCollected(supabase, input || {}, userId);
    case "create_load_reports": return await createLoadReports(supabase, input || {}, userId, userName);
    case "update_load_reports": return await updateLoadReports(supabase, input || {});
    case "delete_load_reports": return await deleteLoadReports(supabase, input || {});
    case "send_email": return await sendEmail(input || {});
    default: return { error: `Unknown action: ${tool}` };
  }
}

function summariseActionResult(description: string, r: any): string {
  const errs: string[] = Array.isArray(r?.errors) ? r.errors : [];
  const ok = errs.length === 0;
  const counts: string[] = [];
  if (typeof r?.updated === "number") counts.push(`${r.updated} updated`);
  if (typeof r?.deleted === "number") counts.push(`${r.deleted} deleted`);
  if (typeof r?.created === "number") counts.push(`${r.created} created`);
  if (r?.sent) counts.push(`email sent to ${r.to}`);
  if (r?.error) errs.push(r.error);
  const head = `${ok && !r?.error ? "✅" : "⚠️"} **${description}**`;
  const detail = counts.length ? ` — ${counts.join(", ")}` : "";
  const errLine = errs.length ? `\n  - Problem: ${errs.join("; ")}` : "";
  return `${head}${detail}${errLine}`;
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
    const userName = profile?.full_name || "Assistant";

    let body: { messages?: unknown; context?: unknown; confirmedActions?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    // ---- Execution phase: the user clicked Confirm on proposed actions. ----
    if (Array.isArray(body?.confirmedActions) && body.confirmedActions.length > 0) {
      const summaries: string[] = [];
      for (const a of body.confirmedActions as any[]) {
        if (!a || typeof a.tool !== "string") continue;
        const desc = typeof a.description === "string" && a.description.trim()
          ? a.description.trim()
          : a.tool.replace(/_/g, " ");
        const result = await executeAction(adminClient, a.tool, a.input || {}, user.id, userName);
        summaries.push(summariseActionResult(desc, result));
      }
      const reply = summaries.length
        ? `Done — here's what I ran:\n\n${summaries.join("\n")}`
        : "There was nothing to run.";
      return jsonResponse({ reply, executed: true });
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
      const anthropicRes = await callAnthropicWithRetry(apiKey, {
        model: MODEL, max_tokens: MAX_TOKENS, system, tools: ALL_TOOLS, messages,
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error("Anthropic API error", anthropicRes.status, errText);
        let detail = errText;
        try { detail = JSON.parse(errText)?.error?.message ?? errText; } catch { /* keep raw */ }
        if (anthropicRes.status === 429 || anthropicRes.status === 529) {
          return jsonResponse({
            error: "The assistant is busy right now (AI rate limit reached). Please wait about a minute and try again. Asking for a smaller slice of data at a time also helps.",
          }, 429);
        }
        const status = anthropicRes.status >= 500 ? 502 : 400;
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

      // If Claude proposes any data-changing / email actions, DO NOT run them.
      // Return them to the UI as pending actions for the user to confirm.
      const actionUses = toolUses.filter((tu) => ACTION_TOOL_NAMES.has(tu.name));
      if (actionUses.length > 0) {
        const pendingActions = actionUses.map((tu) => ({
          id: tu.id,
          tool: tu.name,
          input: tu.input,
          description: typeof tu.input?.description === "string" && tu.input.description.trim()
            ? tu.input.description.trim()
            : tu.name.replace(/_/g, " "),
        }));
        return jsonResponse({
          reply: finalText || "I've prepared the following for your approval:",
          pendingActions,
        });
      }

      // Otherwise run the requested read tools and feed results back.
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
