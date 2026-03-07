CREATE POLICY "Allow anon to read drivers for PIN login"
ON public.route_one_drivers
FOR SELECT
TO anon
USING (is_active = true);