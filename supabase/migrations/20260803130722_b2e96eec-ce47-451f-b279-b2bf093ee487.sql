UPDATE public.pod_documents p
SET job_number = m.jn
FROM (
  SELECT id, regexp_replace(substring(file_name from '(?i)job[ _#-]*0*([0-9]{3,8})'), '^0+', '') AS jn
  FROM public.pod_documents
) m
WHERE p.id = m.id AND m.jn IS NOT NULL AND p.job_number IS DISTINCT FROM m.jn;

UPDATE public.pod_documents p
SET customer = j.customer, site = j.site, delivery_date = COALESCE(p.delivery_date, j.job_date)
FROM (
  SELECT DISTINCT ON (d.job_number) d.job_number, d.customer, d.site, d.job_date
  FROM public.data_hub_jobs d
  WHERE d.job_number IN (SELECT job_number FROM public.pod_documents WHERE job_number IS NOT NULL)
  ORDER BY d.job_number, d.job_date DESC
) j
WHERE p.job_number = j.job_number AND (p.customer IS NULL OR p.site IS NULL);