# Auto day routing in RouteOne

Turn the routing example into a working feature: editable rules in RouteOne Setup, plus a "Reorganise day" option that proposes a new plan for the selected date and only applies it when you accept.

## 1. New "Routing Rules" tab in RouteOne Setup

All values editable, with sensible starting values from the example:

- Skip loads out: max empty skips carried per trip (default 3), and separate caps per size, e.g. max 8yd (3) and max 12yd (2) per load, plus an overall "max skips on an empty vehicle" figure.
- Ro-Ro: one container per trip (editable), no nesting.
- Time assumptions: minutes on site for delivery, collection, exchange, tipping, average travel minutes between jobs, break minutes, day start time, day length.
- Artic drivers: list of registrations that mark artic/curtain-side work. Pre-filled with FG61 SYV and FJ18 FDM.
- Toggles: skip drivers never get Ro-Ro work; drivers with no jobs on the day are treated as not working; loaded skips return one at a time.

Rules are stored in the database so they apply for everyone, and the artic registrations stay in step with the Live Jobs list of artic vehicles.

## 2. Reorganise the day

A "Reorganise day" button on the Day view:

1. Reads the jobs already on the selected date (both uploaded Skiptrak jobs and RouteOne tickets).
2. Works out which drivers are working — only drivers who already have at least one job that day, each with their single assigned vehicle.
3. Splits work by vehicle type: skip work to skip lorries, Ro-Ro work to Ro-Ro vehicles (one at a time), artic/curtain-side work to the artic registrations.
4. Groups deliveries so empty skips travel together up to the configured caps, orders jobs by postcode outward then back, puts tipping runs where they fit, and balances the number of jobs per driver.
5. Shows the proposed day side by side with the current one: each driver, their jobs in order, estimated times, and a short reason for each change.
6. Nothing moves until you press Apply. Apply reassigns and re-sequences the jobs; Cancel discards it.

A warnings panel flags anything blocking a clean plan: drivers sharing a registration, active drivers with no vehicle, jobs whose container type can't be matched to any working vehicle.

## Technical notes

- New table `route_one_routing_rules` (single settings row, key/value style) with admin-only write and staff read, following the existing `live_jobs_settings` pattern.
- New `src/components/route-one/RoutingRulesSettings.tsx` added as a tab in the Setup sheet in `src/pages/RouteOnePage.tsx`.
- Routing engine as a pure function in `src/lib/route-planner.ts` (inputs: jobs, drivers+vehicles, rules; output: per-driver ordered plan + reasons + warnings) so it can be unit-reasoned and reused later.
- New `RoutingProposalDialog.tsx` renders current vs proposed and applies changes via a single batched update of `assigned_driver_id` and sequence.
- Driver-vehicle uniqueness enforced in `DriverSettings` (a vehicle already assigned to another driver is blocked with a clear message).
- Sequencing uses straight-line distance between job postcodes with the existing postcode zone data; no external mapping call.
