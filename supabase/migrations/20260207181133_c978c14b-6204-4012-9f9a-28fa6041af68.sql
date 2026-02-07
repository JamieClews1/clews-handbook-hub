-- Add data_hub_customer column to customers table for customer-level Midweigh matching
-- This allows matching Midweigh data for customers that have no configured sites
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS data_hub_customer TEXT;

COMMENT ON COLUMN public.customers.data_hub_customer IS 'Maps to the customer field in data_hub_jobs for Midweigh data matching';