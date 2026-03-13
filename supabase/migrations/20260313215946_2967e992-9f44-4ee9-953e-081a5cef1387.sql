
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  description TEXT,
  subject_template TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT 'Clews Recycling',
  sender_email TEXT NOT NULL DEFAULT 'accounts@noreply.clewsrecycling.co.uk',
  available_variables TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read email templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (true);

-- Insert default rebate notification template
INSERT INTO public.email_templates (template_key, template_name, description, subject_template, body_html, sender_name, sender_email, available_variables)
VALUES (
  'rebate_notification',
  'Rebate Notification',
  'Sent to customers with their monthly rebate report. The email body from the form is inserted into {{body}}.',
  '{{subject}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f4f4f4; padding: 20px; border-bottom: 3px solid #22c55e;">
    <h1 style="color: #333; margin: 0; font-size: 24px;">Rebate Notification</h1>
  </div>
  <div style="padding: 20px; background-color: #ffffff;">
    <p style="font-size: 14px; line-height: 1.6; color: #333;">
      {{body}}
    </p>
  </div>
  <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #666;">
    <p style="margin: 0;">Clews Recycling Limited</p>
    <p style="margin: 5px 0 0 0;">This is an automated message. Please do not reply directly to this email.</p>
  </div>
</div>',
  'Clews Recycling',
  'accounts@noreply.clewsrecycling.co.uk',
  ARRAY['subject', 'body', 'customerName']
);

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
