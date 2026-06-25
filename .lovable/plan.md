# Portal AI Assistant ("Ask One")

Build a portal-wide AI assistant that behaves like the Lovable agent: it reads and interprets your data in plain English, and can take administrative actions — with no model training, just instructions + a fixed set of safe tools. It generalises the two agents you already have (`data-hub-ai` for reading, `admin-agent` for load-report actions) into one assistant available to all staff, as both a floating widget and a dedicated page.

## How it works (no training needed)
The assistant is three parts, exactly like me:
1. **Instructions** — a server-side system prompt describing its job, your schema, tone, and the rules it must follow.
2. **Tools** — a fixed menu of safe operations it can call. It decides which to call; your code runs the actual database work and validates everything.
3. **Result interpretation** — tool output is fed back to the model so it explains findings in plain English.

```text
Staff question ─▶ model picks a tool ─▶ edge function runs it (validated, server-side)
       ▲                                            │
       └────────── plain-English answer ◀── results fed back to model
```

## Backend — one edge function: `portal-assistant`
A new Supabase edge function modelled on `admin-agent` (auth via JWT, streaming chat, hidden `action` blocks the UI strips and confirms).

**Read tool (safe, any staff):** `query_data`
- The model proposes a read against a **whitelist of tables**: `data_hub_jobs`, load reports + line items, rentals/rental_chases, stock (skip_inventory, stock_checks), pricing (rate cards, entries, settings), customers/sites, CRM tickets, fuel surcharges.
- Reuses the proven `data-hub-ai` approach: model returns a structured query spec (select / filters / groupBy / orderBy / limit), executed with the Supabase client. No raw SQL is executed. Capped row limits.
- It can also call the existing `get_skiptrak_rental_positions` RPC for rentals questions.

**Action tools (write, confirmation required):**
- Port the existing load-report actions (`create/update/delete/query_load_reports`) verbatim from `admin-agent`.
- Add guarded write actions for the other areas you selected, e.g. update pricing entries/rate-card values, mark rental bins collected, update a CRM ticket status, edit stock inventory.
- Every write follows the admin-agent safety contract: **query first → propose in plain English → execute only after the user clicks Confirm.** No write runs without explicit confirmation.

**Security:** function verifies the JWT and requires an authenticated staff user (all signed-in staff). Reads use the table whitelist; writes are limited to the whitelisted action handlers. Destructive actions always need confirmation. Mutations are logged (reusing the existing job-override / assignment-log style audit where present).

## Frontend
1. **`PortalAssistantWidget.tsx`** — a floating chat bubble available on every portal page (generalised from `AdminAgentWidget`): streaming replies, markdown rendering, spreadsheet attach, and a Confirm/Cancel card for proposed actions.
2. **Dedicated `/assistant` page** — full-page chat with more room for result tables and Excel export (reuses the widget's chat core plus the `DataHubAIChat` result-table renderer).
3. Mount the widget in the portal layout; add a nav/sidebar entry for the page. Gate both to signed-in staff.

## Technical notes
- Model: `google/gemini-3-flash-preview` via Lovable AI Gateway (already configured; `LOVABLE_API_KEY` present). Handle 429/402 with clear messages.
- Reuse existing patterns rather than new infra: streaming SSE response, hidden ```action``` blocks, query-before-write rule.
- Start with reads enabled everywhere + writes for load reports (already battle-tested), then layer in the additional write actions area by area so each is verified before the next.

## What I'll build first
Edge function `portal-assistant` (read tool across all selected areas + load-report write actions), the floating widget, and the `/assistant` page — then extend write actions to pricing, rentals, stock, and CRM in follow-up passes.