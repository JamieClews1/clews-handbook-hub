INSERT INTO public.email_templates (template_key, template_name, description, subject_template, sender_name, sender_email, available_variables, body_html)
VALUES (
  'orders_auto_reply',
  'Orders Inbox Auto-Reply',
  'Automatic holding reply sent to anyone emailing orders@clewsrecycling.co.uk. Includes live skip/RoRo booking days from Route One.',
  'Re: {{subject}}',
  'Clews Recycling',
  'orders@noreply.clewsrecycling.co.uk',
  ARRAY['subject','senderName','roroZone1','roroZone23','skipZone1','skipZone23','bookingWindows','weightChecksUrl'],
  '<div style="font-family: Arial, Helvetica, sans-serif; font-size:14px; color:#1f2937; max-width:640px;">
  <p>Thanks for your email.</p>
  <p><strong>We don''t send weights and Waste Transfer Notes anymore.</strong><br/>
  Download them here in seconds using just your PO and site postcode.<br/>
  <a href="{{weightChecksUrl}}" style="color:#16a34a; font-weight:bold;">{{weightChecksUrl}}</a></p>
  <p><strong>Need a quote?</strong><br/>
  Please allow 4 hours for a response on emailed requests for a quote.<br/>
  If your customer needs a quote immediately, call the office on <strong>01788 541549</strong>.<br/>
  If you have been given rates already, please refer to these before calling.</p>
  <p><strong>When are we taking jobs on for?</strong><br/>
  We are taking jobs for:</p>
  {{bookingWindows}}
  <p>Thanks for getting in touch, we''ll reply as soon as possible.</p>
  <p>Many thanks<br/>Jamie</p>
</div>'
)
ON CONFLICT (template_key) DO NOTHING;