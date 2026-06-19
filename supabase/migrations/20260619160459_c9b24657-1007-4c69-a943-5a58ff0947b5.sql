ALTER TABLE public.rental_chases
  ADD COLUMN IF NOT EXISTS collected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_ticket text,
  ADD COLUMN IF NOT EXISTS collected_date date;