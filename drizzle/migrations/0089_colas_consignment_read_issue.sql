ALTER TABLE public.colas_consignments
  ADD COLUMN IF NOT EXISTS read_issue text
  CHECK (read_issue IS NULL OR read_issue IN ('unreadable', 'page_missing'));