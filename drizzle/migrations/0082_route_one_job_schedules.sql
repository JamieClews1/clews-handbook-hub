CREATE TABLE public.route_one_job_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  site_name text,
  site_address text,
  site_address_2 text,
  site_postcode text,
  site_contact_name text,
  site_contact_phone text,
  match_site text,
  match_container text,
  job_type public.route_one_job_type NOT NULL DEFAULT 'exchange',
  container_type text,
  container_size text,
  waste_type text,
  ewc_code text,
  po_number text,
  notes text,
  haulage_cost numeric,
  charge_per_tonne numeric,
  min_weight_charge numeric,
  weight_included_t numeric,
  cost_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  vat_rate numeric NOT NULL DEFAULT 20,
  own_container boolean NOT NULL DEFAULT false,
  interval_weeks integer NOT NULL DEFAULT 1 CHECK (interval_weeks BETWEEN 1 AND 26),
  start_date date NOT NULL,
  end_date date,
  book_ahead_days integer NOT NULL DEFAULT 14 CHECK (book_ahead_days BETWEEN 1 AND 90),
  booked_until date,
  active boolean NOT NULL DEFAULT true,
  source_job_number text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_one_job_schedules_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_job_schedules TO authenticated;
GRANT ALL ON public.route_one_job_schedules TO service_role;

ALTER TABLE public.route_one_job_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage job schedules" ON public.route_one_job_schedules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'user'::app_role));

CREATE TRIGGER update_route_one_job_schedules_updated_at BEFORE UPDATE ON public.route_one_job_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX route_one_job_schedules_site_idx ON public.route_one_job_schedules (site_name);

ALTER TABLE public.route_one_jobs ADD COLUMN schedule_id uuid REFERENCES public.route_one_job_schedules(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX route_one_jobs_schedule_date_uniq ON public.route_one_jobs (schedule_id, scheduled_date) WHERE schedule_id IS NOT NULL;

-- Books every occurrence of active schedules inside each schedule's look-ahead window.
-- Occurrences already covered by a matching Route One or Skiptrak booking near that date are skipped,
-- and booked_until moves forward so a deleted or skipped occurrence is never re-created.
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
          WHERE lower(trim(COALESCE(j.site_name, ''))) = lower(trim(COALESCE(s.site_name, '')))
            AND j.job_type = s.job_type
            AND COALESCE(j.container_type, '') = COALESCE(s.container_type, '')
            AND COALESCE(j.container_size, '') = COALESCE(s.container_size, '')
            AND replace(COALESCE(j.ewc_code, ''), ' ', '') = replace(COALESCE(s.ewc_code, ''), ' ', '')
            AND j.scheduled_date BETWEEN d - tol AND d + tol
        ) AND NOT EXISTS (
          SELECT 1 FROM public.data_hub_jobs h
          WHERE s.match_site IS NOT NULL
            AND h.source = 'skiptrak'
            AND h.site = s.match_site
            AND h.job_date BETWEEN d - tol AND d + tol
            AND lower(trim(COALESCE(h.container_type, ''))) = lower(trim(COALESCE(s.match_container, '')))
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

REVOKE ALL ON FUNCTION public.generate_route_one_scheduled_jobs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_route_one_scheduled_jobs(uuid) TO authenticated, service_role;