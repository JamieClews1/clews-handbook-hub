-- Add policy to allow all authenticated users to view customer_sites for load reports
-- This is needed because Yard Reports should allow selecting any site
CREATE POLICY "Authenticated users can view all sites for load reports"
ON public.customer_sites
FOR SELECT
TO authenticated
USING (true);