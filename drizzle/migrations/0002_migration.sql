create table public.banksman_jobs (
  id uuid primary key default gen_random_uuid(),
  weighbridge_transaction_id uuid unique references public.weighbridge_transactions(id) on delete set null,
  job_number text not null,
  vehicle_reg text,
  customer text,
  site text,
  material text,
  container_type text,
  notes text,
  assigned_staff_id uuid references public.yard_staff(id) on delete set null,
  status text not null default 'new',
  started_at timestamptz,
  completed_at timestamptz,
  completed_by_staff_id uuid references public.yard_staff(id) on delete set null,
  completed_by_name text,
  load_photos jsonb not null default '[]'::jsonb,
  has_contamination boolean not null default false,
  contamination_items jsonb not null default '[]'::jsonb,
  contamination_total numeric not null default 0,
  contamination_photos jsonb not null default '[]'::jsonb,
  contamination_query_id uuid,
  alert_status text not null default 'none',
  acknowledged_by uuid,
  acknowledged_by_name text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index banksman_jobs_status_idx on public.banksman_jobs(status, created_at desc);
create index banksman_jobs_alert_idx on public.banksman_jobs(alert_status);

grant select, update on public.banksman_jobs to authenticated;
grant all on public.banksman_jobs to service_role;
alter table public.banksman_jobs enable row level security;
create policy "Staff can view banksman jobs" on public.banksman_jobs for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff can update banksman jobs" on public.banksman_jobs for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create trigger banksman_jobs_updated before update on public.banksman_jobs for each row execute function public.update_updated_at_column();

create or replace function public.create_banksman_job_from_weigh()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'first_weigh' then
    insert into public.banksman_jobs (weighbridge_transaction_id, job_number, vehicle_reg, customer, site, material, container_type, notes)
    values (new.id, coalesce(new.ticket_number, left(new.id::text, 8)), new.vehicle_reg, new.customer, new.site, new.waste_description, new.container_type, new.notes)
    on conflict (weighbridge_transaction_id) do nothing;
  end if;
  return new;
end $$;
create trigger weighbridge_create_banksman_job after insert on public.weighbridge_transactions for each row execute function public.create_banksman_job_from_weigh();

insert into public.banksman_jobs (weighbridge_transaction_id, job_number, vehicle_reg, customer, site, material, container_type, notes, created_at)
select id, coalesce(ticket_number, left(id::text,8)), vehicle_reg, customer, site, waste_description, container_type, notes, coalesce(first_weigh_at, created_at)
from public.weighbridge_transactions where status = 'first_weigh' and created_at > now() - interval '2 days'
on conflict do nothing;

alter publication supabase_realtime add table public.banksman_jobs;