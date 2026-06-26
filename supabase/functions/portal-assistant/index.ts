import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables the assistant is allowed to READ via the generic query_data tool.
// Kept broad on purpose: Ask One should be able to explore almost the whole
// operational dataset the way a colleague with database access would.
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
        case "schema_info":
          result = await schemaInfo(adminClient, actionData || {});
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

    // ---- Deterministic data shortcuts for high-risk audit questions ----
    const overRentalAnswer = await answerOverRentalQuestion(adminClient, messages as ChatMessage[]);
    if (overRentalAnswer) return streamTextResponse(overRentalAnswer);

    const directAnswer = await answerTonnageQuestion(adminClient, messages as ChatMessage[]);
    if (directAnswer) return streamTextResponse(directAnswer);

    // ---- Chat request (streamed) ----
    const systemPrompt = buildSystemPrompt(profile?.full_name || "there");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
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
  const nowDate = new Date();
  const fullDate = nowDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const isoDate = nowDate.toISOString().slice(0, 10);
  const curYear = nowDate.getUTCFullYear();
  return `You are "Ask One", the AI assistant inside WasteOne / One Portal — Clews Recycling's waste-management platform. You help staff read & interpret their data and carry out admin tasks, like a sharp, helpful colleague. You are talking to ${name}.

⚠️ CURRENT DATE — READ THIS FIRST: Today is ${fullDate} (${isoDate}). The current year is ${curYear}. Do NOT rely on your training data for the date — it is ${curYear}, not 2025 or any earlier year. Whenever a question involves "this year", "this month", "recently", "latest", or a month with no year, anchor it to ${isoDate} and use ${curYear} as the current year.

COMMUNICATION STYLE:
- Keep replies SHORT, warm and conversational. Use plain English, not technical jargon.
- Never show UUIDs, database column names, SQL, JSON or code blocks in your visible reply.
- Summarise results with bullet points and clear numbers. Round weights sensibly.
- If a request is ambiguous, ask a brief clarifying question.
- DATES: today's date is ${isoDate} (current year ${curYear}). When the user names a month/day with no year (e.g. "in May", "last Tuesday"), assume the most recent occurrence on or before today — never a year from years ago. State which period you used.

HOW YOU WORK (no training — you reason over live data using tools):
You can read data and propose actions by emitting a hidden action block at the VERY END of your message. The app strips it out, runs it, and (for reads) feeds results back to you, or (for writes) shows the user a Confirm button. Write your friendly message first, THEN the action block.

READING DATA — use this for any question about jobs, weights, reports, rentals, stock, pricing, customers, CRM, fuel surcharges, etc. This runs automatically and returns rows to you:
\`\`\`action
{"action":"query_data","table":"data_hub_jobs","select":"job_number, job_date, customer, site, weight_t, movement_type, container_type, ewc, source","filters":[{"column":"customer","operator":"ilike","value":"%amazon%"},{"column":"job_date","operator":"gte","value":"2026-01-01"}],"orderBy":{"column":"job_date","ascending":false},"limit":100}
\`\`\`
- Allowed operators: eq, neq, gt, gte, lt, lte, like, ilike, in (value = array or comma list), is (value "null" or "true"/"false").
- For totals/breakdowns add "groupBy":["customer"] and "aggregate":{"sum":"weight_t"} — the system returns counts and sums per group.
- You can read almost the WHOLE operational dataset — jobs & weights, load reports, rentals, stock & inventory, pricing & rate cards, rebates & reporting, customers/sites/contacts, CRM, RouteOne/drivers, contaminations, compliance (near-miss, RIDDOR, RAMS, toolbox talks, inspections), partners, weighbridge, bookings, enquiries and more.
- DON'T GUESS TABLE OR COLUMN NAMES. If you're unsure what data exists or what a table's columns are, look first. Ask for the table list, or a specific table's columns + a sample row:
\`\`\`action
{"action":"schema_info"}
\`\`\`
\`\`\`action
{"action":"schema_info","table":"contamination_queries"}
\`\`\`
  schema_info runs automatically and feeds the answer back to you — use it freely to orient yourself before querying, exactly like a colleague opening a table to see what's in it.
- For "what is on site / over-rental" questions about Skiptrak containers, use:
\`\`\`action
{"action":"rental_positions"}
\`\`\`

GETTING GREAT ANSWERS (matching rules — follow these to avoid missing rows):
- Always match text loosely with "ilike" and wrap the value in % wildcards (e.g. "%cbre%"). Never use "eq" for names, sites, EWC codes or descriptions.
- BROKER + SITE questions: a customer name (the broker, e.g. "Reconomy (UK) Limited") and the physical site (e.g. "CBRE") live in DIFFERENT columns. When the user names both, search BOTH columns with an OR group instead of separate AND filters, e.g.:
\`\`\`action
{"action":"query_data","table":"data_hub_jobs","select":"job_number, job_date, customer, site, ewc, weight_t, source","or":"customer.ilike.*reconomy*,site.ilike.*cbre*","filters":[{"column":"ewc","operator":"ilike","value":"%20 03 07%"}],"orderBy":{"column":"job_date","ascending":false},"limit":100}
\`\`\`
  (In the "or" field use * as the wildcard, not %. In normal "filters" use %.)
- EWC codes are often stored with a trailing "*" (e.g. "20 03 07*") and spaces. Always match EWC with ilike + % (e.g. "%20 03 07%"), never exact.
- DEDUPE Skiptrak vs Midweigh: the same physical job can appear twice in data_hub_jobs — once with source "skiptrak" and once with source "midweigh". When counting jobs or listing "when did we do X", group by job_number or note both sources rather than double-counting. For movement/rental counts use source "skiptrak"; for weighbridge weights Midweigh is in KG (divide by 1000 for tonnes) while weight_t for skiptrak is already TONNES.
- If the first query returns nothing, broaden it (drop a filter, shorten the search term) and try once more before saying you found nothing.

QUESTION THE DATA BEFORE YOU ANSWER (this is the most important section — never give a confident number from a single loose query):
- DISAMBIGUATE NAMES FIRST. A short name like "Ford", "CBRE", "Amazon" or "Reconomy" can match several different sites or customers. Before totalling anything, run a quick exploratory query that lists the DISTINCT matches and their row counts, e.g. select "site, customer, source" (or use groupBy on site/customer) so you can SEE what "%ford%" actually matched. Only then total the ones the user really meant.
- WATCH FOR SUBSTRING FALSE MATCHES. ilike "%ford%" also matches "Tel-ford", "Stan-ford", "Stand-ford"; "%cbre%" is usually safe but "%aws%" or "%bp%" are not. After listing the distinct matches, mentally drop the ones that are clearly a different place/company, and tell the user which you included and which you excluded.
- SPLIT AND DEDUPE SOURCES. data_hub_jobs holds both "skiptrak" (weight_t already in TONNES) and "midweigh" (weight in KG — divide by 1000) for the same physical job. Never sum across both blindly. Decide which source answers the question (movements/containers → skiptrak; weighbridge tonnage → midweigh ÷1000), say which you used, and don't double-count a job that appears in both.
- SANITY-CHECK THE NUMBER. If a total looks implausible (e.g. hundreds of tonnes from a handful of skip movements), stop — it usually means a unit mix-up (kg vs tonnes) or a false-match site got included. Re-query before answering.
- STATE YOUR ASSUMPTIONS. When a question is ambiguous, lead with the breakdown by site/customer/source and a clear total for the most likely interpretation, then offer to narrow it — rather than committing to one big number with no context. A correct, qualified answer beats a confident wrong one.
- WORKED EXAMPLE ("how many tonnes from Ford in May"): (1) list distinct sites matching %ford% for that month; (2) notice "Ford Motor Company" and "CBRE - Ford" are real but "JEWSON - Telford" and "Stanford Flooring" are false matches; (3) sum weight_t for the real Ford sites only, on source skiptrak; (4) answer with the per-site breakdown and combined total, naming what you excluded.

BE DETERMINED (this is how you think — like a sharp analyst who refuses to give up):
- You have MANY tool turns available, not one. Use them. A good answer often takes 3–8 queries: orient with schema_info if needed → list distinct matches → pull the rows → cross-check → answer. Never stop at the first query if the answer isn't yet solid.
- If a query returns nothing or looks wrong, DON'T give up — change tactics: broaden the search term, drop the year/date filter, try the OR-group across customer+site, check a related table, or run schema_info to confirm the column name. Exhaust the obvious angles before saying "I couldn't find it".
- Chase the question across tables. The answer may need joining ideas: e.g. find the customer id in "customers", then their sites in "customer_sites", then movements in "data_hub_jobs". Follow the trail step by step.
- VERIFY BEFORE YOU COMMIT. Before giving a final number or a definitive "yes/no", do one explicit sanity pass: does the count look right, are the units right (kg vs tonnes), did any false-match slip in, is the date window the one the user meant? If anything is off, query again. A verified answer is the whole point of this assistant.
- Show your reasoning lightly in the visible reply (what you searched, what you included/excluded, which period) so staff can trust the number — but keep it tight and jargon-free.
- Only say "I don't know" or "I couldn't find that" after you've genuinely tried several approaches, and when you do, say what you tried and suggest how to narrow it.



TAKING ACTIONS (always require user confirmation — propose them in plain English first):
- Generic EDIT. Editable tables: load_reports, load_line_items, pricing_entries, pricing_rate_card_values, pricing_rate_card_rows, pricing_settings, pricing_skip_sizes, pricing_waste_types, rental_chases, rental_agreements, skip_inventory, skip_tracker_reports, crm_tickets, crm_ticket_messages, customers, customer_sites, customer_contacts, customer_reporting_periods, fuel_surcharge_rates. ALWAYS query_data first to find the real ids:
\`\`\`action
{"action":"update_records","table":"crm_tickets","updates":[{"id":"<real-id>","changes":{"status":"closed"}}],"description":"Close 3 CRM tickets"}
\`\`\`
- Generic DELETE (same whitelist):
\`\`\`action
{"action":"delete_records","table":"skip_inventory","ids":["<real-id>"],"description":"Remove 1 inventory record"}
\`\`\`
- Generic ADD. Insertable tables: rental_agreements, customer_contacts, crm_ticket_messages, pricing_entries, fuel_surcharge_rates, customer_reporting_periods:
\`\`\`action
{"action":"insert_records","table":"customer_contacts","rows":[{"customer_id":"<real-id>","name":"Jane Doe","email":"jane@acme.com"}],"description":"Add a new contact for Acme"}
\`\`\`
- MARK A RENTAL BIN COLLECTED (drops it off the over-rental chasing list). First call rental_positions to get the bin's details, then:
\`\`\`action
{"action":"mark_rental_collected","bins":[{"bin_key":"<bin key>","customer":"...","site":"...","container_type":"...","collected_date":"2026-06-25"}],"description":"Mark 1 skip as collected"}
\`\`\`
- Load reports have dedicated tools that also manage line items: create_load_reports, update_load_reports, delete_load_reports.
- CRM status changes: update crm_tickets (e.g. status to "open"/"closed", assigned_to, priority) via update_records.
- Pricing edits: update pricing_entries / pricing_rate_card_values / pricing_skip_sizes via update_records after reading the current values.

CRITICAL RULES:
- ALWAYS read with query_data BEFORE proposing any update/delete — never invent ids.
- Only one action block per message, at the very end.
- Convert tonnes↔kg correctly (×1000) and DD/MM/YYYY dates to YYYY-MM-DD.
- Never propose a write to a table outside the whitelists; instead explain you can only read it.`;
}

