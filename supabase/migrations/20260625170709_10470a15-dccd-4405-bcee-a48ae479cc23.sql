CREATE TABLE public.assistant_question_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_question_log TO authenticated;
GRANT ALL ON public.assistant_question_log TO service_role;

ALTER TABLE public.assistant_question_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own question log"
  ON public.assistant_question_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own question log"
  ON public.assistant_question_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own question log"
  ON public.assistant_question_log FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_assistant_question_log_user_created
  ON public.assistant_question_log (user_id, created_at DESC);