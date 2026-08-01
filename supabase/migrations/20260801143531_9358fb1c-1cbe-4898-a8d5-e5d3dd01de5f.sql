CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('finance-overdue-reminders-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finance-overdue-reminders-daily');

SELECT cron.schedule(
  'finance-overdue-reminders-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://atblyrrczwcmnyhcdkto.supabase.co/functions/v1/finance-overdue-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);