ALTER TYPE public.route_one_job_type ADD VALUE IF NOT EXISTS 'waste_out_skip';

ALTER TABLE public.route_one_jobs
  ADD COLUMN IF NOT EXISTS weighbridge_transaction_id uuid REFERENCES public.weighbridge_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weighbridge_ticket_number text,
  ADD COLUMN IF NOT EXISTS outbound_weight_t numeric,
  ADD COLUMN IF NOT EXISTS destination_name text,
  ADD COLUMN IF NOT EXISTS destination_address text;

CREATE INDEX IF NOT EXISTS route_one_jobs_weighbridge_transaction_id_idx
  ON public.route_one_jobs(weighbridge_transaction_id);

INSERT INTO public.route_one_job_types (key, label, color, display_order, is_active)
VALUES ('waste_out_skip', 'Waste Out Skip', 'slate', 90, true)
ON CONFLICT (key) DO NOTHING;