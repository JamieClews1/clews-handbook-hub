CREATE POLICY "Portal users can view staci pallet entries for their sites"
ON public.staci_pallet_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.load_reports r
    JOIN public.customer_sites cs ON cs.id = r.site_id
    JOIN public.customer_portal_memberships m ON m.user_id = auth.uid()
    WHERE r.id = staci_pallet_entries.load_report_id
      AND r.status = 'submitted'
      AND (
        EXISTS (
          SELECT 1 FROM public.customer_portal_site_access a
          WHERE a.membership_id = m.id AND a.site_id = cs.id
        )
        OR (m.contact_id IS NOT NULL AND m.contact_id = cs.owner_contact_id)
      )
  )
);