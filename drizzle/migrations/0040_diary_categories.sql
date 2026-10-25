CREATE TABLE public.diary_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'grey',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diary_categories TO authenticated;
GRANT ALL ON public.diary_categories TO service_role;
ALTER TABLE public.diary_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own diary categories"
ON public.diary_categories FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);