-- Drop the problematic policy
DROP POLICY IF EXISTS "Management can view all profiles" ON public.profiles;

-- Create a security definer function to check if user is management
CREATE OR REPLACE FUNCTION public.is_management(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
    AND 'management' = ANY(user_types)
  )
$$;

-- Create the policy using the function
CREATE POLICY "Management can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_management(auth.uid()));