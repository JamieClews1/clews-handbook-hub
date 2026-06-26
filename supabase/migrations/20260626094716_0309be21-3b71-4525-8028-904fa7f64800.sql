ALTER TABLE public.rebate_price_set_items
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date;

COMMENT ON COLUMN public.rebate_price_set_items.effective_from IS 'First date (inclusive) this rebate line applies to loads. NULL = no start limit.';
COMMENT ON COLUMN public.rebate_price_set_items.effective_to IS 'Last date (inclusive) this rebate line applies to loads. NULL = open-ended.';