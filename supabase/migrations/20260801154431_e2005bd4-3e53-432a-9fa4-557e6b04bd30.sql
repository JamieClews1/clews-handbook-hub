DO $$
DECLARE
  pair RECORD;
  keep_id uuid;
  drop_id uuid;
  drop_alias text;
  drop_name text;
  s RECORD;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('077b5f62-cac5-4778-988d-c104e174ecf9'::uuid, '8ab3575e-23cd-4d09-b4c3-43edc76f0263'::uuid),
      ('7c1e05d7-25ef-43e2-a249-70f5e947587d'::uuid, 'e59dce0f-267d-4f72-aa9c-48c7934478e2'::uuid),
      ('aa1bc43e-7f52-4cb7-9db6-5fc93471ba04'::uuid, '8f938517-6753-4cbe-b3c0-60b1ef6df867'::uuid)
    ) AS t(keep, drp)
  LOOP
    keep_id := pair.keep;
    drop_id := pair.drp;

    SELECT data_hub_customer, customer_name INTO drop_alias, drop_name FROM public.customers WHERE id = drop_id;
    IF drop_alias IS NULL THEN drop_alias := drop_name; END IF;

    -- Move sites (avoid unique conflict on customer_id + site_name)
    FOR s IN SELECT * FROM public.customer_sites WHERE customer_id = drop_id LOOP
      IF EXISTS (SELECT 1 FROM public.customer_sites k WHERE k.customer_id = keep_id AND k.site_name = s.site_name) THEN
        DELETE FROM public.customer_sites WHERE id = s.id;
      ELSE
        UPDATE public.customer_sites SET customer_id = keep_id, updated_at = now() WHERE id = s.id;
      END IF;
    END LOOP;

    -- Preserve the duplicate's Data Hub customer name as a mapping on the kept customer
    IF NOT EXISTS (
      SELECT 1 FROM public.customer_sites
      WHERE customer_id = keep_id AND data_hub_customer = drop_alias AND data_hub_site IS NULL
    ) AND NOT EXISTS (
      SELECT 1 FROM public.customer_sites WHERE customer_id = keep_id AND site_name = drop_name
    ) THEN
      INSERT INTO public.customer_sites (customer_id, site_name, data_hub_customer)
      VALUES (keep_id, drop_name, drop_alias);
    END IF;

    -- Reassign all other linked records
    UPDATE public.customer_contacts SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.customer_skip_rebates SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.customer_portal_memberships SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.customer_reporting_periods SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.customer_finance_details SET customer_id = keep_id WHERE customer_id = drop_id
      AND NOT EXISTS (SELECT 1 FROM public.customer_finance_details d WHERE d.customer_id = keep_id);
    DELETE FROM public.customer_finance_details WHERE customer_id = drop_id;
    UPDATE public.invoices SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.bookings SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.enquiries SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.container_loads SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.credit_account_applications SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.locked_rebate_reports SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.pricing_rate_cards SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.rebate_email_logs SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.rebate_report_tracking SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.staci_monthly_reports SET customer_id = keep_id WHERE customer_id = drop_id;

    DELETE FROM public.customers WHERE id = drop_id;
  END LOOP;
END $$;