ALTER TYPE public.route_one_job_type ADD VALUE IF NOT EXISTS 'pickup_truck';
ALTER TYPE public.route_one_job_type ADD VALUE IF NOT EXISTS 'third_party_booking';
ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS own_container boolean NOT NULL DEFAULT false;
ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS rental_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS rental_free_days integer;
ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS rental_weekly_rate numeric;
ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS rental_start_date date;
CREATE OR REPLACE FUNCTION public.validate_booking_rental() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.own_container AND NEW.rental_enabled THEN RAISE EXCEPTION 'Own containers cannot start a rental'; END IF;
 IF NEW.rental_enabled AND (NEW.rental_weekly_rate IS NULL OR NEW.rental_weekly_rate<0 OR NEW.rental_free_days IS NULL OR NEW.rental_free_days<0 OR NEW.rental_start_date IS NULL) THEN RAISE EXCEPTION 'Rental needs a start date, non-negative free days and weekly rate'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER validate_booking_rental BEFORE INSERT OR UPDATE OF own_container,rental_enabled,rental_free_days,rental_weekly_rate,rental_start_date ON public.route_one_jobs FOR EACH ROW EXECUTE FUNCTION public.validate_booking_rental();