ALTER TABLE public.inventory_share_links
  ADD COLUMN IF NOT EXISTS show_unverified_skips boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_unverified_roros boolean NOT NULL DEFAULT true;
UPDATE public.inventory_share_links SET show_unverified_skips = NOT verified_only, show_unverified_roros = NOT verified_only;