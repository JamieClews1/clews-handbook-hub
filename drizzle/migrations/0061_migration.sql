create table public.inventory_condition_stock_rules (
  condition text primary key,
  counts_in_stock boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.inventory_condition_stock_rules enable row level security;
grant select, insert, update, delete on public.inventory_condition_stock_rules to authenticated;
create policy "Staff manage condition stock rules" on public.inventory_condition_stock_rules
  for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
insert into public.inventory_condition_stock_rules (condition, counts_in_stock) values
 ('New', true), ('Good', true), ('Fair', true), ('Poor', false), ('Scrapped', false), ('Yard Use', false);