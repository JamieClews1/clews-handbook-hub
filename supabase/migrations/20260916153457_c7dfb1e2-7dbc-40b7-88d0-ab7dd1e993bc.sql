CREATE TABLE public.route_one_routing_rules (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_one_routing_rules TO authenticated;
GRANT ALL ON public.route_one_routing_rules TO service_role;

ALTER TABLE public.route_one_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read routing rules"
ON public.route_one_routing_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage routing rules"
ON public.route_one_routing_rules FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER update_route_one_routing_rules_updated_at
BEFORE UPDATE ON public.route_one_routing_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();