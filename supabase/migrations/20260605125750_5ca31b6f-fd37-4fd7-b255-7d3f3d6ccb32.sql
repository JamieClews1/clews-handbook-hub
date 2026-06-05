ALTER TABLE public.route_one_drivers ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.yard_staff ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS route_one_drivers_username_lower_idx
  ON public.route_one_drivers (lower(username))
  WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS yard_staff_username_lower_idx
  ON public.yard_staff (lower(username))
  WHERE username IS NOT NULL;