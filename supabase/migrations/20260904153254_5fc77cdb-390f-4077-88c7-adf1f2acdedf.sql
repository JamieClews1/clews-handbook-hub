ALTER TABLE public.container_loads
  ADD COLUMN IF NOT EXISTS wb_ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS wb_location TEXT,
  ADD COLUMN IF NOT EXISTS wb_job_date DATE;