function streamTextResponse(text: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic OVER-RENTAL answer.
//
// "What's over-rental / which 40yd bins are out / over the free period" questions are
// high-risk: the loose `rental_positions` dump lets the model guess. This shortcut
// reproduces the EXACT logic the Rentals dashboard uses (computeOverRentalBins on the
// last 12 months of skiptrak movements + live_jobs_settings + manually-collected
// exclusion via rental_chases), so Ask One gives the same numbers as the dashboard.
// ─────────────────────────────────────────────────────────────────────────────

type LiveJobsSettings = {
  rental_free_days: number;
  artic_vehicle_regs: string[];
  artic_container_keywords: string[];
  roro_container_keywords: string[];
  skip_container_keywords: string[];
};

const OR_DEFAULT_SETTINGS: LiveJobsSettings = {
  rental_free_days: 28,
  artic_vehicle_regs: ["FG61 SYV", "FJ18 FDM"],
  artic_container_keywords: ["curtain side", "walking floor", "bulk ejector", "artic haulage"],
  roro_container_keywords: ["ro ro", "roll on roll off", "ro ro haulage"],
  skip_container_keywords: ["skip", "yard", "yd", "chain lift"],
};

type ORJob = {
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  waste_description: string | null;
  vehicle_registration: string | null;
  ewc: string | null;
};

type ORCategory = "skip" | "roro" | "artic";

type ORBin = {
  binKey: string;
  customer: string;
  site: string;
  category: ORCategory;
  containerType: string;
  netOnSite: number;
  daysSinceActivity: number | null;
  lastActivityDate: string | null;
};

function orFmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function orWindowStart(): string {
  // First day of the month, 11 months ago (UTC) — matches the dashboard's date-fns window.
  const now = new Date();
  return orFmtDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)));
}
function orDaysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr + "T00:00:00Z").getTime();
  return Math.floor(ms / 86400000);
}

