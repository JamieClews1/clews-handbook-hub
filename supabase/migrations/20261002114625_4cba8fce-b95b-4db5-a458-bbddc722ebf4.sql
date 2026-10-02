INSERT INTO public.customer_sites (customer_id, site_name, data_hub_customer, data_hub_site)
SELECT 'b05fe858-794b-4ce4-9420-01241a0e7d60', 'Dan Clancy', 'Loftus Construction Solutions Ltd', 'Dan Clancy'
WHERE NOT EXISTS (SELECT 1 FROM public.customer_sites WHERE customer_id='b05fe858-794b-4ce4-9420-01241a0e7d60' AND lower(site_name)='dan clancy');