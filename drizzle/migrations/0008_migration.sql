ALTER TABLE public.crm_email_templates ADD COLUMN IF NOT EXISTS template_key text UNIQUE;
ALTER TABLE public.crm_tickets
  ADD COLUMN IF NOT EXISTS ai_draft_subject text,
  ADD COLUMN IF NOT EXISTS ai_draft_body text,
  ADD COLUMN IF NOT EXISTS ai_draft_template text,
  ADD COLUMN IF NOT EXISTS ai_draft_found jsonb,
  ADD COLUMN IF NOT EXISTS ai_draft_missing text[],
  ADD COLUMN IF NOT EXISTS ai_drafted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_draft_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_draft_edit_pct numeric;

INSERT INTO public.crm_email_templates (template_key, name, category, subject, body) VALUES
('booking','Booking / PO confirmation','Booking','Booked: {{poNumber}} {{siteName}} {{postcode}}',
'Hi {{firstName}},

Thanks for the order. This is now booked:
- PO: {{poNumber}}
- Site: {{siteAddress}}
- Service: {{service}} {{containerSize}} {{wasteType}}
- Date: {{serviceDate}}

If there are any access restrictions or a site contact we should call, please let us know.

Many thanks,
{{userName}}
Clews Recycling'),
('quote','Quote, price and availability','Query','Quote: {{containerSize}} {{wasteType}} {{postcode}}',
'Hi {{firstName}},

Thanks for getting in touch. For a {{containerSize}} {{wasteType}} at {{postcode}}:
- Price: £{{price}} + VAT, plus fuel surcharge of £{{fuelSurcharge}} per movement
- Earliest delivery: {{availableDate}}
- {{permitNote}}

To book, reply with the delivery address, date, site contact and any access restrictions, or call {{companyPhone}}.

Many thanks,
{{userName}}'),
('exchange','Exchange confirmation','Booking','Exchange booked: {{siteName}} {{exchangeDate}}',
'Hi {{firstName}},

Your {{containerSize}} {{wasteType}} exchange at {{siteName}} is booked for {{exchangeDate}}{{poLine}}.

Please make sure the container is accessible and filled level.

Many thanks,
{{userName}}'),
('weight_paperwork','Weight for broker','Query','Weight: {{poNumber}} {{siteName}}',
'Hi {{firstName}},

{{poNumber}} at {{siteName}} was completed on {{jobDate}}. Weight: {{weightTonnes}} t.

WTN and ticket: {{weightChecksUrl}}

Many thanks,
{{userName}}'),
('collection','Collection confirmation','Booking','Collection booked: {{siteName}} {{collectionDate}}',
'Hi {{firstName}},

Collection of the {{containerSize}} at {{siteName}} is booked for {{collectionDate}}{{poLine}}.

Many thanks,
{{userName}}'),
('invoice','Invoice or fuel-surcharge query','Invoice','Re: Invoice {{invoiceNumber}}',
'Hi {{firstName}},

Thanks, we''ve received your query about invoice {{invoiceNumber}} ({{querySummary}}). Our accounts team will come back to you by {{replyByDate}}.

Any queries please email sharon@clewsrecycling.co.uk.

Many thanks,
{{userName}}'),
('cancellation','Cancellation / amendment','Booking','{{changeType}}: {{poNumber}}',
'Hi {{firstName}},

Confirmed, {{poNumber}} at {{siteName}} has been {{changeSummary}}.
{{chargeNote}}

Many thanks,
{{userName}}'),
('compliance','Compliance documents pack','Query','Clews Recycling compliance documents',
'Hi {{firstName}},

Please find attached our current {{documentList}}. Waste carrier registration {{wclNumber}} is valid to {{wclExpiry}}.

Let us know if you need anything else for your supplier records.

Many thanks,
{{userName}}'),
('job_check','Job completion confirmation','Booking','Completed: {{jobRef}} {{siteName}}',
'Hi {{firstName}},

Confirming {{jobRef}} at {{siteName}} was completed on {{serviceDate}}{{weightLine}}. WTN: {{wtnLink}}

Many thanks,
{{userName}}'),
('complaint','Service issue holding reply','Complaint','Re: {{originalSubject}}',
'Hi {{firstName}},

Sorry about this. We''re looking into {{issueSummary}} at {{siteName}} now and will update you by {{callbackTime}} today.

Many thanks,
{{userName}}')
ON CONFLICT (template_key) DO NOTHING;