DELETE FROM public.hs_document_signatures WHERE document_id = '1b8d8362-05d6-45da-9d4c-6b4c8ab53922';
DELETE FROM public.hs_documents WHERE id = '1b8d8362-05d6-45da-9d4c-6b4c8ab53922';

INSERT INTO public.hs_documents (category, reference_code, title, site, version, requires_signature, is_published, content, acknowledgements)
VALUES (
  'site_induction',
  'SI-R01',
  'Annual Induction Refresher 2026 (abridged)',
  'Unit 17 Waste Transfer Station',
  '2026.1',
  true,
  true,
  '<h2>About this refresher</h2>
<ul>
<li>This is the short annual refresher for staff who have already completed the full Unit 17 Site Induction.</li>
<li>It recaps the rules that matter most. If anything here is unfamiliar, stop and ask a supervisor before starting work.</li>
<li>New starters and visitors must complete the full induction instead.</li>
</ul>
<p>Unit 17 Waste Transfer Station, Hunters Lane, Rugby CV21 1EA. 2026 Review.</p>

<h2>1. PPE &mdash; no PPE, no work</h2>
<ul>
<li>High-visibility vest or coat, worn at all times in the yard and never covered.</li>
<li>Safety boots with steel or composite toecap and midsole.</li>
<li>Gloves whenever handling waste or materials.</li>
<li>Helmet or bump cap in designated areas and wherever there is an overhead or impact risk.</li>
<li>Goggles, ear protection and face masks are free from the office &mdash; ask before you need them.</li>
</ul>

<h2>2. Vehicles and mobile plant</h2>
<ul>
<li>Never walk behind a reversing vehicle. Assume the driver cannot see you.</li>
<li>Make eye contact with the operator before crossing in front of plant or entering a working area.</li>
<li>Use marked walkways only. Do not cut across the tipping or loading areas.</li>
<li>Site speed limit and one-way flow apply to everyone, every time.</li>
</ul>

<h2>3. Machinery and the baler</h2>
<ul>
<li>Only use machinery, equipment or tools you are trained and authorised to use.</li>
<li>Never work alone on the baler.</li>
<li>Never climb on the baler belt unless you have removed the dead man&rsquo;s key and have it with you.</li>
<li>Report any damaged guard, tool or machine immediately &mdash; do not carry on using it.</li>
</ul>

<h2>4. Fire, first aid and emergencies</h2>
<ul>
<li>No smoking or vaping in the baler building or anywhere near waste.</li>
<li>Know your nearest extinguisher and keep it, and all exits, clear.</li>
<li>On the alarm, stop work, make your area safe if it is safe to do so, and go straight to the Fire Assembly Point.</li>
<li>Do not re-enter the building until a marshal or manager tells you it is safe.</li>
<li>Report every accident or injury, however minor, to a supervisor so it is recorded.</li>
</ul>

<h2>5. Near misses and housekeeping</h2>
<ul>
<li>Report near misses &mdash; they are how we stop the next accident. No blame is attached to reporting.</li>
<li>Keep walkways, exits and work areas clear and tidy throughout the shift.</li>
<li>Clean up spills and remove trip hazards straight away.</li>
</ul>

<h2>6. Conduct</h2>
<ul>
<li>Work as directed by your supervisor, in a safe and responsible manner.</li>
<li>Horse-play or disregard for safety instructions will not be tolerated and may lead to disciplinary action.</li>
<li>The site operates a random drug and alcohol testing policy.</li>
<li>Follow all instructions on site security, visitors and signing in and out.</li>
</ul>',
  '["I confirm I have previously completed the full Unit 17 Site Induction", "I understand the mandatory PPE requirements and that no PPE means no work", "I understand the safety rules for walking around vehicles and mobile plant", "I will only use machinery, equipment or tools I am trained and authorised to use, and I understand the baler rules", "I understand the fire alarm signals, my nearest extinguisher and the location of the Fire Assembly Point", "I understand how and why to report a near miss, and that all accidents must be reported", "I confirm I have read and understood this refresher and agree to work within the guidelines set out"]'::jsonb
);