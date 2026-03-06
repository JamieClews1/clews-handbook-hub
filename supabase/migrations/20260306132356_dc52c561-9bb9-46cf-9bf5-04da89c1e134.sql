
INSERT INTO public.route_one_jobs (
  job_number, customer_name, site_name, site_postcode,
  job_type, status, container_type, waste_type, ewc_code,
  scheduled_date, display_order, notes, po_number
)
SELECT 
  d.job_number,
  COALESCE(d.customer, 'Unknown'),
  d.site,
  NULL,
  CASE 
    WHEN d.movement_type = 'Deliver' THEN 'delivery'::route_one_job_type
    WHEN d.movement_type = 'Exchange' THEN 'exchange'::route_one_job_type
    WHEN d.movement_type IN ('Collect', 'Wait/Load', 'Tip/Return') THEN 'collection'::route_one_job_type
    WHEN d.movement_type = 'WasteTruck' THEN 'waste_truck'::route_one_job_type
    WHEN d.movement_type = 'Wasted' THEN 'wasted_journey'::route_one_job_type
    ELSE 'collection'::route_one_job_type
  END,
  'completed'::route_one_job_status,
  d.container_type,
  d.waste_description,
  d.ewc,
  d.job_date::date,
  ROW_NUMBER() OVER (PARTITION BY d.job_date ORDER BY d.job_number),
  NULL,
  NULL
FROM public.data_hub_jobs d
WHERE d.source = 'skiptrak'
  AND d.job_date >= '2026-02-01'
  AND d.job_date <= '2026-02-28'
  AND d.job_number NOT IN (SELECT job_number FROM public.route_one_jobs)
