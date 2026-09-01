-- Drivers: no anonymous access (driver app uses service-role edge functions)
DROP POLICY IF EXISTS "Allow anon to read drivers for PIN login" ON public.route_one_drivers;
REVOKE ALL ON public.route_one_drivers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_drivers TO authenticated;
GRANT ALL ON public.route_one_drivers TO service_role;

-- Yard staff: no anonymous access
DROP POLICY IF EXISTS "Allow anon to read yard staff for PIN login" ON public.yard_staff;
REVOKE ALL ON public.yard_staff FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yard_staff TO authenticated;
GRANT ALL ON public.yard_staff TO service_role;

-- Route One jobs: no anonymous read/update
DROP POLICY IF EXISTS "Allow anon to read jobs" ON public.route_one_jobs;
DROP POLICY IF EXISTS "Allow anon to update jobs" ON public.route_one_jobs;
REVOKE ALL ON public.route_one_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_jobs TO authenticated;
GRANT ALL ON public.route_one_jobs TO service_role;

-- Job photos: replace the fully-open policy with staff-only access
DROP POLICY IF EXISTS "Allow all access to job photos" ON public.route_one_job_photos;
REVOKE ALL ON public.route_one_job_photos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_job_photos TO authenticated;
GRANT ALL ON public.route_one_job_photos TO service_role;
CREATE POLICY "Staff can manage job photos"
  ON public.route_one_job_photos FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'user'::app_role));