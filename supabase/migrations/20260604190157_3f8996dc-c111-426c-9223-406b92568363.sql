ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driver_number integer,
  ADD COLUMN IF NOT EXISTS driver_pin text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_driver_number_unique
  ON public.profiles (driver_number)
  WHERE driver_number IS NOT NULL;