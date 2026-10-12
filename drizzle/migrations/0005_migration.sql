ALTER TABLE public.weighbridge_transactions
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('card','cash','cheque','account')),
  ADD COLUMN IF NOT EXISTS payment_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_paid_at timestamptz;