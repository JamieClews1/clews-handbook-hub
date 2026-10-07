CREATE TABLE public.banksman_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  midweigh_enabled boolean NOT NULL DEFAULT true,
  midweigh_directions text[] NOT NULL DEFAULT ARRAY['INWARD'],
  midweigh_job_types text[] NOT NULL DEFAULT ARRAY['WASTEIN','SKIP'],
  midweigh_excluded_products text[] NOT NULL DEFAULT '{}',
  midweigh_excluded_accounts text[] NOT NULL DEFAULT '{}',
  midweigh_max_age_hours integer NOT NULL DEFAULT 24,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.banksman_settings TO authenticated;
GRANT ALL ON public.banksman_settings TO service_role;
ALTER TABLE public.banksman_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read banksman settings" ON public.banksman_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert banksman settings" ON public.banksman_settings FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update banksman settings" ON public.banksman_settings FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
INSERT INTO public.banksman_settings (id) VALUES (true);

ALTER TABLE public.banksman_jobs ADD COLUMN IF NOT EXISTS data_hub_job_id uuid UNIQUE REFERENCES public.data_hub_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.banksman_jobs ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'weighone';

CREATE OR REPLACE FUNCTION public.create_banksman_job_from_midweigh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare s public.banksman_settings; ts timestamptz; dir text; jt text; prod text; acct text;
begin
  if new.source is null or new.source !~* 'midweigh' then return new; end if;
  select * into s from public.banksman_settings where id;
  if not found or not s.midweigh_enabled then return new; end if;
  dir := upper(trim(coalesce(new.raw->>'In / Out','')));
  jt := upper(trim(coalesce(new.raw->>'Job Type','')));
  prod := upper(trim(coalesce(new.raw->>'Product','')));
  acct := upper(trim(coalesce(new.raw->>'Account','')));
  if cardinality(s.midweigh_directions) > 0 and not dir = any(select upper(x) from unnest(s.midweigh_directions) x) then return new; end if;
  if cardinality(s.midweigh_job_types) > 0 and not jt = any(select upper(x) from unnest(s.midweigh_job_types) x) then return new; end if;
  if prod <> '' and prod = any(select upper(x) from unnest(s.midweigh_excluded_products) x) then return new; end if;
  if acct <> '' and acct = any(select upper(x) from unnest(s.midweigh_excluded_accounts) x) then return new; end if;
  begin ts := to_timestamp(new.raw->>'Time', 'DD/MM/YYYY HH24:MI:SS'); exception when others then ts := new.job_date::timestamptz; end;
  if s.midweigh_max_age_hours > 0 and coalesce(ts, new.job_date::timestamptz) < now() - make_interval(hours => s.midweigh_max_age_hours) then return new; end if;
  if exists (select 1 from public.banksman_jobs b where b.job_number = new.job_number and b.created_at > now() - interval '3 days') then return new; end if;
  insert into public.banksman_jobs (data_hub_job_id, source, job_number, vehicle_reg, customer, site, material, container_type)
  values (new.id, 'midweigh', new.job_number, new.raw->>'Vehicle', coalesce(new.customer, new.raw->>'Company /Surname'), new.site,
          coalesce(new.raw->>'EWC Desc', new.raw->>'Product'), new.raw->>'Container')
  on conflict (data_hub_job_id) do nothing;
  return new;
end $$;

CREATE TRIGGER data_hub_jobs_create_banksman_job AFTER INSERT ON public.data_hub_jobs
FOR EACH ROW EXECUTE FUNCTION public.create_banksman_job_from_midweigh();