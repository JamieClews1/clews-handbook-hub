CREATE TABLE public.gdpr_retention_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_months integer NOT NULL DEFAULT 12,
  apply_to_customers boolean NOT NULL DEFAULT true,
  apply_to_contacts boolean NOT NULL DEFAULT true,
  auto_archive boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gdpr_retention_settings TO authenticated;
GRANT ALL ON public.gdpr_retention_settings TO service_role;

ALTER TABLE public.gdpr_retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view retention settings"
ON public.gdpr_retention_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()));

CREATE POLICY "Admins manage retention settings"
ON public.gdpr_retention_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()));

CREATE TRIGGER update_gdpr_retention_settings_updated_at
BEFORE UPDATE ON public.gdpr_retention_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.gdpr_retention_settings (retention_months) VALUES (12);

CREATE TABLE public.gdpr_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  customer_name text NOT NULL,
  action text NOT NULL,
  last_activity_date date,
  performed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gdpr_cleanup_log TO authenticated;
GRANT ALL ON public.gdpr_cleanup_log TO service_role;

ALTER TABLE public.gdpr_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cleanup log"
ON public.gdpr_cleanup_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()));

CREATE POLICY "Admins manage cleanup log"
ON public.gdpr_cleanup_log FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_management(auth.uid()));

CREATE TRIGGER update_gdpr_cleanup_log_updated_at
BEFORE UPDATE ON public.gdpr_cleanup_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_customer_activity_summary()
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  customer_code text,
  is_inactive boolean,
  last_activity_date date,
  job_count integer,
  contact_count integer,
  site_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH names AS (
    SELECT c.id AS customer_id, lower(btrim(c.customer_name)) AS nm
    FROM public.customers c
    UNION
    SELECT cs.customer_id, lower(btrim(cs.data_hub_customer))
    FROM public.customer_sites cs
    WHERE cs.data_hub_customer IS NOT NULL AND btrim(cs.data_hub_customer) <> ''
  ),
  jobs AS (
    SELECT lower(btrim(j.customer)) AS nm,
           MAX(j.job_date) AS last_date,
           COUNT(*)::integer AS cnt
    FROM public.data_hub_jobs j
    WHERE j.customer IS NOT NULL
    GROUP BY 1
  ),
  agg AS (
    SELECT n.customer_id,
           MAX(jb.last_date) AS last_date,
           COALESCE(SUM(jb.cnt), 0)::integer AS cnt
    FROM names n
    LEFT JOIN jobs jb ON jb.nm = n.nm
    GROUP BY n.customer_id
  )
  SELECT c.id,
         c.customer_name,
         c.customer_code,
         NOT COALESCE(c.is_active, true),
         a.last_date,
         COALESCE(a.cnt, 0),
         (SELECT COUNT(*)::integer FROM public.customer_contacts cc WHERE cc.customer_id = c.id),
         (SELECT COUNT(*)::integer FROM public.customer_sites cs2 WHERE cs2.customer_id = c.id)
  FROM public.customers c
  LEFT JOIN agg a ON a.customer_id = c.id;
$$;