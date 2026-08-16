-- 1. Update existing midweigh rows from the master file
UPDATE public.data_hub_jobs j
SET
  job_date = s.job_date,
  customer = nullif(btrim(s.customer), ''),
  site = st.site,
  ewc = nullif(btrim(s.ewc), ''),
  waste_description = coalesce(nullif(btrim(s.ewc_desc), ''), nullif(btrim(s.product), '')),
  category = 'Midweigh',
  movement_type = nullif(btrim(s.in_out), ''),
  container_type = nullif(btrim(s.container), ''),
  job_type = nullif(btrim(s.job_type), ''),
  weight_t = s.weight,
  vehicle_registration = nullif(btrim(s.vehicle), ''),
  account_code = nullif(btrim(s.account_code), ''),
  haulier = nullif(btrim(s.haulier), ''),
  carrier_number = nullif(btrim(s.carrier_number), ''),
  gross_weight = s.gross_weight,
  tare_weight = s.tare_weight,
  linked_skip_job = nullif(btrim(s.skip_job), ''),
  raw = coalesce(j.raw, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'Ticket', s.ticket,
    'Company /Surname', nullif(btrim(s.customer), ''),
    'Account', nullif(btrim(s.account_code), ''),
    'ewc', nullif(btrim(s.ewc), ''),
    'Weight', s.weight,
    'Vehicle', nullif(btrim(s.vehicle), ''),
    'Product', nullif(btrim(s.product), ''),
    'Haulier', nullif(btrim(s.haulier), ''),
    'Carrier no', nullif(btrim(s.carrier_number), ''),
    'Gross', s.gross_weight,
    'Tare', s.tare_weight,
    'In / Out', nullif(btrim(s.in_out), ''),
    'EWC Desc', nullif(btrim(s.ewc_desc), ''),
    'Job Type', nullif(btrim(s.job_type), ''),
    'Container', nullif(btrim(s.container), ''),
    'Skip job', nullif(btrim(s.skip_job), '')
  )),
  updated_at = now()
FROM public.midweigh_import_staging s
LEFT JOIN LATERAL (
  SELECT k.site
  FROM public.data_hub_jobs k
  WHERE k.source = 'skiptrak'
    AND k.job_number = nullif(btrim(s.skip_job), '')
  LIMIT 1
) st ON true
WHERE j.source = 'midweigh' AND j.job_number = s.ticket;

-- 2. Insert tickets that are not yet in the Data Hub
INSERT INTO public.data_hub_jobs (
  job_number, source, job_date, customer, site, ewc, waste_description, category,
  movement_type, container_type, job_type, weight_t, vehicle_registration,
  account_code, haulier, carrier_number, gross_weight, tare_weight, linked_skip_job, raw
)
SELECT
  s.ticket, 'midweigh', s.job_date, nullif(btrim(s.customer), ''), st.site,
  nullif(btrim(s.ewc), ''),
  coalesce(nullif(btrim(s.ewc_desc), ''), nullif(btrim(s.product), '')),
  'Midweigh',
  nullif(btrim(s.in_out), ''), nullif(btrim(s.container), ''), nullif(btrim(s.job_type), ''),
  s.weight, nullif(btrim(s.vehicle), ''),
  nullif(btrim(s.account_code), ''), nullif(btrim(s.haulier), ''), nullif(btrim(s.carrier_number), ''),
  s.gross_weight, s.tare_weight, nullif(btrim(s.skip_job), ''),
  jsonb_strip_nulls(jsonb_build_object(
    'Ticket', s.ticket,
    'Company /Surname', nullif(btrim(s.customer), ''),
    'Account', nullif(btrim(s.account_code), ''),
    'ewc', nullif(btrim(s.ewc), ''),
    'Weight', s.weight,
    'Vehicle', nullif(btrim(s.vehicle), ''),
    'Product', nullif(btrim(s.product), ''),
    'Haulier', nullif(btrim(s.haulier), ''),
    'Carrier no', nullif(btrim(s.carrier_number), ''),
    'Gross', s.gross_weight,
    'Tare', s.tare_weight,
    'In / Out', nullif(btrim(s.in_out), ''),
    'EWC Desc', nullif(btrim(s.ewc_desc), ''),
    'Job Type', nullif(btrim(s.job_type), ''),
    'Container', nullif(btrim(s.container), ''),
    'Skip job', nullif(btrim(s.skip_job), '')
  ))
FROM public.midweigh_import_staging s
LEFT JOIN LATERAL (
  SELECT k.site
  FROM public.data_hub_jobs k
  WHERE k.source = 'skiptrak'
    AND k.job_number = nullif(btrim(s.skip_job), '')
  LIMIT 1
) st ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.data_hub_jobs j
  WHERE j.source = 'midweigh' AND j.job_number = s.ticket
);

DROP TABLE public.midweigh_import_staging;