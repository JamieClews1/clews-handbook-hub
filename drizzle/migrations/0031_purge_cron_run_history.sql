DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-cron-run-history';
SELECT cron.schedule('purge-cron-run-history', '17 3 * * *', $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '3 days'$$);