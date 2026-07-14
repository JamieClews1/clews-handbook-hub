
# WasteOne UI modernization — rollout plan

Scope: visual/UX pass only. No IA, routing, or feature changes. Follows the brief's own recommendation to ship in stages so each screen can be reviewed before the next.

## Stage 1 — Design tokens (foundation, every later stage inherits)

Edit `src/index.css` and `tailwind.config.ts`:

- **Sidebar surface**: new token `--sidebar-background: 220 10% 9%` (near-black `#14161A`), `--sidebar-foreground` muted gray, `--sidebar-accent` = brand green filled pill.
- **Semantic palette** (locked meanings): `--success` green, `--warning` amber, `--destructive` red, `--info` blue, `--muted` gray. Category tag colors move into a separate `--tag-*` scale so status vs. category never share a token.
- **Radius scale**: `--radius-sm: 8px` (controls/pills), `--radius: 12px` (cards), `--radius-lg: 16px` (modals).
- **Type scale**: 12 / 13 / 14 / 16 / 20 / 26–28. Restrict weights to 400/500 (drop 600/700 utility overrides from components in later stages).
- **Elevation**: hairline border token `--border-hairline` for cards; shadow tokens reserved for floating (`--shadow-pop` for modals/dropdowns/popovers only).
- **Spacing helpers**: table row min-height `44px`, card padding `p-5`, grid gap tokens `gap-3` (stats) / `gap-4` (panels).

## Stage 2 — Sidebar

`src/components/AppSidebar.tsx`:
- Near-black background via new sidebar tokens.
- Group labels: uppercase, 11px, muted; 20px gap between groups.
- Active item: filled green pill behind icon + label (not just text color).
- Setup group collapsed by default; state persisted in `localStorage`.
- Icon sizes normalized to 18–20px.

## Stage 3 — Live Jobs dashboard

`src/components/live-jobs/LiveJobsDashboard.tsx`:
- Stat card row: filled 28–32px icon badge (semantic tint) → 13px muted label → 26px/500 number. Over-Rental card gets full hairline red border.
- Monthly chart: light horizontal gridlines, soft area fill under skips line, top-right legend, hover tooltips, wrapped in card matching stat padding.
- Filter pills: filled bg for selected; "More" overflow when > ~8 sizes.
- Site tables: sticky header, row hover tint, 44–48px rows, generous first/last column padding.

## Stage 4 — RouteOne kanban

`src/components/route-one/*` (job cards + driver columns):
- Job cards: light bg + 3px square-cornered left accent bar (driver group / job type). Job-type pill uses independent tag color. Job ID small, right-aligned, muted.
- Driver column header: avatar + name row 1; reg + vehicle type muted subtitle row 2; job-count as muted pill right-aligned; hairline divider under header.
- Empty column: dashed-border placeholder + icon, not gray text.

## Stage 5 — Cross-cutting table + button polish

- Wrap shared `<Table>` usage with sticky header + hover row + 44px min height (applies to Load Reports, Rentals, Contaminations, Stock Check, etc. via `src/components/ui/table.tsx` tweaks).
- Button variants normalized to primary (filled green, one per screen), secondary (outline/ghost), icon-only. All 36px / radius 8px.
- Skeleton loaders replace bare spinners on the top-traffic pages (dashboard, live jobs, RouteOne, load reports).
- Card hover: `translateY(-1px)` + soft shadow, 150ms.

## Stage 6 — Handbook

`src/pages/Handbook.tsx` + section accordions:
- Leading icon per section (mapped by title keyword).
- Hover bg + 150–200ms ease expand transition.
- Top utility bar (Admin / language / Sign Out) unified with Handbook tab: same 36px height, radius 8px, border treatment.

## What I need from you

I'd like to ship this in that order — smaller, reviewable steps rather than one giant sweep, exactly as the brief recommends. **Approve this plan and I'll start with Stage 1 (tokens) + Stage 2 (sidebar) in the next turn**, then pause so you can eyeball before I move on to the dashboard.

If you'd rather I bundle stages differently (e.g. do stages 1–3 in one push), say so and I'll adjust.

## Not doing (out of scope, confirming)

- No routing / IA changes.
- No new features or data changes.
- No brand-color change to the green primary.
- No changes to permissioning, super admin, portal visibility CMS.
