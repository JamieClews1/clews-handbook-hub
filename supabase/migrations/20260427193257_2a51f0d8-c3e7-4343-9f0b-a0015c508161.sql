DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Reconomy portal users can view umbrella customers'
  ) THEN
    CREATE POLICY "Reconomy portal users can view umbrella customers"
    ON public.customers
    FOR SELECT
    TO authenticated
    USING (
      (
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
      )
      AND EXISTS (
        SELECT 1
        FROM public.customer_portal_memberships m
        JOIN public.customers linked_customer
          ON linked_customer.id = m.customer_id
        WHERE m.user_id = auth.uid()
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
      )
    );
  END IF;
END $$;