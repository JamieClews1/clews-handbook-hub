# Roadmap
- [x] Copy imported exchange explicit booking prices and add optional fuel surcharge; 13 tests pass, signed-in £811 haulage and £4.95 fuel add/remove verified without saving, preview clean. Skiptrak exports without separate per-tonne rates prompt staff review rather than guessing.
- [x] Streamline new exchanges: inherited-site summary, date/driver/PO first, optional considerations and rate lookup; signed-in imported exchange and tab retention verified without saving, shared native copying tests pass, preview clean.
- [x] Streamline RouteOne job workspace: fixed identity/actions and price summary, searchable site table, safe separate New exchange. Eleven tests pass; signed-in existing-job save/reopen, site search, unsaved exchange and current screen-size actions verified; no new job dispatched.
- [x] Correct RouteOne established site addresses from customer and Skiptrak data; add 81 sites and fill 98 missing addresses; booking/site/future business-cost tabs with POPs and extras before pricing; signed-in selection and tab retention verified without creating jobs.
## RouteOne + WeighOne go-live (plan approved 24 Oct)
- [x] 1. Driver app security: signed driver pass, job ownership checks, no PINs returned, exact imported-driver matching
- [x] 2. Save & send to driver + Draft/Sent badges
- [x] 3. WeighOne RouteOne arrival picker (today ±2 days) with prefill and booked rate
- [x] 4. Several weigh tickets per job; separate Weighed state
- [x] 5. Second-weigh validation (missing / negative net)
- [x] 6. Ready to invoice list in Finance
- [x] 7. Create invoice from job (atomic, no duplicates, kg→t, first tonne included, extras, zero-price reason)
- [x] 8. Create invoice buttons on RouteOne job and WeighOne ticket
- [x] 9. Cash/card priced ticket; paid time preserved
- [ ] 10. End-to-end test with a real booking (blocked: needs a real job booked, driven and weighed by your team)
- [x] Repair customer reset email requests and add public recovery page; request API returns 200, invalid links rejected, six tests pass, preview build clean, create-user deployed.
- [ ] Verify delivery and password saving from a real customer reset email (blocked: customer inbox/link unavailable; customer-facing page changes need publishing).
- [x] Limit the P&L access list to active office staff; Jamie-only management and existing grants retained. Five authenticated tests pass and Jamie’s settings list verified.
- [x] Add Jamie-only P&L access management; signed-in grant/revoke save and reload verified, original permissions restored; staff read only, Jamie imports.
- [x] Add private P&L Year-on-Year tracker with revenue/cost selection, matched months and bar charts; 25 tests pass and signed-in Waste Income/Diesel, complete-year and missing-month controls verified against real worksheets.
- [x] Add private P&L Sales view with portal waste values and uploaded other revenue, keeping accounting totals distinct; 30 tests pass and signed-in actuals verified. Missing June Skiptrak evidence leaves complete combined totals unavailable.
- [x] Recognise Lee.Gane and Lee Gane as one RouteOne driver; 9 tests pass and signed-in Wednesday proposal shows 6 drivers working with Lee's 6 jobs. No plan applied.
- [x] Add read-only Skiptrak/Midweigh evidence and optional forecasts in P&L Settings; Clews January alignment fixed, 26 tests pass and Jamie views verified. Missing June completed-status evidence safely blocks adjustments.
- [x] Add read-only Company P&L year-end projections using the selected worksheet; 14 tests pass, Jamie's actual figures and RFS selection verified, preview clean.
- [x] Add month-by-month rest-of-year forecast to Projections, following the prior year's seasonal shape scaled by this year's growth; 10 tests pass, real-figure run verified (Dec follows 2025's pattern), preview clean.
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