function orCategorise(containerType: string | null, vehicleReg: string | null, s: LiveJobsSettings): ORCategory | null {
  const ct = containerType?.toLowerCase() ?? "";
  const isSkip = ct && s.skip_container_keywords.some((kw) => ct.includes(kw.toLowerCase()));
  const isRoro = ct && s.roro_container_keywords.some((kw) => ct.includes(kw.toLowerCase()));
  const isArtic = ct && s.artic_container_keywords.some((kw) => ct.includes(kw.toLowerCase()));
  if (isRoro) return "roro";
  if (isSkip) return "skip";
  if (isArtic) return "artic";
  if (vehicleReg) {
    const vr = vehicleReg.toUpperCase().replace(/\s+/g, "");
    if (s.artic_vehicle_regs.some((r) => r.replace(/\s+/g, "").toUpperCase() === vr)) return "artic";
  }
  return null;
}

// Faithful port of computeOverRentalBins (src/lib/overRental.ts).
function orComputeBins(jobs: ORJob[], s: LiveJobsSettings): ORBin[] {
  const windowStart = orWindowStart();
  const isDeliver = (m: string | null) => m === "Deliver";
  const isCollect = (m: string | null) => m === "Collect";
  const isExchange = (m: string | null) => m === "Exchange";
  const isTipReturn = (m: string | null) => m === "Tip/Return";
  const staysOnSite = (m: string | null) => isDeliver(m) || isExchange(m) || isTipReturn(m);
  const maxD = (a: string | null, b: string | null) => (!a ? b : !b ? a : a >= b ? a : b);

  type Pos = { delivered: number; collected: number; lastKeepDate: string | null; lastCollectionDate: string | null };
  type Ctb = {
    lastDeliveryOrExchangeDate: string | null;
    lastTipReturnDate: string | null;
    positions: Record<string, Pos>;
  };
  type SiteAgg = {
    latestCustomer: string;
    latestCustomerDate: string | null;
    site: string;
    category: ORCategory;
    lastDeliveryOrExchangeDate: string | null;
    lastTipReturnDate: string | null;
    lastCollectionDate: string | null;
    ctb: Record<string, Ctb>;
  };

  const siteMap: Record<string, SiteAgg> = {};

  for (const job of jobs) {
    const cat = orCategorise(job.container_type, job.vehicle_registration, s);
    if (!cat) continue;
    const key = `${(job.site || "Unknown").toLowerCase().trim()}|||${cat}`;
    const customerName = job.customer || "Unknown";
    if (!siteMap[key]) {
      siteMap[key] = {
        latestCustomer: customerName, latestCustomerDate: job.job_date, site: job.site || "Unknown", category: cat,
        lastDeliveryOrExchangeDate: null, lastTipReturnDate: null, lastCollectionDate: null, ctb: {},
      };
    }
    const sm = siteMap[key];
    if (job.job_date && (!sm.latestCustomerDate || job.job_date > sm.latestCustomerDate)) {
      sm.latestCustomer = customerName;
      sm.latestCustomerDate = job.job_date;
    }
    if (job.container_type) {
      if (!sm.ctb[job.container_type]) sm.ctb[job.container_type] = { lastDeliveryOrExchangeDate: null, lastTipReturnDate: null, positions: {} };
      const ctb = sm.ctb[job.container_type];
      if (job.job_date && (isDeliver(job.movement_type) || isExchange(job.movement_type))) ctb.lastDeliveryOrExchangeDate = maxD(ctb.lastDeliveryOrExchangeDate, job.job_date);
      if (job.job_date && isTipReturn(job.movement_type)) ctb.lastTipReturnDate = maxD(ctb.lastTipReturnDate, job.job_date);

      const posKey = (job.ewc && job.ewc.trim()) || "__none__";
      if (!ctb.positions[posKey]) ctb.positions[posKey] = { delivered: 0, collected: 0, lastKeepDate: null, lastCollectionDate: null };
      const pos = ctb.positions[posKey];
      if (isDeliver(job.movement_type)) pos.delivered++;
      if (isCollect(job.movement_type)) pos.collected++;
      if (job.job_date && staysOnSite(job.movement_type)) pos.lastKeepDate = maxD(pos.lastKeepDate, job.job_date);
      if (job.job_date && isCollect(job.movement_type)) pos.lastCollectionDate = maxD(pos.lastCollectionDate, job.job_date);
    }
    if (job.job_date && (isDeliver(job.movement_type) || isExchange(job.movement_type))) sm.lastDeliveryOrExchangeDate = maxD(sm.lastDeliveryOrExchangeDate, job.job_date);
    if (job.job_date && isTipReturn(job.movement_type)) sm.lastTipReturnDate = maxD(sm.lastTipReturnDate, job.job_date);
    if (job.job_date && isCollect(job.movement_type)) sm.lastCollectionDate = maxD(sm.lastCollectionDate, job.job_date);
  }

  const positionNet = (p: Pos): number => {
    const net = p.delivered - p.collected;
    const cleared = !!(p.lastCollectionDate && p.lastKeepDate && p.lastCollectionDate >= p.lastKeepDate);
    if (cleared && net <= 0) return 0;
    const activity = p.lastCollectionDate && p.lastKeepDate
      ? (p.lastCollectionDate >= p.lastKeepDate ? p.lastCollectionDate : p.lastKeepDate)
      : (p.lastKeepDate ?? p.lastCollectionDate);
    if (activity && activity < windowStart) return 0;
    return Math.max(net, 0);
  };
  const typeNet = (positions: Record<string, Pos>) => Object.values(positions).reduce((sum, p) => sum + positionNet(p), 0);

  const out: ORBin[] = [];
  for (const sm of Object.values(siteMap)) {
    if (sm.category === "artic") continue;
    const lastKeep = [sm.lastDeliveryOrExchangeDate, sm.lastTipReturnDate].filter((d): d is string => !!d).sort().pop() ?? null;
    const collectionCleared = sm.lastCollectionDate && lastKeep && sm.lastCollectionDate >= lastKeep;
    const daysSinceLastKeep = lastKeep ? orDaysSince(lastKeep) : null;
    const netOnSite = Object.values(sm.ctb).reduce((sum, c) => sum + typeNet(c.positions), 0);
    const isOver =
      daysSinceLastKeep !== null &&
      daysSinceLastKeep > s.rental_free_days &&
      netOnSite > 0 &&
      !collectionCleared &&
      lastKeep !== null &&
      lastKeep >= windowStart;
    if (!isOver) continue;

    for (const [containerType, c] of Object.entries(sm.ctb)) {
      const onSite = typeNet(c.positions);
      if (onSite <= 0) continue;
      const ctbLastKeep = [c.lastDeliveryOrExchangeDate, c.lastTipReturnDate].filter((d): d is string => !!d).sort().pop() ?? null;
      const days = ctbLastKeep ? orDaysSince(ctbLastKeep) : null;
      if (days === null || days <= s.rental_free_days) continue;
      if (ctbLastKeep! < windowStart) continue;
      out.push({
        binKey: `${sm.site.toLowerCase().trim()}|||${containerType.toLowerCase().trim()}`,
        customer: sm.latestCustomer, site: sm.site, category: sm.category, containerType,
        netOnSite: onSite, daysSinceActivity: days, lastActivityDate: ctbLastKeep,
      });
    }
  }
  out.sort((a, b) => (b.daysSinceActivity ?? 0) - (a.daysSinceActivity ?? 0));
  return out;
}

