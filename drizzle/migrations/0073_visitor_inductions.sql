ALTER TABLE public.hs_documents DROP CONSTRAINT hs_documents_category_check;
ALTER TABLE public.hs_documents ADD CONSTRAINT hs_documents_category_check
  CHECK (category = ANY (ARRAY['site_induction'::text, 'fire_safety'::text, 'visitor_induction'::text]));

ALTER TABLE public.hs_document_share_links
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.hs_document_guest_signatures
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS vehicle_registration text,
  ADD COLUMN IF NOT EXISTS visit_reason text;

CREATE INDEX IF NOT EXISTS hs_document_guest_signatures_customer_idx
  ON public.hs_document_guest_signatures (customer_id);
CREATE INDEX IF NOT EXISTS hs_document_guest_signatures_document_signed_idx
  ON public.hs_document_guest_signatures (document_id, signed_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.hs_document_guest_signatures TO authenticated;
GRANT ALL ON public.hs_document_guest_signatures TO service_role;

DROP POLICY IF EXISTS "Staff can update guest signatures" ON public.hs_document_guest_signatures;
CREATE POLICY "Staff can update guest signatures"
  ON public.hs_document_guest_signatures
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));