CREATE OR REPLACE FUNCTION public.create_banksman_job_from_midweigh()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare s public.banksman_settings; ts timestamptz; dir text; jt text; prod text; acct text; t text;
begin
  if new.source is null or new.source !~* 'midweigh' then return new; end if;
  select * into s from public.banksman_settings where id;
  if not found or not s.midweigh_enabled then return new; end if;
  dir := upper(trim(coalesce(new.raw->>'In / Out','')));
  t := upper(trim(coalesce(new.raw->>'Time','')));
  -- Some Midweigh rows arrive shifted one column (direction lands in "Time")
  if dir not in ('INWARD','OUTWARD') and t in ('INWARD','OUTWARD') then dir := t; end if;
  jt := upper(trim(coalesce(new.raw->>'Job Type','')));
  prod := upper(trim(coalesce(new.raw->>'Product','')));
  acct := upper(trim(coalesce(new.raw->>'Account','')));
  if cardinality(s.midweigh_directions) > 0 and not dir = any(select upper(x) from unnest(s.midweigh_directions) x) then return new; end if;
  if cardinality(s.midweigh_job_types) > 0 and not jt = any(select upper(x) from unnest(s.midweigh_job_types) x) then return new; end if;
  if prod <> '' and prod = any(select upper(x) from unnest(s.midweigh_excluded_products) x) then return new; end if;
  if acct <> '' and acct = any(select upper(x) from unnest(s.midweigh_excluded_accounts) x) then return new; end if;
  begin ts := to_timestamp(new.raw->>'Time', 'DD/MM/YYYY HH24:MI:SS'); exception when others then ts := null; end;
  if s.midweigh_max_age_hours > 0 and coalesce(ts, new.job_date::timestamptz, now()) < now() - make_interval(hours => greatest(s.midweigh_max_age_hours, 24)) then return new; end if;
  if exists (select 1 from public.banksman_jobs b where b.job_number = new.job_number and b.created_at > now() - interval '3 days') then return new; end if;
  insert into public.banksman_jobs (data_hub_job_id, source, job_number, vehicle_reg, customer, site, material, container_type)
  values (new.id, 'midweigh', new.job_number, new.raw->>'Vehicle', coalesce(new.customer, new.raw->>'Company /Surname'), new.site,
          coalesce(new.raw->>'EWC Desc', new.raw->>'Product'), new.raw->>'Container')
  on conflict (data_hub_job_id) do nothing;
  return new;
end $function$;