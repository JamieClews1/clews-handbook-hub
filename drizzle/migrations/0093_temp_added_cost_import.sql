CREATE TABLE public.tmp_added_cost_import (ticket text PRIMARY KEY, added numeric NOT NULL);
GRANT ALL ON public.tmp_added_cost_import TO service_role;
ALTER TABLE public.tmp_added_cost_import ENABLE ROW LEVEL SECURITY;