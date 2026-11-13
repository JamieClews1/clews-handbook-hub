CREATE OR REPLACE FUNCTION public.generate_route_one_scheduled_jobs(p_schedule_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  s record;
  d date;
  first_due date;
  today date := (now() AT TIME ZONE 'Europe/London')::date;
  horizon date;
  step integer;
  tol integer;
  made integer := 0;
  n integer;
  last_considered date;
  tonnage numeric;
  items numeric;
  net numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  FOR s IN
    SELECT * FROM public.route_one_job_schedules
    WHERE active AND (p_schedule_id IS NULL OR id = p_schedule_id)
    FOR UPDATE
  LOOP
    step := s.interval_weeks * 7;
    tol := LEAST(3, step / 2 - 1);
    horizon := today + s.book_ahead_days;
    IF s.end_date IS NOT NULL AND s.end_date < horizon THEN horizon := s.end_date; END IF;
    first_due := GREATEST(today, COALESCE(s.booked_until + 1, s.start_date), s.start_date);
    d := s.start_date + step * CEIL((first_due - s.start_date)::numeric / step)::integer;
    last_considered := NULL;

    tonnage := GREATEST(COALESCE(s.charge_per_tonne, 0) * COALESCE(s.weight_included_t, 0), COALESCE(s.min_weight_charge, 0));
    SELECT COALESCE(SUM(COALESCE((i->>'charge')::numeric, 0) * COALESCE(NULLIF((i->>'qty')::numeric, 0), 1)), 0)
      INTO items FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.cost_items) = 'array' THEN s.cost_items ELSE '[]'::jsonb END) i;
    net := ROUND(COALESCE(s.haulage_cost, 0) + tonnage + items, 2);

    WHILE d <= horizon LOOP
      IF NOT EXISTS (
          SELECT 1 FROM public.route_one_jobs j
          WHERE j.schedule_id = s.id AND j.scheduled_date = d
        ) AND NOT EXISTS (
          SELECT 1 FROM public.route_one_jobs j
          WHERE regexp_replace(lower(trim(COALESCE(j.site_name, ''))), '\s+', ' ', 'g') = regexp_replace(lower(trim(COALESCE(s.site_name, ''))), '\s+', ' ', 'g')
            AND j.job_type = s.job_type
            AND COALESCE(j.container_type, '') = COALESCE(s.container_type, '')
            AND COALESCE(j.container_size, '') = COALESCE(s.container_size, '')
            AND replace(COALESCE(j.ewc_code, ''), ' ', '') = replace(COALESCE(s.ewc_code, ''), ' ', '')
            AND j.scheduled_date BETWEEN d - tol AND d + tol
        ) AND NOT EXISTS (
          SELECT 1 FROM public.data_hub_jobs h
          WHERE s.match_site IS NOT NULL
            AND h.source = 'skiptrak'
            AND h.job_date BETWEEN d - tol AND d + tol
            AND regexp_replace(lower(trim(COALESCE(h.site, ''))), '\s+', ' ', 'g') = regexp_replace(lower(trim(s.match_site)), '\s+', ' ', 'g')
            AND regexp_replace(lower(trim(COALESCE(h.container_type, ''))), '\s+', ' ', 'g') = regexp_replace(lower(trim(COALESCE(s.match_container, ''))), '\s+', ' ', 'g')
            AND replace(COALESCE(h.ewc, ''), ' ', '') = replace(COALESCE(s.ewc_code, ''), ' ', '')
        ) THEN
        INSERT INTO public.route_one_jobs (
          schedule_id, customer_name, site_name, site_address, site_address_2, site_postcode,
          site_contact_name, site_contact_phone, job_type, status, container_type, container_size,
          waste_type, ewc_code, po_number, scheduled_date, notes, haulage_cost, charge_per_tonne,
          min_weight_charge, weight_included_t, cost_items, vat_rate, own_container,
          total_net, total_inc_vat, created_by
        ) VALUES (
          s.id, s.customer_name, s.site_name, s.site_address, s.site_address_2, s.site_postcode,
          s.site_contact_name, s.site_contact_phone, s.job_type, 'unassigned', s.container_type, s.container_size,
          s.waste_type, s.ewc_code, s.po_number, d,
          trim(both E'\n' FROM concat_ws(E'\n', NULLIF(trim(s.notes), ''),
            'Scheduled job: every ' || CASE WHEN s.interval_weeks = 1 THEN 'week' ELSE s.interval_weeks || ' weeks' END)),
          s.haulage_cost, s.charge_per_tonne, s.min_weight_charge, s.weight_included_t,
          CASE WHEN jsonb_typeof(s.cost_items) = 'array' THEN s.cost_items ELSE '[]'::jsonb END,
          s.vat_rate, s.own_container, net, ROUND(net * (1 + s.vat_rate / 100), 2), s.created_by
        )
        ON CONFLICT (schedule_id, scheduled_date) WHERE schedule_id IS NOT NULL DO NOTHING;
        GET DIAGNOSTICS n = ROW_COUNT;
        made := made + n;
      END IF;
      last_considered := d;
      d := d + step;
    END LOOP;

    IF last_considered IS NOT NULL THEN
      UPDATE public.route_one_job_schedules SET booked_until = last_considered WHERE id = s.id;
    END IF;
  END LOOP;

  RETURN made;
END;
$$;