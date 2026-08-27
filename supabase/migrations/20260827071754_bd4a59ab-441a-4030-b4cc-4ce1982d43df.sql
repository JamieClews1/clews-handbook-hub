ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false;
UPDATE public.route_one_jobs SET is_live = true WHERE is_live = false;
ALTER TABLE public.route_one_jobs ALTER COLUMN is_live SET DEFAULT false;