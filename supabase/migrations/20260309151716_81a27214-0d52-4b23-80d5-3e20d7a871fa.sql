-- Remove letter prefixes (a), b), etc.) from list items in 4.9 Homeworking
UPDATE public.handbook_subsections
SET content_en = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content_en,
  '<li>a) you need to be present', '<li>you need to be present'),
  '<li>b) your most recent', '<li>your most recent'),
  '<li>c) your line manager has advised', '<li>your line manager has advised'),
  '<li>d) you have an unexpired', '<li>you have an unexpired'),
  '<li>e) you need training', '<li>you need training'),
  '<li>f) Your job requires', '<li>your job requires'),
  '<li>a) have a suitable', '<li>have a suitable'),
  '<li>b) continue to work', '<li>continue to work'),
  '<li>c) work independently', '<li>work independently'),
  '<li>d) manage your workload', '<li>manage your workload'),
  '<li>e) identify and resolve', '<li>identify and resolve'),
  '<li>f) adapt to new working', '<li>adapt to new working'),
  '<li>g) make arrangements', '<li>make arrangements'),
  '<li>h) determine any resulting', '<li>determine any resulting'),
  '<li>i) Where homeworking', '<li>where homeworking'),
  '<li>j) The company can withdraw', '<li>the company can withdraw')
WHERE id = '2894b98e-7224-43cf-ac5a-71c403d2dd96';

-- Also fix equipment list letter prefixes
UPDATE public.handbook_subsections
SET content_en = REPLACE(REPLACE(REPLACE(REPLACE(content_en,
  '<li>a) ensure it is only', '<li>ensure it is only'),
  '<li>b) take reasonable care', '<li>take reasonable care'),
  '<li>c) make it available', '<li>make it available'),
  '<li>d) not use any personal', '<li>not use any personal')
WHERE id = '2894b98e-7224-43cf-ac5a-71c403d2dd96';