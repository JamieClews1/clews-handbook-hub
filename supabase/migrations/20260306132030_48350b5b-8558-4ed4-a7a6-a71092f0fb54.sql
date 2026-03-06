-- Insert all Skiptrak customers not already in the customers table
-- Use the Skiptrak customer name as both customer_name and data_hub_customer
-- Generate customer_code from first 3 chars uppercase + sequence
INSERT INTO public.customers (customer_name, customer_code, data_hub_customer, is_active)
SELECT 
  sq.customer,
  'SK' || LPAD(ROW_NUMBER() OVER (ORDER BY sq.customer)::TEXT, 4, '0'),
  sq.customer,
  CASE WHEN sq.last_job >= (NOW() - INTERVAL '2 years')::date THEN true ELSE false END
FROM (
  SELECT customer, MAX(job_date) as last_job
  FROM public.data_hub_jobs 
  WHERE source = 'skiptrak' 
    AND customer IS NOT NULL 
    AND customer != ''
  GROUP BY customer
) sq
WHERE sq.customer NOT IN (
  SELECT customer_name FROM public.customers
  UNION
  SELECT data_hub_customer FROM public.customers WHERE data_hub_customer IS NOT NULL
)
ON CONFLICT (customer_code) DO NOTHING;