UPDATE public.customer_reporting_periods
SET period_label = '2026-' || split_part(period_label, '-', 2)
WHERE customer_id = '78c27a60-22f2-4203-adf2-2eefe5f82805'
  AND period_label LIKE '2025-%';