async function answerOverRentalQuestion(supabase: any, messages: ChatMessage[]): Promise<string | null> {
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === "user")?.content || "";
  // Trigger only on over-rental / over-the-free-period questions.
  const isOverRentalQ =
    /over[\s-]?rental/i.test(lastUser) ||
    /over (?:the )?(?:free )?rental/i.test(lastUser) ||
    (/\brental\b/i.test(lastUser) && /\b(over|overdue|out|on site|still out|chase)\b/i.test(lastUser));
  if (!isOverRentalQ) return null;

  // Optional filters from the question.
  const sizeMatch = lastUser.match(/(\d+)\s*(?:yd|yard)/i) || lastUser.match(/\b(\d{1,2})\s*yd\b/i);
  const sizeNum = sizeMatch ? Number(sizeMatch[1]) : null;
  const wantsRoro = /\bro\s*ro\b|\broros?\b/i.test(lastUser);
  const wantsSkip = /\bskips?\b/i.test(lastUser) && !wantsRoro;

  // Load settings (merge defaults).
  const settings: LiveJobsSettings = { ...OR_DEFAULT_SETTINGS };
  try {
    const { data: rows } = await supabase.from("live_jobs_settings").select("setting_key, setting_value");
    for (const row of rows || []) {
      const k = row.setting_key as keyof LiveJobsSettings;
      if (k in settings) {
        if (k === "rental_free_days") (settings as any)[k] = Number(row.setting_value);
        else (settings as any)[k] = row.setting_value;
      }
    }
  } catch { /* defaults are fine */ }

  // Fetch the last 12 months of skiptrak movements (same window as the dashboard).
  const since = orWindowStart();
  const jobs: ORJob[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("data_hub_jobs")
      .select("job_number,job_date,customer,site,container_type,movement_type,waste_description,vehicle_registration,ewc")
      .eq("source", "skiptrak")
      .gte("job_date", since)
      .in("movement_type", ["Deliver", "Exchange", "Collect", "Tip/Return"])
      .order("job_date", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return `I couldn't check the rental data — the lookup failed: ${error.message}`;
    const batch = (data || []) as ORJob[];
    jobs.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
    if (from > 60000) break;
  }

  let bins = orComputeBins(jobs, settings);

  // Exclude bins staff have manually marked collected.
  try {
    const { data: chases } = await supabase.from("rental_chases").select("bin_key, collected");
    const collected = new Set<string>((chases || []).filter((c: any) => c.collected).map((c: any) => c.bin_key));
    bins = bins.filter((b) => !collected.has(b.binKey));
  } catch { /* if chases unavailable, show all */ }

  // Apply size / category filters from the question.
  const sizeLabelParts: string[] = [];
  if (sizeNum !== null) {
    sizeLabelParts.push(`${sizeNum}yd`);
    bins = bins.filter((b) => {
      const nums = (b.containerType.match(/\d+/g) || []).map(Number);
      return nums.includes(sizeNum);
    });
  }
  if (wantsRoro) { sizeLabelParts.push("RoRo"); bins = bins.filter((b) => b.category === "roro"); }
  else if (wantsSkip) { sizeLabelParts.push("skip"); bins = bins.filter((b) => b.category === "skip"); }

  const filterLabel = sizeLabelParts.length ? ` ${sizeLabelParts.join(" ")}` : "";

  if (bins.length === 0) {
    return `Good news — I can't find any${filterLabel} containers currently over the ${settings.rental_free_days}-day free rental period.`;
  }

  const lines = bins.slice(0, 40).map((b) => {
    const qty = b.netOnSite > 1 ? `${b.netOnSite}× ` : "";
    return `- **${b.customer}** — ${b.site}: ${qty}${b.containerType} · ${b.daysSinceActivity} days on site (since ${b.lastActivityDate})`;
  }).join("\n");

  const totalContainers = bins.reduce((sum, b) => sum + b.netOnSite, 0);
  const intro = bins.length === 1
    ? `There's **1${filterLabel} container** over the ${settings.rental_free_days}-day free rental period:`
    : `There are **${bins.length}${filterLabel} bins** (${totalContainers} containers) over the ${settings.rental_free_days}-day free rental period:`;
  const more = bins.length > 40 ? `\n\n…and ${bins.length - 40} more. Open the Rentals section for the full list.` : "";

  return `${intro}\n\n${lines}${more}`;
}

