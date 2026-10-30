CREATE TABLE public.customer_doc_import (id uuid PRIMARY KEY, l text, e date, s text);
GRANT ALL ON public.customer_doc_import TO service_role;
ALTER TABLE public.customer_doc_import ENABLE ROW LEVEL SECURITY;