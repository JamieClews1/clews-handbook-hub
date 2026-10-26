create or replace function public.get_common_waste_types(_months int default 18)
returns table(ewc text, waste_description text, skiptrak_jobs int, midweigh_jobs int, total_jobs int, tonnes numeric, last_date date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorised'; end if;
  return query
  select regexp_replace(coalesce(j.ewc,''), '[^0-9*]', '', 'g') as ewc,
         max(j.waste_description) as waste_description,
         count(*) filter (where j.source='skiptrak')::int,
         count(*) filter (where j.source='midweigh')::int,
         count(*)::int,
         round(sum(case when j.source='midweigh' then coalesce(j.weight_t,0)/1000 else coalesce(j.weight_t,0) end)::numeric, 2),
         max(j.job_date)
  from data_hub_jobs j
  where j.job_date >= (current_date - make_interval(months => _months))
    and j.source in ('skiptrak','midweigh')
  group by 1
  order by 5 desc;
end $$;
revoke all on function public.get_common_waste_types(int) from public, anon;
grant execute on function public.get_common_waste_types(int) to authenticated;