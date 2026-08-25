-- Merge duplicate customer "Shaw Sheet" (ZZSHA001) into "Shaw Sheet Metal" (SK0773)
DO $$
DECLARE
  dup_customer uuid := '667a8b7d-900c-47d1-ab51-47582a3a9741';
  keep_customer uuid := 'c6a83f03-7c4b-4f3f-9e2c-f2ae53606c83';
  dup_site uuid := 'ddfa5cba-1ccc-4ebd-97f8-5b0b6b6c9f4f';
  empty_site uuid := 'b2d6526b-d92b-4ec2-9e91-add798721908';
BEGIN
  -- Remove the duplicate, unconfigured site pointing at the same data hub site
  DELETE FROM public.customer_sites WHERE id = empty_site;

  -- Move the configured site (keeps its price set + skip rebates) to the surviving customer
  UPDATE public.customer_sites
     SET customer_id = keep_customer,
         site_name = 'Shaw Sheet Metal'
   WHERE id = dup_site;

  -- Move contacts and tickets
  UPDATE public.customer_contacts SET customer_id = keep_customer WHERE customer_id = dup_customer;
  UPDATE public.crm_tickets SET customer_id = keep_customer WHERE customer_id = dup_customer;

  -- Remove the duplicate customer
  DELETE FROM public.customers WHERE id = dup_customer;
END $$;