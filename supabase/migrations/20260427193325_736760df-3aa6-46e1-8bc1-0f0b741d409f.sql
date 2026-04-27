CREATE OR REPLACE FUNCTION public.user_has_reconomy_membership(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_portal_memberships m
    JOIN public.customers linked_customer
      ON linked_customer.id = m.customer_id
    WHERE m.user_id = _user_id
      AND lower(linked_customer.customer_name) LIKE ANY (
        ARRAY[
          '%reconomy (uk)%',
          '%reconomy solutions%',
          '%ama waste%',
          '%circle waste%',
          '%advanced waste solutions%',
          '%ecofficiency%'
        ]
      )
  );
$$;

DROP POLICY IF EXISTS "Reconomy portal users can view umbrella customers" ON public.customers;

CREATE POLICY "Reconomy portal users can view umbrella customers"
ON public.customers
FOR SELECT
TO authenticated
USING (
  lower(customer_name) LIKE ANY (
    ARRAY[
      '%reconomy (uk)%',
      '%reconomy solutions%',
      '%ama waste%',
      '%circle waste%',
      '%advanced waste solutions%',
      '%ecofficiency%'
    ]
  )
  AND public.user_has_reconomy_membership(auth.uid())
);