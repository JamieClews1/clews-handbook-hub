create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('crm-mailbox-poll') where exists (select 1 from cron.job where jobname = 'crm-mailbox-poll');

select cron.schedule(
  'crm-mailbox-poll',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://atblyrrczwcmnyhcdkto.supabase.co/functions/v1/crm-mailbox-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Ymx5cnJjendjbW55aGNka3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzI3NTgsImV4cCI6MjA3OTMwODc1OH0.UBTKywVsMtebjnNQ9B8H5ULJpq0-lUQIhU_y2KBFE3c',
      'x-cron-secret', '417fad1484b8be6b9962b95f769463470c372887b1bf790a'
    ),
    body := '{"cron":true}'::jsonb
  );
  $$
);