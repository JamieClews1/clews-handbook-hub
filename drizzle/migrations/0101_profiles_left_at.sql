ALTER TABLE public.profiles ADD COLUMN left_at date;
COMMENT ON COLUMN public.profiles.left_at IS 'Date the staff member left the company; NULL means current staff.';