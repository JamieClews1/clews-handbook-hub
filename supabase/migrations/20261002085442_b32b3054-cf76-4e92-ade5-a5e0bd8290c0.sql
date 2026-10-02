ALTER TABLE public.ewc_codes ADD COLUMN IF NOT EXISTS dwt_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.route_one_jobs ADD COLUMN IF NOT EXISTS waste_classification jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.weighbridge_transactions ADD COLUMN IF NOT EXISTS waste_classification jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.ewc_codes.dwt_defaults IS 'Staff-reviewed draft classification defaults for DWT; not used by current DEFRA submission.';
COMMENT ON COLUMN public.route_one_jobs.waste_classification IS 'Staff-entered hazardous and POPs movement details; not sent to DEFRA by current upload.';
COMMENT ON COLUMN public.weighbridge_transactions.waste_classification IS 'Staff-entered hazardous and POPs receipt details; not sent to DEFRA by current upload.';