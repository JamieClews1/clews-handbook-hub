# Stop Data Hub reports timing out

Six of the seven issues are already fixed. The remaining one — reports and dashboards
hanging or showing nothing — is real but needs a wider change, so here is the proposal.

## What is happening

Some screens ask the job records store for everything at once, with no date or customer
limit, and one screen asks a separate counting question for every single site in a loop.
As the job history keeps growing, the database gives up part way through and the screen
either spins forever or comes back empty.

## What to change

1. Analytics dashboard: load only the period being viewed (default last 12 months) instead
   of sweeping the whole history, and cap how far back a user can pick.
2. Site history popup: load a page at a time (200 rows) with a "load more" button, newest
   first, instead of pulling up to 2000 rows.
3. Customer portal site report: replace the per-site counting loop with one grouped query
   that returns all sites in a single call.
4. Add a database summary function for the analytics totals so the heavy aggregation runs
   on the server rather than shipping every row to the browser.
5. Add supporting indexes (customer + job_date, site) so the filtered queries stay fast.

## Notes

- No change to the numbers shown, only to how they are fetched.
- Each screen is verified after the change by loading it and confirming figures match the
  current output for a sample month and customer.
