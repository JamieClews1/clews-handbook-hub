ALTER TABLE public.nf_grades ADD COLUMN preferred_destination text;
ALTER TABLE public.nf_dispatches ADD COLUMN destination_site text, ADD COLUMN dispatch_time time without time zone, ADD COLUMN remember_destination boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.nf_grades.preferred_destination IS 'Preferred off-site receiving site for this metal grade; not an on-site storage location.';
COMMENT ON COLUMN public.nf_dispatches.destination_site IS 'Receiving-site snapshot at dispatch; later preference changes must not rewrite history.';
CREATE OR REPLACE FUNCTION public.remember_metal_dispatch_destination()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.destination_site := NULLIF(btrim(NEW.destination_site), '');
  IF NEW.remember_destination AND NEW.destination_site IS NOT NULL THEN
    UPDATE public.nf_grades SET preferred_destination = NEW.destination_site WHERE id = NEW.grade_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER remember_metal_dispatch_destination BEFORE INSERT ON public.nf_dispatches FOR EACH ROW EXECUTE FUNCTION public.remember_metal_dispatch_destination();