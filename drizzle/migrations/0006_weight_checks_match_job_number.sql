CREATE OR REPLACE FUNCTION public.lookup_job_weights(pairs jsonb)
RETURNS TABLE(order_number text, job_number text, source text, job_date date, customer text, site text, waste_description text, container_type text, weight_t numeric, postcode text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p jsonb; v_po text; v_pc text; v_is_jobno boolean;
BEGIN
  FOR p IN SELECT * FROM jsonb_array_elements(pairs) LOOP
    v_po := upper(btrim(coalesce(p->>'po','')));
    CONTINUE WHEN v_po = '';
    v_pc := nullif(upper(replace(btrim(coalesce(p->>'postcode','')), ' ', '')), '');
    v_is_jobno := v_po ~ '^[0-9]+$';
    RETURN QUERY
    WITH cand AS (
      SELECT j.* FROM public.data_hub_jobs j WHERE upper(btrim(j.raw->>'Order No')) = v_po
      UNION
      SELECT j.* FROM public.data_hub_jobs j WHERE upper(btrim(j.order_number_override)) = v_po
      UNION
      -- Job-number matches are only allowed when a postcode was supplied,
      -- so customers cannot enumerate other people's jobs by number.
      SELECT j.* FROM public.data_hub_jobs j
      WHERE v_is_jobno AND v_pc IS NOT NULL AND j.job_number = v_po
    ), jobs AS (
      SELECT c.*, btrim(coalesce(
          nullif(btrim(c.raw->>'Location Postc'), ''),
          nullif(btrim(c.raw->>'Postcode'), ''),
          (regexp_match(upper(concat_ws(' ', c.raw->>'Location', c.raw->>'Address 2', c.raw->>'Address 3', c.raw->>'Address 4')),
            '([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})'))[1]
        )) AS pc_text
      FROM cand c
    )
    SELECT v_po, j.job_number, j.source, j.job_date, j.customer, j.site,
      j.waste_description, j.container_type, j.weight_t, j.pc_text
    FROM jobs j
    WHERE v_pc IS NULL OR j.pc_text IS NULL OR upper(replace(j.pc_text, ' ', '')) = v_pc;
  END LOOP;
END;
$$;