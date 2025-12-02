-- Create RAMS table
CREATE TABLE public.rams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code text NOT NULL,
    title text NOT NULL,
    applicable_to text[] DEFAULT '{}',
    notice_to_drivers text,
    created_date date NOT NULL DEFAULT CURRENT_DATE,
    review_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '12 months')::date,
    creator_signature text,
    creator_name text,
    signed_at timestamp with time zone,
    is_mandatory boolean NOT NULL DEFAULT false,
    user_types text[] NOT NULL DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create RAMS hazards table for the risk assessment rows
CREATE TABLE public.rams_hazards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rams_id uuid NOT NULL REFERENCES public.rams(id) ON DELETE CASCADE,
    activity text NOT NULL,
    potential_hazard text NOT NULL,
    who_at_risk text NOT NULL,
    initial_likelihood integer NOT NULL DEFAULT 1 CHECK (initial_likelihood BETWEEN 1 AND 5),
    initial_severity integer NOT NULL DEFAULT 1 CHECK (initial_severity BETWEEN 1 AND 5),
    control_measures text NOT NULL,
    residual_likelihood integer NOT NULL DEFAULT 1 CHECK (residual_likelihood BETWEEN 1 AND 5),
    residual_severity integer NOT NULL DEFAULT 1 CHECK (residual_severity BETWEEN 1 AND 5),
    notes text,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rams_hazards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rams
CREATE POLICY "Anyone can view rams"
ON public.rams FOR SELECT
USING (true);

CREATE POLICY "Admins can insert rams"
ON public.rams FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update rams"
ON public.rams FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete rams"
ON public.rams FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for rams_hazards
CREATE POLICY "Anyone can view rams_hazards"
ON public.rams_hazards FOR SELECT
USING (true);

CREATE POLICY "Admins can insert rams_hazards"
ON public.rams_hazards FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update rams_hazards"
ON public.rams_hazards FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete rams_hazards"
ON public.rams_hazards FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_rams_updated_at
BEFORE UPDATE ON public.rams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rams_hazards_updated_at
BEFORE UPDATE ON public.rams_hazards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();