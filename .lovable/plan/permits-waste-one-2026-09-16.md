# Permits (Waste One)

A new Permits area that works out which council a skip permit is needed from, raises the application email, watches the orders inbox for the council's reply, and chases expiries.

## What you get

**New "Permits" page in Waste One** with three tabs:

1. **Applications** — every job that needs a permit, with its council, notice band, price, status (Needed → Applied → Confirmed → Active → Expiring → Expired / Rejected), permit reference and dates.
2. **Expiry tracking** — permits ordered by days remaining, with a red highlight inside 72 hours and a clear marker for those where a skip is still on site.
3. **Settings (CMS)** — everything configurable, no code needed.

**Council lookup from postcode.** Enter or pick up a job's postcode and the matching council area, permit length and price appear automatically, using the eight live rates already proven on the marketing site (Rugby/Crick, Daventry, Coventry, Warwick/Leamington, Lutterworth), including the notice bands and the partial-postcode rule for LE17 4. Postcodes typed without a space still match. If nothing matches, the job is flagged "no standard rate — quote separately" rather than blocked.

**RouteOne integration.** A job can be marked as needing a permit. Both the kanban cards and the list view then show a permit badge coloured by state: amber "Permit needed", blue "Applied", green "Permit active", red "Expires in Xh" / "Expired". Clicking it opens the permit record.

**Application emails.** From an application you get a pre-filled email to the council (address and wording per council, from templates), showing the job, site address, skip size, requested start date and permit duration. Settings choose whether it sends straight away or waits for someone to review and press send. Every send is logged with the date, recipient and body.

**Reading the orders inbox.** The existing orders mailbox sync already pulls messages into the CRM. Permit records are matched to incoming messages by the council's email address plus the permit reference or postcode in the subject/body, and the reply is attached to the permit record. A confirmation reply can auto-set the permit to Confirmed and capture the reference and dates; an approval step can be required instead. Unmatched council emails appear in a small "needs linking" list so nothing is lost.

**Expiry chasing.** A daily check emails orders@ when a permit is within 72 hours of expiry **and** the skip is still on site (using the existing live-jobs/on-site logic). One chase per permit per expiry window, so no repeat spam, and it's logged against the permit.

## Settings CMS covers

- Council areas: name, postcodes, permit days, price exc VAT (inc VAT auto ×1.2), notice band, order, active toggle — editable grid, same behaviour as the marketing site.
- Council contacts: application email address(es), CC, portal/notes per area.
- Email templates: application email and the 72-hour expiry chase, with placeholders (job number, customer, site address, postcode, skip size, dates, permit reference, price).
- Automation switches: auto-send applications on/off, auto-confirm from replies on/off, chase lead time (default 72 hours), chase recipient (default orders@), enable/disable the daily check.

## Technical notes

- Tables: `permit_pricing` (schema and seed rows from the supplied export, with grants, RLS and updated_at trigger), `permit_councils` (contact emails per area), `permit_applications` (job link, council, status, reference, start/expiry dates, price, notes), `permit_email_log`, `permit_settings` (single settings row + templates).
- `route_one_jobs` gains `permit_required` and a `permit_application_id` link; the kanban/list badge reads from the joined permit row.
- Shared matcher utility `src/lib/permits.ts` implementing the normalise-then-match rules (exact outward code for spaceless tokens, compact prefix for tokens with a space).
- Edge functions: `permit-apply` (build + send the application via the existing Resend sender from noreply.clewsrecycling.co.uk), `permit-inbox-match` (link CRM messages from council addresses to permits and apply confirmations), `permit-expiry-check` (daily pg_cron, bounded batch, idempotent per permit/window, logs each chase).
- UI: `src/pages/PermitsPage.tsx` plus components under `src/components/permits/`; route `/permits`, sidebar entry in the Waste One group, staff-protected.

## Verification

- Postcodes CV22 7PY, CV227PY, LE17 4XX, NN11 and an unmatched postcode all resolve as expected.
- A test job marked permit-required shows the badge in both kanban and list views and moves through the statuses.
- An application email renders correctly and is logged; a simulated council reply links and confirms.
- The expiry check fires once for a permit 48 hours from expiry with a skip on site, and not for one with no skip on site.
