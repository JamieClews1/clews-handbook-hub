alter table public.weighbridge_transactions
  add column if not exists operator_signoff_at timestamptz,
  add column if not exists driver_signoff_at timestamptz;

comment on column public.weighbridge_transactions.operator_signoff_at is 'When the weighbridge operator signed the ticket';
comment on column public.weighbridge_transactions.driver_signoff_at is 'When the driver signed the ticket';