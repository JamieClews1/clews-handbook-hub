CREATE TABLE public.waste_stream_values (
  id uuid primary key default gen_random_uuid(),
  stream text not null,
  processes text,
  share numeric not null default 0,
  waste_cost numeric not null default 0,
  additional_processing numeric not null default 0,
  haulage numeric not null default 0,
  is_recovery boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_stream_values TO authenticated;
GRANT ALL ON public.waste_stream_values TO service_role;
ALTER TABLE public.waste_stream_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view waste stream values" ON public.waste_stream_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage waste stream values" ON public.waste_stream_values FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_wsv_updated BEFORE UPDATE ON public.waste_stream_values FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.waste_value_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_value_settings TO authenticated;
GRANT ALL ON public.waste_value_settings TO service_role;
ALTER TABLE public.waste_value_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view waste value settings" ON public.waste_value_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage waste value settings" ON public.waste_value_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.waste_value_settings (setting_key, setting_value) VALUES
 ('landfill_gate_rate', '161'),
 ('rdf_gate_rate', '133'),
 ('landfill_haulage_rate', '7'),
 ('gate_fee_per_tonne', '161');

INSERT INTO public.waste_stream_values (stream, processes, share, waste_cost, additional_processing, haulage, is_recovery, sort_order) VALUES
 ('Wood A','Moving wood from belt to A Grade Pile. Loading Grade A into bulker. Haulage to Silva',0.05,0,5,5,true,1),
 ('Wood C','Moving wood from belt to C Grade pile. Loading Grade C into bulker. Haulage to Silva',0.15,50,5,5,true,2),
 ('Waste RDF','Moving to baler. Baling processing and wrapping costs. Loading into container',0.28,133,35,0,true,3),
 ('Waste Landfill','Moving from belt to waste bay. Loading into bulker',0.14,161,5,7,false,4),
 ('Trommel','Moving from belt to trommel bay. Processing with sand. Loading Crown',0.10,25,20,0,true,5),
 ('Hardcore','Screening twice. Loading RoRos. Haulage to landfill',0.10,23,40,7,true,6),
 ('Plastics','Moving from belt to baler',0.05,-5,15,0,true,7),
 ('Papers/ Card','Moving from belt to baler. Baling. Loading into container',0.03,-40,15,0,true,8),
 ('Films','Moving from belt to baler. Baling. Loading into container',0.01,-40,15,0,true,9),
 ('Plasterboard','Moving from belt to bin',0.04,70,5,0,true,10),
 ('Metal','Moving from belt to bin',0.05,-80,5,0,true,11);