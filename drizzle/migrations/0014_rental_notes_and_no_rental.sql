ALTER TABLE public.rental_agreements ADD COLUMN rental_mode text NOT NULL DEFAULT 'charged' CHECK (rental_mode IN ('charged', 'no_rental'));
CREATE TABLE public.rental_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bin_key text,
 agreement_id uuid REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (length(trim(body)) > 0),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 author_name text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (bin_key IS NOT NULL OR agreement_id IS NOT NULL)
);
GRANT SELECT, INSERT ON public.rental_notes TO authenticated;
GRANT ALL ON public.rental_notes TO service_role;
ALTER TABLE public.rental_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read rental notes" ON public.rental_notes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add own rental notes" ON public.rental_notes FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE INDEX rental_notes_bin_key_idx ON public.rental_notes(bin_key, created_at DESC);
CREATE INDEX rental_notes_agreement_idx ON public.rental_notes(agreement_id, created_at DESC);
CREATE FUNCTION public.stamp_rental_note() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 NEW.created_by := auth.uid();
 NEW.created_at := now();
 SELECT coalesce(nullif(full_name, ''), email, 'Staff user') INTO NEW.author_name FROM public.profiles WHERE id = auth.uid();
 NEW.author_name := coalesce(NEW.author_name, 'Staff user');
 RETURN NEW;
END;
$$;
CREATE TRIGGER stamp_rental_note BEFORE INSERT ON public.rental_notes FOR EACH ROW EXECUTE FUNCTION public.stamp_rental_note();
CREATE FUNCTION public.capture_rental_legacy_note() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF NEW.notes IS NOT DISTINCT FROM OLD.notes THEN RETURN NEW; END IF;
 END IF;
 IF nullif(trim(NEW.notes), '') IS NOT NULL THEN
  IF TG_TABLE_NAME = 'rental_chases' THEN
   INSERT INTO public.rental_notes(bin_key, body) VALUES (NEW.bin_key, NEW.notes);
  ELSE
   INSERT INTO public.rental_notes(agreement_id, body) VALUES (NEW.id, NEW.notes);
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER capture_rental_chase_note AFTER INSERT OR UPDATE OF notes ON public.rental_chases FOR EACH ROW EXECUTE FUNCTION public.capture_rental_legacy_note();
CREATE TRIGGER capture_rental_agreement_note AFTER INSERT OR UPDATE OF notes ON public.rental_agreements FOR EACH ROW EXECUTE FUNCTION public.capture_rental_legacy_note();
CREATE FUNCTION public.enforce_no_rental_rate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.rental_mode = 'no_rental' THEN NEW.agreed_rate := 0; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_no_rental_rate BEFORE INSERT OR UPDATE ON public.rental_agreements FOR EACH ROW EXECUTE FUNCTION public.enforce_no_rental_rate();