-- Add customer_name to customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS customer_name text;

-- Backfill existing rows so we can enforce NOT NULL
UPDATE public.customers
SET customer_name = COALESCE(NULLIF(customer_name, ''), customer_code)
WHERE customer_name IS NULL OR customer_name = '';

-- Enforce required customer_name
ALTER TABLE public.customers
ALTER COLUMN customer_name SET NOT NULL;

-- Helpful index for searching by name
CREATE INDEX IF NOT EXISTS idx_customers_customer_name ON public.customers (customer_name);
