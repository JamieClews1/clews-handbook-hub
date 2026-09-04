
ALTER TABLE public.container_load_contacts
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

UPDATE public.customers SET is_container_load_customer = true
WHERE customer_code IN ('DH0196','DH0446','DH0577','DH0578','DH0625','DH0822');

INSERT INTO public.container_load_contacts (name, company, email, is_default, account_number, customer_id)
VALUES
  ('Yifei (Evie) Zhang','WPT','zhang.y@wpt-nl.com', false, NULL, NULL),
  ('Dennis Meringa','WPT','meringa.d@wpt-nl.com', false, NULL, NULL),
  ('David Jupp','WPT','david.j@wpt-uk.com', false, NULL, NULL),
  ('Nadia','DCE','Admin@dcetrading.co.uk', false, 'DH0196', (SELECT id FROM public.customers WHERE customer_code='DH0196')),
  ('Ed','DCE','Ed@dcetrading.co.uk', false, 'DH0196', (SELECT id FROM public.customers WHERE customer_code='DH0196')),
  ('Thanasis Milios','Vipa','thanasis.milios@vipagroup.com', false, 'DH0822', (SELECT id FROM public.customers WHERE customer_code='DH0822')),
  ('Georgios Gkelos','Vipa','georgios.gkelos@vipagroup.com', false, 'DH0822', (SELECT id FROM public.customers WHERE customer_code='DH0822')),
  ('Apostolos Tsourekas','Vipa','apostolos.tsourekas@vipagroup.com', false, 'DH0822', (SELECT id FROM public.customers WHERE customer_code='DH0822')),
  ('Elissa Tray','Nevis','elissa@nevis-resources.co.uk', true, 'DH0577', (SELECT id FROM public.customers WHERE customer_code='DH0577')),
  ('Harriet Humphrey','Nevis','harriet@nevis-resources.co.uk', false, 'DH0577', (SELECT id FROM public.customers WHERE customer_code='DH0577')),
  ('Toby','Nevis','toby@nevis-resources.co.uk', false, 'DH0577', (SELECT id FROM public.customers WHERE customer_code='DH0577')),
  ('Michael Dowd','Leinster','michael@lerecycle.co.uk', false, 'DH0446', (SELECT id FROM public.customers WHERE customer_code='DH0446')),
  ('Gerry','Leinster','gerry@lerecycle.co.uk', false, 'DH0446', (SELECT id FROM public.customers WHERE customer_code='DH0446')),
  ('Planning','Peute','planning@peute.nl', false, 'DH0625', (SELECT id FROM public.customers WHERE customer_code='DH0625')),
  ('Maarten de Vrijer','Peute','m.devrijer@peute.nl', false, 'DH0625', (SELECT id FROM public.customers WHERE customer_code='DH0625')),
  ('Nykle Weijts','Peute','n.weijts@peute.nl', false, 'DH0625', (SELECT id FROM public.customers WHERE customer_code='DH0625'))
ON CONFLICT DO NOTHING;
