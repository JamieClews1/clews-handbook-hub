ALTER TABLE public.skip_inventory ADD COLUMN IF NOT EXISTS office_verified boolean NOT NULL DEFAULT false;
UPDATE public.skip_inventory SET office_verified = true;