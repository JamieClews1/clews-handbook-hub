-- Add translation columns to rams table
ALTER TABLE public.rams
ADD COLUMN IF NOT EXISTS title_pl TEXT,
ADD COLUMN IF NOT EXISTS title_uk TEXT,
ADD COLUMN IF NOT EXISTS title_ro TEXT,
ADD COLUMN IF NOT EXISTS notice_to_drivers_pl TEXT,
ADD COLUMN IF NOT EXISTS notice_to_drivers_uk TEXT,
ADD COLUMN IF NOT EXISTS notice_to_drivers_ro TEXT;

-- Add translation columns to rams_hazards table
ALTER TABLE public.rams_hazards
ADD COLUMN IF NOT EXISTS activity_pl TEXT,
ADD COLUMN IF NOT EXISTS activity_uk TEXT,
ADD COLUMN IF NOT EXISTS activity_ro TEXT,
ADD COLUMN IF NOT EXISTS potential_hazard_pl TEXT,
ADD COLUMN IF NOT EXISTS potential_hazard_uk TEXT,
ADD COLUMN IF NOT EXISTS potential_hazard_ro TEXT,
ADD COLUMN IF NOT EXISTS who_at_risk_pl TEXT,
ADD COLUMN IF NOT EXISTS who_at_risk_uk TEXT,
ADD COLUMN IF NOT EXISTS who_at_risk_ro TEXT,
ADD COLUMN IF NOT EXISTS control_measures_pl TEXT,
ADD COLUMN IF NOT EXISTS control_measures_uk TEXT,
ADD COLUMN IF NOT EXISTS control_measures_ro TEXT,
ADD COLUMN IF NOT EXISTS notes_pl TEXT,
ADD COLUMN IF NOT EXISTS notes_uk TEXT,
ADD COLUMN IF NOT EXISTS notes_ro TEXT;

-- Add translation columns to toolbox_talks table
ALTER TABLE public.toolbox_talks
ADD COLUMN IF NOT EXISTS title_pl TEXT,
ADD COLUMN IF NOT EXISTS title_uk TEXT,
ADD COLUMN IF NOT EXISTS title_ro TEXT,
ADD COLUMN IF NOT EXISTS content_pl TEXT,
ADD COLUMN IF NOT EXISTS content_uk TEXT,
ADD COLUMN IF NOT EXISTS content_ro TEXT;