async function answerTonnageQuestion(supabase: any, messages: ChatMessage[]): Promise<string | null> {
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === "user")?.content || "";
  const parsed = parseTonnageQuestion(lastUser);
  if (!parsed) return null;

  const { start, end, label } = monthWindow(parsed.month, parsed.year);
  const like = `%${parsed.entity}%`;
  const { data, error } = await supabase
    .from("data_hub_jobs")
    .select("job_number, job_date, customer, site, weight_t, source")
    .eq("source", "skiptrak")
    .gte("job_date", start)
    .lt("job_date", end)
    .or(`customer.ilike.${like},site.ilike.${like}`)
    .limit(1000);

  if (error) return `I couldn't check that properly — the data lookup failed: ${error.message}`;

  const rows = (data || []) as Array<{ job_number: string | null; job_date: string; customer: string | null; site: string | null; weight_t: number | string | null }>;
  const included = rows.filter((r) => isEntityMatch(parsed.entity, r.customer) || isEntityMatch(parsed.entity, r.site));
  const excluded = rows.filter((r) => !included.includes(r));

  if (included.length === 0) {
    if (rows.length === 0) return `I checked ${label} and couldn't find any Skiptrak tonnage rows matching “${parsed.entity}”.`;
    const matches = summariseBySite(rows).slice(0, 5).map((r) => `- ${r.site}: ${formatTonnes(r.tonnes)} t`).join("\n");
    return `I found loose matches for “${parsed.entity}” in ${label}, but none looked like a clean company/site match. The loose matches were:\n${matches}`;
  }

  const bySite = summariseBySite(included);
  const total = bySite.reduce((sum, row) => sum + row.tonnes, 0);
  const lines = bySite.map((r) => `- ${r.site}: ${formatTonnes(r.tonnes)} t (${r.jobs} job${r.jobs === 1 ? "" : "s"})`).join("\n");
  const excludedSites = summariseBySite(excluded)
    .map((r) => r.site)
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");

  return `For ${label}, using Skiptrak tonnage and excluding false text matches, I make it **${formatTonnes(total)} tonnes** for “${parsed.entity}”.\n\n${lines}${excludedSites ? `\n\nI excluded lookalike matches such as ${excludedSites}.` : ""}`;
}

