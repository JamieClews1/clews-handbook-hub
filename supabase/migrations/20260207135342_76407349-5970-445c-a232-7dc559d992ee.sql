-- Add job_type column to data_hub_jobs table
-- This is separate from container_type and represents the Midweigh "Job Type" field
-- which indicates whether a weighbridge ticket is for a SKIP, RoRo, etc.
ALTER TABLE public.data_hub_jobs ADD COLUMN IF NOT EXISTS job_type text;