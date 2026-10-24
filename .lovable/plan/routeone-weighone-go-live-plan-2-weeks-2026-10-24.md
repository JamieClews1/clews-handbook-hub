# RouteOne + WeighOne go-live plan (2 weeks)

Goal: one reliable chain — **book in RouteOne → driver completes → weighed at WeighOne (one or more tickets) → staff click "Create invoice" → priced draft → send**. Cash/card weighbridge customers get a full priced ticket.

## What the review found

Works today:
- RouteOne booking with rate-card pricing (haulage + per-tonne).
- Driver app shows and completes the same job.
- WeighOne pricing, extras, contamination checks (Banksman) and WTN tickets.

Blocking go-live:
1. **Driver app security** – anyone who can call the driver service could change any job; job lookup matches drivers by partial name.
2. **Jobs don't reach the weighbridge** – WeighOne only lets you pick today's Skiptrak imports, not RouteOne jobs, so the weighbridge operator retypes customer, site and waste.
3. **Invoicing is disconnected** – "Generate from job" only searches imported jobs, always starts at £0.00, and treats Midweigh kilograms as tonnes (7,840 kg would invoice as 7,840 t).
4. **Double-billing risk** – nothing stops a job being invoiced twice; an invoice can be saved without its lines.
5. **Hidden step** – an assigned job isn't sent to the driver until someone presses "Make live" in a menu.
6. **Weighing marks the RouteOne job completed** and edits to weights don't flow back.

## Changes

### Week 1 — make the chain connected and safe
1. **Driver app security**: PIN sign-in issues a short-lived driver pass; every driver action checks the pass and that the job belongs to that driver. PINs are never sent back to the app. Imported jobs are matched by exact driver identity, not partial names.
2. **"Save & send to driver"** button on booking, plus clear Draft / Sent badges on the board.
3. **WeighOne arrival picker**: search RouteOne jobs (job no., reg, driver, customer) across today ± 2 days. Picking one fills customer, site, waste, EWC, container, driver, vehicle and PO, and carries the booked per-tonne rate.
4. **Several tickets per job**: a job can have many weigh tickets; the job shows total tonnes from all of them. Weighing no longer overwrites the driver's completion status — the job gets a separate "Weighed" state.
5. Weight checks: block a second weigh that is missing a weight or gives a negative net.

### Week 2 — one-click invoicing
6. **Ready to invoice** list in Finance: completed RouteOne jobs with their weigh tickets, showing problems clearly (missing price, customer not set up for invoicing, contamination awaiting decision, still on site).
7. **Create invoice** (staff-triggered only) builds the draft automatically:
   - Haulage line = booked price.
   - Tonnage line = total tonnes from all tickets × booked per-tonne rate, minus included tonnes where agreed (e.g. first tonne included).
   - Weighbridge extras and approved contamination charges added as lines.
   - Weights always converted correctly (Midweigh kg → tonnes).
   - Saved all-at-once; a job already invoiced shows "Already invoiced – open". Zero prices are blocked unless a reason is entered.
8. Same "Create invoice" button on the RouteOne job and WeighOne ticket.
9. **Cash/card weighbridge**: the ticket prints with net weight, rate, extras, VAT and total, and shows the payment taken. Paid tickets never appear in the invoice list. Fix paid time being reset when the ticket is saved again.

### Final days — test with real jobs
10. End-to-end run with a real booking: book → driver app → two weigh tickets → invoice draft; plus a cash customer. Retry/double-click tests to prove nothing is created twice.

## Out of scope for go-live
Route optimisation changes, Sage/Xero sync, finance redesign, new settings screens.

## Technical details
- New edge-function driver session token (signed, ~12h) verified in `driver-actions`/`driver-jobs`; ownership check `assigned_driver_id = session driver`; strip `pin` from selects.
- New `route_one_job_weighings(job_id, weighbridge_transaction_id unique)` join table (keep existing `weighbridge_transaction_id` column for back-compat); `weighed_at` on `route_one_jobs` instead of setting `status='completed'`.
- Server-side RPCs: `create_weigh_ticket_for_job` (transactional, client idempotency key) and `create_invoice_from_job(job_id)` — atomic header + lines, `invoice_line_items.source_job_id/source_transaction_id`, unique index preventing a job/ticket being invoiced twice, `ticketWeightTonnes()` shared conversion.
- Fix `InvoiceCreateDialog` Midweigh kg bug immediately as part of step 7; tests for conversion, first-tonne rule and duplicate prevention.
