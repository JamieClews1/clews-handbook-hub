-- Agreed container standard v2: Stock Check names and keywords.
update public.stock_check_container_types
set name = '12yd ENC Asbestos',
    data_hub_keywords = array['Asbestos','Asbestos Skip','12 Yard Enc Asbestos','12Yd Enc Asbestos','12 yd ENC Asbestos','14 Enclosed Skip']
where id = '437cfc31-f5a6-4a4e-af97-d335020a2251';

update public.stock_check_container_types
set name = '35yd Compactor',
    data_hub_keywords = array['Compactor','35 Yard Compactor','35Yd Compactor','35 yd Compactor','40 Yard Compactor','40Yd Comp']
where id = '02cea293-f42f-424e-8f1f-ac11b9aa9570';

update public.stock_check_container_types
set data_hub_keywords = array['14 Yard Walk','Walk In','Walk-in','14 yd Walk-in']
where id = '831178ce-0ec2-4d35-bffe-095c2f5e207a';

-- New Banksman jobs take the container from the linked Skiptrak / Route One job when Midweigh
-- recorded a blank or a job number instead of a container. Existing jobs are not changed.
CREATE OR REPLACE FUNCTION public.create_banksman_job_from_midweigh()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.banksman_settings; ts timestamptz; dir text; jt text; prod text; acct text; t text;
  c text; lj text; jc text;
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

  c := nullif(trim(coalesce(new.raw->>'Container', new.container_type, '')), '');
  if c is null or c ~ '^[0-9*[:space:]]+$' then
    lj := coalesce(nullif(trim(new.linked_skip_job), ''), case when c ~ '^[0-9]{4,6}$' then c end);
    if lj is not null then
      select nullif(trim(d.container_type), '') into jc from public.data_hub_jobs d
        where d.job_number = lj and d.source ilike 'skiptrak%' and nullif(trim(d.container_type), '') is not null
        order by d.job_date desc nulls last limit 1;
      if jc is null then
        select nullif(trim(concat_ws(' ', r.container_type, r.container_size)), '') into jc from public.route_one_jobs r
          where r.job_number = lj order by r.scheduled_date desc limit 1;
      end if;
    end if;
    c := coalesce(jc, case when c ~ '^[0-9*[:space:]]+$' then null else c end);
  end if;

  insert into public.banksman_jobs (data_hub_job_id, source, job_number, vehicle_reg, customer, site, material, container_type)
  values (new.id, 'midweigh', new.job_number, new.raw->>'Vehicle', coalesce(new.customer, new.raw->>'Company /Surname'), new.site,
          coalesce(new.raw->>'EWC Desc', new.raw->>'Product'), c)
  on conflict (data_hub_job_id) do nothing;
  return new;
end $function$;