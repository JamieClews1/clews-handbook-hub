# near-miss-summary

- Near miss review summaries: the near-miss-summary function reads reports with the caller's own session (admin/management RLS), sends Claude only reports submitted after the latest saved summary, and saves an insert-only near_miss_summaries row; it never changes report status, so suggested actions stay advice until staff act.
