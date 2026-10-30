CREATE TABLE public.waste_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recorded_name text NOT NULL UNIQUE,
 display_name text NOT NULL,
 ewc_code text NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','needs_review','retired')),
 notes text,
 source text NOT NULL DEFAULT 'midweigh_export',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_products TO authenticated;
GRANT ALL ON public.waste_products TO service_role;
ALTER TABLE public.waste_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read waste products" ON public.waste_products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage waste products" ON public.waste_products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.waste_products (recorded_name,display_name,ewc_code,status,notes) VALUES
('Qualifying Trommel Fines','Trommel fines','19 12 12','active',null),
('Transfer Station Waste. Landfill','Waste out – landfill','19 12 12','active',null),
('Waste Transfer Station. RDF','Waste out – RDF','19 12 12','needs_review','RDF product recorded on 19 12 12; 19 12 10 is the RDF code.'),
('Transfer Station Waste','Transfer station waste','19 12 12','needs_review','Unclear whether landfill or RDF.'),
('Wood C grade Outgoing','Wood grade C','19 12 07','active',null),
('Wood A grade outgoing','Wood grade A','19 12 07','active',null),
('Paper and Card','Paper and card','19 12 01','active',null),
('Mixed Papers','Mixed papers','19 12 01','active',null),
('(Waste to Energy) RDF','RDF (waste to energy)','19 12 10','active',null),
('Ferrous Metals','Ferrous metal','19 12 02','active',null),
('Low Grade Wood (Grade C)','Wood grade C','17 02 01','needs_review','Outgoing processed wood normally 19 12 07; same product appears there.'),
('Plasterboard','Plasterboard','17 08 02','active',null),
('Hardcore Mechanically processed','Processed hardcore','19 12 09','active',null),
('Clean Wood (Grade A)','Wood grade A','15 01 03','needs_review','Outgoing processed wood normally 19 12 07.'),
('Hardcore/Bricks/Rubble/Tiles/Ceramics','Hardcore and rubble','17 01 07','active',null),
('Non Ferrous Metals (Ali,copper,brass,lead,cable)','Non-ferrous metal','19 12 03','active',null),
('Plastics Outgoing','Plastics','19 12 04','active',null),
('Plastic Packaging Out','Plastic packaging','15 01 02','active',null),
('Domestic Fridges','Domestic fridges','20 01 35','needs_review','Fridges/freezers containing CFCs are normally hazardous 20 01 23*.'),
('WEEE','WEEE','20 01 35','needs_review','20 01 35 is hazardous WEEE; non-hazardous is 20 01 36.'),
('Green Waste/Biodegradable Waste','Green waste','20 02 01','active',null),
('Ferrous Metals (Shearing/Light Iorn/Cast/Frag)','Ferrous metal (shearing/light iron)','20 01 40','active',null),
('POPS Per tonne','POPs waste','20 03 07','needs_review','POPs upholstered seating must follow POPs guidance, not mixed bulky waste.'),
('Bulky Household waste (furniture, large items)','Bulky waste','20 03 07','active',null),
('Car Tyres','Car tyres','16 01 03','active',null),
('Mixed Metals ferrous and Non','Mixed metals','17 04 07','active',null),
('Hazardous Wood','Hazardous wood','20 01 37','active',null),
('Mixed Municipal/ General Waste','General waste','20 03 01','active',null),
('Cardboard','Cardboard','15 01 01','active',null),
('Paper','Paper','15 01 01','active',null),
('Plastics','Plastics','20 01 39','active',null),
('Aluminium Cans','Aluminium cans','15 01 04','active',null),
('Mixed Packaging/ Co Mingled waste','Mixed packaging','15 01 06','active',null),
('Inert (Soil and Stones)','Soil and stones','17 05 04','active',null),
('Mixed Construction Demolition /Builders Waste','Mixed construction waste','17 09 04','active',null);