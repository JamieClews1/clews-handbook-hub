CREATE TABLE public.near_miss_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  period_from timestamptz,
  period_to timestamptz NOT NULL,
  report_count integer NOT NULL DEFAULT 0,
  report_ids uuid[] NOT NULL DEFAULT '{}',
  summary jsonb NOT NULL,
  model text
);

GRANT SELECT, INSERT, DELETE ON public.near_miss_summaries TO authenticated;
GRANT ALL ON public.near_miss_summaries TO service_role;

ALTER TABLE public.near_miss_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Near miss reviewers can view summaries"
ON public.near_miss_summaries FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::app_role) OR public.is_management((SELECT auth.uid())));

CREATE POLICY "Near miss reviewers can save their own summaries"
ON public.near_miss_summaries FOR INSERT TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()) AND (public.has_role((SELECT auth.uid()), 'admin'::app_role) OR public.is_management((SELECT auth.uid()))));

CREATE POLICY "Admins can delete summaries"
ON public.near_miss_summaries FOR DELETE TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE INDEX near_miss_summaries_period_to_idx ON public.near_miss_summaries (period_to DESC);