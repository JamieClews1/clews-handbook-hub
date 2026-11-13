# src

Open tabs move onto a newer build automatically via the build-watchdog module-script signature; the dev server stamps the page with the newest source change time so an already-open preview tab reloads onto edited code, and dev tooling scripts are excluded from the signature.
- External inventory valuations use the shared server-side inventory-valuation helper, combining verified profiles with configured assumptions and explicitly reporting missing rates and reconciliation differences; share visibility gates remain authoritative.
- The installed Load Reports app is locked per window by launch address to Load Reports, Container Loads and sign-in; it is a device UI lock, not a permission, so browser tabs keep the full portal.
- Orders portal (/orders, Inbox → Orders portal): customers hold a secret per-conversation link and reach order_portal_* data and the private order-portal bucket only via the orders-portal function; staff use is_staff RLS, so it works without Outlook and never exposes other conversations.