function parseTonnageQuestion(text: string): { entity: string; month: number; year?: number } | null {
  if (!/\b(tonnes?|tons?|weight|waste)\b/i.test(text)) return null;
  const months: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
    may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
    october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
  };
  const monthMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?\b/i);
  if (!monthMatch) return null;
  const beforeMonth = text.slice(0, monthMatch.index).trim();
  const entityMatch = beforeMonth.match(/\b(?:from|for|at)\s+(.+?)\s*(?:$|\?)/i);
  const rawEntity = entityMatch?.[1]?.replace(/\b(?:in|during|for)\s*$/i, "").trim();
  if (!rawEntity || rawEntity.length < 2) return null;
  return { entity: rawEntity, month: months[monthMatch[1].toLowerCase()], year: monthMatch[2] ? Number(monthMatch[2]) : undefined };
}

function monthWindow(month: number, requestedYear?: number): { start: string; end: string; label: string } {
  const today = new Date();
  let year = requestedYear ?? today.getUTCFullYear();
  if (!requestedYear && month > today.getUTCMonth()) year -= 1;
  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate = new Date(Date.UTC(year, month + 1, 1));
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
    label: startDate.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

function isEntityMatch(entity: string, value?: string | null): boolean {
  if (!value) return false;
  const e = entity.toLowerCase().trim();
  const v = value.toLowerCase();
  if (e.includes(" ")) return v.includes(e);
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(e)}([^a-z0-9]|$)`, "i").test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summariseBySite(rows: Array<{ job_number: string | null; customer: string | null; site: string | null; weight_t: number | string | null }>) {
  const map = new Map<string, { site: string; tonnes: number; jobs: number; jobNumbers: Set<string> }>();
  for (const row of rows) {
    const key = row.site || row.customer || "Unknown";
    if (!map.has(key)) map.set(key, { site: key, tonnes: 0, jobs: 0, jobNumbers: new Set() });
    const item = map.get(key)!;
    const jobKey = row.job_number || `${key}-${item.jobs}`;
    if (!item.jobNumbers.has(jobKey)) {
      item.jobNumbers.add(jobKey);
      item.jobs += 1;
    }
    item.tonnes += Number(row.weight_t || 0);
  }
  return Array.from(map.values())
    .map(({ jobNumbers: _jobNumbers, ...rest }) => ({ ...rest, tonnes: Math.round(rest.tonnes * 1000) / 1000 }))
    .sort((a, b) => b.tonnes - a.tonnes);
}

function formatTonnes(value: number): string {
  return value.toLocaleString("en-GB", { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}



// ---------- Generic read ----------
async function queryData(
  supabase: any,
  spec: { table?: string; select?: string; filters?: any[]; or?: string; orderBy?: { column: string; ascending?: boolean }; limit?: number; groupBy?: string[]; aggregate?: { sum?: string } },
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

    // OR group, e.g. "customer.ilike.*reconomy*,site.ilike.*cbre*"
    if (spec.or && typeof spec.or === "string" && spec.or.trim()) {
      q = q.or(spec.or.trim());
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

// ---------- Schema discovery ----------
// Lets the assistant explore what data exists before querying — the same way a
// colleague with DB access would look at the tables and their columns first.
async function schemaInfo(supabase: any, spec: { table?: string }) {
  if (!spec?.table) {
    return { tables: Array.from(READ_WHITELIST).sort() };
  }
  if (!READ_WHITELIST.has(spec.table)) {
    return { error: `Table "${spec.table}" is not readable.`, tables: Array.from(READ_WHITELIST).sort() };
  }
  try {
    const { data, error } = await supabase.from(spec.table).select("*").limit(1);
    if (error) return { error: error.message, columns: [] };
    const columns = data && data[0] ? Object.keys(data[0]) : [];
    return { table: spec.table, columns, sample: data?.[0] ?? null };
  } catch (err: any) {
    return { error: err.message, columns: [] };
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

async function insertRecords(
  supabase: any,
  data: { table?: string; rows?: any[] },
  userId: string,
) {
  const results: { created: number; errors: string[] } = { created: 0, errors: [] };
  if (!data?.table || !INSERT_WHITELIST.has(data.table)) {
    results.errors.push(`Adding to "${data?.table}" is not permitted.`);
    return results;
  }
  for (const row of data.rows || []) {
    try {
      const payload = { ...row };
      // Stamp the creator where the table supports it.
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

// Mark one or more over-rental bins as collected. Upserts a rental_chases row
// keyed by bin_key, then flags it resolved/collected so it drops off the list.
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
      const { data: existing } = await supabase
        .from("rental_chases").select("id").eq("bin_key", bin.bin_key).maybeSingle();
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
