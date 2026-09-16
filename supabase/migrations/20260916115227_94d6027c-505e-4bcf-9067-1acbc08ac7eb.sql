
CREATE TABLE public.permit_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area TEXT NOT NULL,
  postcodes TEXT NOT NULL,
  permit_days INTEGER NOT NULL,
  price_exc_vat NUMERIC NOT NULL DEFAULT 0,
  price_inc_vat NUMERIC NOT NULL DEFAULT 0,
  notice_required TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permit_pricing TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permit_pricing TO authenticated;
GRANT ALL ON public.permit_pricing TO service_role;
ALTER TABLE public.permit_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active permit pricing" ON public.permit_pricing FOR SELECT TO anon USING (active = true);
CREATE POLICY "Staff can manage permit pricing" ON public.permit_pricing FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_permit_pricing_updated_at BEFORE UPDATE ON public.permit_pricing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.permit_councils (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area TEXT NOT NULL UNIQUE,
  council_name TEXT,
  application_emails TEXT[] NOT NULL DEFAULT '{}',
  cc_emails TEXT[] NOT NULL DEFAULT '{}',
  portal_url TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permit_councils TO authenticated;
GRANT ALL ON public.permit_councils TO service_role;
ALTER TABLE public.permit_councils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage permit councils" ON public.permit_councils FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_permit_councils_updated_at BEFORE UPDATE ON public.permit_councils FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.permit_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_one_job_id UUID REFERENCES public.route_one_jobs(id) ON DELETE SET NULL,
  job_number TEXT,
  customer_name TEXT,
  site_address TEXT,
  site_postcode TEXT,
  area TEXT,
  pricing_id UUID REFERENCES public.permit_pricing(id) ON DELETE SET NULL,
  notice_required TEXT,
  permit_days INTEGER,
  price_exc_vat NUMERIC,
  status TEXT NOT NULL DEFAULT 'needed',
  permit_reference TEXT,
  start_date DATE,
  expiry_date DATE,
  applied_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  council_emails TEXT[] NOT NULL DEFAULT '{}',
  crm_ticket_id UUID REFERENCES public.crm_tickets(id) ON DELETE SET NULL,
  last_chase_at TIMESTAMPTZ,
  last_chase_window TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permit_applications TO authenticated;
GRANT ALL ON public.permit_applications TO service_role;
ALTER TABLE public.permit_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage permit applications" ON public.permit_applications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_permit_applications_updated_at BEFORE UPDATE ON public.permit_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_permit_applications_status ON public.permit_applications(status);
CREATE INDEX idx_permit_applications_expiry ON public.permit_applications(expiry_date);
CREATE INDEX idx_permit_applications_job ON public.permit_applications(route_one_job_id);

CREATE TABLE public.permit_email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  permit_application_id UUID REFERENCES public.permit_applications(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  cc TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  sent_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.permit_email_log TO authenticated;
GRANT ALL ON public.permit_email_log TO service_role;
ALTER TABLE public.permit_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view permit email log" ON public.permit_email_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert permit email log" ON public.permit_email_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_permit_email_log_permit ON public.permit_email_log(permit_application_id);

CREATE TABLE public.permit_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_send_applications BOOLEAN NOT NULL DEFAULT false,
  auto_confirm_from_replies BOOLEAN NOT NULL DEFAULT false,
  chase_lead_hours INTEGER NOT NULL DEFAULT 72,
  chase_recipient TEXT NOT NULL DEFAULT 'orders@clewsrecycling.co.uk',
  expiry_check_enabled BOOLEAN NOT NULL DEFAULT true,
  sender_name TEXT NOT NULL DEFAULT 'Clews Recycling',
  sender_email TEXT NOT NULL DEFAULT 'permits@noreply.clewsrecycling.co.uk',
  application_subject TEXT NOT NULL DEFAULT 'Skip permit application - {{site_postcode}} ({{job_number}})',
  application_body TEXT NOT NULL DEFAULT '<p>Dear {{area}} Highways team,</p><p>We would like to apply for a skip road permit for the following placement:</p><ul><li><strong>Customer:</strong> {{customer_name}}</li><li><strong>Site address:</strong> {{site_address}}</li><li><strong>Postcode:</strong> {{site_postcode}}</li><li><strong>Skip size:</strong> {{skip_size}}</li><li><strong>Requested start date:</strong> {{start_date}}</li><li><strong>Permit duration:</strong> {{permit_days}} days</li><li><strong>Our job reference:</strong> {{job_number}}</li></ul><p>Please confirm the permit and reference number by reply.</p><p>Kind regards,<br/>Clews Recycling</p>',
  chase_subject TEXT NOT NULL DEFAULT 'Permit expiring in {{hours_remaining}} hours - {{site_postcode}} ({{job_number}})',
  chase_body TEXT NOT NULL DEFAULT '<p>The following road permit expires soon and the skip is still on site:</p><ul><li><strong>Job:</strong> {{job_number}}</li><li><strong>Customer:</strong> {{customer_name}}</li><li><strong>Site:</strong> {{site_address}} {{site_postcode}}</li><li><strong>Council:</strong> {{area}}</li><li><strong>Permit reference:</strong> {{permit_reference}}</li><li><strong>Expires:</strong> {{expiry_date}} ({{hours_remaining}} hours)</li></ul><p>Please arrange a collection or an extension.</p>',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.permit_settings TO authenticated;
GRANT ALL ON public.permit_settings TO service_role;
ALTER TABLE public.permit_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage permit settings" ON public.permit_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_permit_settings_updated_at BEFORE UPDATE ON public.permit_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.route_one_jobs
  ADD COLUMN IF NOT EXISTS permit_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_application_id UUID REFERENCES public.permit_applications(id) ON DELETE SET NULL;
