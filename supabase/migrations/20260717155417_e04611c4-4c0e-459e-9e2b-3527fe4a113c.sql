ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS dwt_environment TEXT DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS dwt_api_base_url TEXT DEFAULT 'https://waste-tracking.integration.api.defra.gov.uk',
  ADD COLUMN IF NOT EXISTS dwt_client_id TEXT,
  ADD COLUMN IF NOT EXISTS dwt_client_secret_updated_at TIMESTAMPTZ;

UPDATE public.company_profile
SET dwt_client_id = COALESCE(dwt_client_id, '1k2vbblqa4s66ge82rq5e6bct8'),
    dwt_environment = COALESCE(dwt_environment, 'sandbox'),
    dwt_api_base_url = COALESCE(dwt_api_base_url, 'https://waste-tracking.integration.api.defra.gov.uk')
WHERE dwt_client_id IS NULL OR dwt_environment IS NULL OR dwt_api_base_url IS NULL;