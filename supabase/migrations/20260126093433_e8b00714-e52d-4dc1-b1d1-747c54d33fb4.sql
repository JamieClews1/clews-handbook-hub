-- Add column to customers table for PO change notification email
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS po_notification_email text DEFAULT 'orders@clewsrecycling.co.uk';

-- Add column to data_hub_jobs to store edited PO numbers (separate from raw JSON)
ALTER TABLE public.data_hub_jobs
ADD COLUMN IF NOT EXISTS order_number_override text;

-- Add comment
COMMENT ON COLUMN public.customers.po_notification_email IS 'Email address to receive PO number change notifications from customer portal';
COMMENT ON COLUMN public.data_hub_jobs.order_number_override IS 'Customer-edited PO/Order number that overrides the value in raw JSON';