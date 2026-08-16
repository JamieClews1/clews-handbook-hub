ALTER TABLE public.weighbridge_transactions
  ADD COLUMN IF NOT EXISTS carrier_registration text,
  ADD COLUMN IF NOT EXISTS carrier_name text,
  ADD COLUMN IF NOT EXISTS physical_form text,
  ADD COLUMN IF NOT EXISTS means_of_transport text DEFAULT 'Road';