# Roadmap
- [x] Add Jamie-only P&L within Finance; restricted worksheet tests pass, Jamie import/save/reload and anonymous restrictions verified; synthetic verification data removed.
- [x] Import supplied 2023–2026 company P&L; every saved worksheet matches source, 2023–2024 contain Full set only, 2025–2026 include both EBITDA tabs; 2026 source errors preserved and flagged. Four tests pass and signed-in reload verified.
- [x] Simplify non-ferrous dispatch date/time and destination recording; save grade preferences atomically and include destinations in stock, history and reports. Five metals tests pass; preview builds clean.
- [ ] Verify metal dispatch saving and preference reuse through a signed-in screen (blocked: no preview session; requesting user has no matching account).
- [x] Apply residential selection in Pricing and Inbox drafts; VAT and material tests pass, personal-email quote verified in preview. Inbox draft end-to-end remains unverified because function authentication rejected the test request.

- [x] Add author-attributed rental notes and No Rental agreements, retaining on-site duration tracking; verify saved changes.

- [x] Correct shared postcode settings so all CV21 postcodes use Zone 1; verified saved coverage and CV21 7DT matching tests.

- [x] Stop unmatched email-quote postcodes such as CV21 7DT silently receiving Zone 3 prices; require a confirmed zone and test postcode matching.

- [x] State the rental charges in pricing quote emails: £18/week skip, £42/week RoRo plus VAT after the saved free period.


- [x] Non-ferrous metal tracking: PIN yard phone app + office section (dashboard, stock with 500 kg alerts, dispatches, prices, reports, audit). No storage locations.

- [x] Correct WeighOne tablet screen filling and retain tablet view when reopening; verify landscape and portrait.

- [x] Add installable WeighOne tablet view, touch-friendly contamination review and staff installation guide; verify tablet layouts.

- [x] Add RouteOne daily driver job sheets and imported-ticket printing, plus print actions on both Midweigh lists; verify real tickets.

- [x] Remove RouteOne driver vehicle icons, resolve groups from daily vehicles, and strengthen vehicle-type boundaries; verify Monday.

- [x] Add RouteOne truck icons and daily vehicle groups, six-driver scrolling, and collapsible groups above eight drivers; verify the board.

- [x] Add WeighOne full-screen mode and a combined RouteOne / Midweigh ticket list.

- [x] Apply presentation-only recommendations from the 2 Oct design brief without changing data management, reporting calculations, access, or DWT.
- [x] Assistant overhaul (history, saved prompts, progress steps, stop/retry, tables, tonnes) and live read-only dashboard figures.
- [ ] Scheduled reports and reporting fixes (deferred by user)
- [x] Add a top-right Help icon and team how-to guides for monthly rebates and skip count.
- [ ] Staci total weight must include every item (pallet entries, bales, dolavs, loose, good/scrap pallets)
- [ ] Green pallet value set to -10 is not being saved on the load report

- [x] Restore WasteOne login by restarting the unresponsive backend and verify sign-ins recover.
- [x] Shareable links for site inductions: staff create links per document; guests read and sign without a login; signatures saved as guest signatures.
- [x] Add reviewed waste-classification defaults and hazardous/POPs capture in Route One, driver sign-off and Weigh One, without changing DEFRA uploads.

- [x] Tidy RouteOne controls into one row; keep New Job prominent; move Driver App and Add Driver into Setup; remove the page Full Screen control.
- [x] Strengthen portal text contrast and refresh shared buttons, tabs, toggles, and key WeighOne icons with WasteOne and semantic colours.
- [x] CRM pipeline steps 3–7: suggested assignee, contract-number linking, price/fuel-surcharge lookups in drafts, extracted-details strip, one-click actions (prefilled New Job, awaiting customer, mark resolved).

- [x] Highlight rental notes waiting to be read.
- [x] Save changed rental chase email addresses to the customer contacts.
- [x] Finance review: show every customer name on invoice lists and in the New invoice list; verify all 18 rows and the full active customer list.
- [x] Show the date beside each Route One booking day (MON 19) on the bookings board; verify live board and day pickers.
