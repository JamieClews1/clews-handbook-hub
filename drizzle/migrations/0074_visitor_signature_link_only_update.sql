REVOKE UPDATE ON public.hs_document_guest_signatures FROM authenticated;
GRANT UPDATE (customer_id) ON public.hs_document_guest_signatures TO authenticated;