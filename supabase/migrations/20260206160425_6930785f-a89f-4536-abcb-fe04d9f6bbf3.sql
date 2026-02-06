-- Drop the existing unique constraint on job_number alone
ALTER TABLE public.data_hub_jobs DROP CONSTRAINT IF EXISTS data_hub_jobs_job_number_unique;

-- Create a new unique constraint on (job_number, source) to allow same job numbers from different sources
CREATE UNIQUE INDEX data_hub_jobs_job_number_source_unique ON public.data_hub_jobs (job_number, source);