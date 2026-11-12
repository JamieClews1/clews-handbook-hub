CREATE TABLE public.office_app_pins (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash text,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  pin_set_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.office_app_pins IS 'Office App PIN sign-in. pin_hash NULL means the starting PIN still applies and must be changed at first sign-in. Read and written only by the office-app-auth function (service role).';
GRANT ALL ON public.office_app_pins TO service_role;
ALTER TABLE public.office_app_pins ENABLE ROW LEVEL SECURITY;