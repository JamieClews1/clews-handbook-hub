REVOKE ALL ON FUNCTION public.crm_match_customer_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_match_customer_by_email(text) TO authenticated, service_role;