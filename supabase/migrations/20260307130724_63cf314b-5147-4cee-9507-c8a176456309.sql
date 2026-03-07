-- Allow anon to read vehicles (needed for driver app join)
CREATE POLICY "Allow anon to read active vehicles"
ON public.route_one_vehicles
FOR SELECT
TO anon
USING (is_active = true);

-- Allow anon to read jobs (driver app dashboard)
CREATE POLICY "Allow anon to read jobs"
ON public.route_one_jobs
FOR SELECT
TO anon
USING (true);

-- Allow anon to update jobs (driver completing jobs)
CREATE POLICY "Allow anon to update jobs"
ON public.route_one_jobs
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);