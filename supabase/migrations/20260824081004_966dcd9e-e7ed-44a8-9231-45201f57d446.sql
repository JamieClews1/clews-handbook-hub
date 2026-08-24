ALTER TABLE public.weighbridge_transactions
  ADD COLUMN IF NOT EXISTS job_type text,
  ADD COLUMN IF NOT EXISTS linked_job_number text,
  ADD COLUMN IF NOT EXISTS linked_job_source text,
  ADD COLUMN IF NOT EXISTS linked_job_date date;

CREATE INDEX IF NOT EXISTS idx_weighbridge_tx_linked_job
  ON public.weighbridge_transactions (linked_job_number, linked_job_source);