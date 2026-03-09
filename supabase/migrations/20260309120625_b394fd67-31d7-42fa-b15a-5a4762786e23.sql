
-- Insert the Welcome & Introduction section at display_order 0
INSERT INTO public.handbook_sections (id, section_key, title_en, display_order)
VALUES (
  gen_random_uuid(),
  'welcome-introduction',
  'Welcome and Introduction',
  0
);

-- Insert subsections
INSERT INTO public.handbook_subsections (section_id, subsection_key, title_en, content_en, display_order)
VALUES
(
  (SELECT id FROM public.handbook_sections WHERE section_key = 'welcome-introduction'),
  'welcome',
  'Welcome',
  'Welcome to Clews Recycling Ltd (referred to throughout this handbook as "We" or "the Company"). Our strength as a Company is due to the skills and abilities of colleagues like you. We look forward to a long and successful working relationship with you and sincerely hope that your time with us is enjoyable and rewarding.',
  1
),
(
  (SELECT id FROM public.handbook_sections WHERE section_key = 'welcome-introduction'),
  'this-handbook',
  'This Handbook',
  '<p>This handbook is designed to explain the way in which we work and to set out the key procedures, rules and policies designed to ensure an efficient workplace and a safe and supportive environment for all employees. The contents of this handbook do not form part of the terms of your contract of employment unless otherwise stated. The Company may need to alter or amend any policy or procedure contained in this handbook to ensure that it remains relevant and consistent with the needs of the business. Any such change will be notified to all employees and an up-to-date copy of this handbook will be issued from time to time.</p><p>You are expected to comply with the requirements set out in this handbook and failure to do so may lead to disciplinary action; in appropriate cases, up to and including dismissal.</p><p>The Employee Handbook will be issued in English, versions will be made available in Polish, Romanian and Russian however, owing to translation errors you should use those versions as a guide as the English copy will be the definitive version.</p><p>A hard copy will be available in the Mess room and the weighbridge office you can also access the Handbook online at https://portal.clewsrecycling.co.uk/handbook.</p>',
  2
);
