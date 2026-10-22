REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.company_pl_access FROM authenticated, anon;
REVOKE SELECT ON public.company_pl_access FROM anon;