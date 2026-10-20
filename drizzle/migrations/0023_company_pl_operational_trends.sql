CREATE OR REPLACE FUNCTION public.get_company_pl_operational_trends()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE cutoff date; result jsonb;
BEGIN
  IF NOT public.has_company_pl_access(auth.uid()) THEN RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501'; END IF;
  SELECT least(current_date, min(latest)) INTO cutoff FROM (
    SELECT source, max(job_date) latest FROM public.data_hub_jobs
    WHERE source IN ('skiptrak','midweigh') AND job_date >= date_trunc('year',current_date)::date AND job_date <= current_date GROUP BY source
  ) s HAVING count(*) = 2;
  IF cutoff IS NULL THEN RETURN jsonb_build_object('cutoff',NULL,'months','[]'::jsonb,'customers','[]'::jsonb); END IF;
  WITH all_jobs AS (
    SELECT job_number,source,job_date,customer,weight_t,raw,job_type,movement_type,linked_skip_job,0 priority FROM public.data_hub_jobs
    WHERE job_date >= (date_trunc('year',cutoff)-interval '1 year')::date AND job_date <= cutoff
    UNION ALL
    SELECT job_number,source,job_date,customer,weight_t,raw,job_type,movement_type,raw->>'Skip job',1 FROM public.data_hub_jobs_archive
    WHERE job_date >= (date_trunc('year',cutoff)-interval '1 year')::date AND job_date <= cutoff
  ), unique_jobs AS (
    SELECT DISTINCT ON (source,job_number) * FROM all_jobs ORDER BY source,job_number,priority
  ), eligible AS (
    SELECT j.*, extract(year FROM job_date)::int yr,extract(month FROM job_date)::int mo,
      CASE WHEN source='midweigh' THEN coalesce(weight_t,0)/1000 ELSE coalesce(weight_t,0) END tonnes,
      CASE WHEN regexp_replace(coalesce(raw->>'Cost',''),'[£,[:space:]]','','g') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN regexp_replace(raw->>'Cost','[£,[:space:]]','','g')::numeric ELSE NULL END value
    FROM unique_jobs j
    WHERE source IN ('skiptrak','midweigh')
      AND NOT EXISTS (SELECT 1 FROM public.data_hub_void_jobs v WHERE v.source=j.source AND v.job_number=j.job_number)
      AND ((source='skiptrak' AND upper(trim(raw->>'Status'))='Y') OR
           (source='midweigh' AND upper(trim(job_type))='WASTEIN' AND upper(trim(movement_type))='INWARD'
            AND NOT EXISTS (SELECT 1 FROM unique_jobs sk WHERE sk.source='skiptrak' AND sk.job_number=j.linked_skip_job)))
  ), matched AS (
    SELECT * FROM eligible WHERE
      (yr=extract(year FROM cutoff) AND job_date<=cutoff) OR
      (yr=extract(year FROM cutoff)-1 AND job_date<=(cutoff-interval '1 year')::date)
  ), monthly AS (
    SELECT source,yr,mo,count(*) jobs,sum(tonnes) tonnes,coalesce(sum(value),0) value,
      count(*) FILTER (WHERE value IS NULL OR value=0) unpriced FROM matched GROUP BY source,yr,mo
  ), customer_totals AS (
    SELECT source,coalesce(customer,'Unknown') customer,
      coalesce(sum(value) FILTER (WHERE yr=extract(year FROM cutoff)),0) current_value,
      coalesce(sum(value) FILTER (WHERE yr=extract(year FROM cutoff)-1),0) previous_value,
      coalesce(sum(tonnes) FILTER (WHERE yr=extract(year FROM cutoff)),0) current_tonnes,
      coalesce(sum(tonnes) FILTER (WHERE yr=extract(year FROM cutoff)-1),0) previous_tonnes
    FROM matched WHERE mo>=greatest(1,extract(month FROM cutoff)::int-1) GROUP BY source,customer
  )
  SELECT jsonb_build_object('cutoff',cutoff,'months',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY yr,mo,source) FROM monthly m),'[]'::jsonb),
    'customers',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT * FROM customer_totals ORDER BY abs(current_value-previous_value) DESC LIMIT 12) c),'[]'::jsonb)) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_company_pl_operational_trends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_pl_operational_trends() TO authenticated, service_role;