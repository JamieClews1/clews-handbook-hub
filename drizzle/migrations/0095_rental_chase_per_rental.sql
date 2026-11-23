ALTER TABLE public.rental_chases ADD COLUMN IF NOT EXISTS rental_ref text;
ALTER TABLE public.rental_notes ADD COLUMN IF NOT EXISTS rental_ref text;

COMMENT ON COLUMN public.rental_chases.rental_ref IS 'Rental this chase belongs to: job:<ticket that started the rental clock>, date:<rental start> when no ticket, or legacy:<London date last worked> for chases made before per-rental tracking.';
COMMENT ON COLUMN public.rental_notes.rental_ref IS 'Rental this note belongs to (same value as rental_chases.rental_ref). NULL = written before per-rental tracking; matched by date.';

UPDATE public.rental_chases
SET rental_ref = 'legacy:' || to_char(updated_at AT TIME ZONE 'Europe/London', 'YYYY-MM-DD')
WHERE rental_ref IS NULL;

ALTER TABLE public.rental_chases DROP CONSTRAINT IF EXISTS rental_chases_bin_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS rental_chases_bin_rental_key ON public.rental_chases (bin_key, rental_ref) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS rental_chases_bin_key_idx ON public.rental_chases (bin_key);
CREATE INDEX IF NOT EXISTS rental_notes_bin_key_idx ON public.rental_notes (bin_key);

CREATE OR REPLACE FUNCTION public.capture_rental_legacy_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF NEW.notes IS NOT DISTINCT FROM OLD.notes THEN RETURN NEW; END IF;
 END IF;
 IF nullif(trim(NEW.notes), '') IS NOT NULL THEN
  IF TG_TABLE_NAME = 'rental_chases' THEN
   INSERT INTO public.rental_notes(bin_key, body, rental_ref)
   VALUES (NEW.bin_key, NEW.notes, CASE WHEN NEW.rental_ref LIKE 'legacy:%' THEN NULL ELSE NEW.rental_ref END);
  ELSE
   INSERT INTO public.rental_notes(agreement_id, body) VALUES (NEW.id, NEW.notes);
  END IF;
 END IF;
 RETURN NEW;
END;
$$;