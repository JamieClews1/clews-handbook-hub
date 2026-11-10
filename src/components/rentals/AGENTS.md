# Rentals

Rental chase-email wording (template, placeholders, site/postcode, waste-type label) lives in `src/lib/rental-chase-email.ts`, separate from bin computation, so email text is testable without touching operational records.
- Rental note history is append-only and authors are stamped from the authenticated user in database triggers, including edits to legacy notes; No Rental is an agreement mode with a server-enforced zero rate, and covered-container tracking reuses the shared physical-balance calculator without the chase free-period threshold.
- Rental assignment menus share a profiles/staff-role eligibility helper; a database trigger validates new assignees to prevent alternate writes bypassing eligibility.
- Rental job pagination must succeed in full before publishing results; failed reads show a retry state, never an empty or partial rental count.
- Rentals and Live Jobs share chronological physical-container replay: completed historical movements only, spelling/price-suffix size matching, collections consume slots and exchanges replace tickets, so closed tickets cannot be chased and replacement rental clocks remain independent.
- Rental replay scopes site identity to the customer and only removes non-address contact prefixes before exact numbered streets; preserve house numbers/units and isolate unknown sites to avoid clearing unrelated containers. Both views reject incomplete paginated reads.
- Chase recipients come from `src/lib/rental-chase-contacts.ts` (customer contacts, then PO/POD addresses, excluding Clews' own mailboxes); customers and contacts are paged past the 1,000-row read cap so every customer's addresses are offered.
