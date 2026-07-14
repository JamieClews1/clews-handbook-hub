
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_container_load_customer boolean NOT NULL DEFAULT false;

ALTER TABLE public.container_loads
  ADD COLUMN IF NOT EXISTS paperwork_mode text NOT NULL DEFAULT 'create',
  ADD COLUMN IF NOT EXISTS annex7_upload jsonb,
  ADD COLUMN IF NOT EXISTS packing_upload jsonb;
