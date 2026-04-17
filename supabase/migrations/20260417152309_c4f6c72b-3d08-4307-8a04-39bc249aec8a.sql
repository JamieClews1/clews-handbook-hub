ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_broker boolean NOT NULL DEFAULT false;
ALTER TABLE public.customer_sites ADD COLUMN IF NOT EXISTS broker_subclient text;
CREATE INDEX IF NOT EXISTS idx_customer_sites_broker_subclient ON public.customer_sites(customer_id, broker_subclient) WHERE broker_subclient IS NOT NULL;