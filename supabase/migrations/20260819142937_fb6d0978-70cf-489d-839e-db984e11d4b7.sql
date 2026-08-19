CREATE TABLE public.stock_check_ewc_reclass_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_type_id UUID NOT NULL REFERENCES public.stock_check_container_types(id) ON DELETE CASCADE,
  to_type_id UUID NOT NULL REFERENCES public.stock_check_container_types(id) ON DELETE CASCADE,
  ewc_codes TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_check_ewc_reclass_rules TO authenticated;
GRANT ALL ON public.stock_check_ewc_reclass_rules TO service_role;

ALTER TABLE public.stock_check_ewc_reclass_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reclass rules"
  ON public.stock_check_ewc_reclass_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage reclass rules"
  ON public.stock_check_ewc_reclass_rules FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_stock_check_ewc_reclass_rules_updated_at
  BEFORE UPDATE ON public.stock_check_ewc_reclass_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.stock_check_ewc_reclass_rules (from_type_id, to_type_id, ewc_codes)
SELECT f.id, t.id, ARRAY['17 09 04','20 03 01']
FROM public.stock_check_container_types f, public.stock_check_container_types t
WHERE f.name = '20yd' AND t.name = '25/30yd';