-- Add assigned_users column to rams table for specific user assignments
ALTER TABLE public.rams 
ADD COLUMN assigned_users uuid[] DEFAULT '{}'::uuid[];

-- Add assigned_users column to toolbox_talks table for specific user assignments
ALTER TABLE public.toolbox_talks 
ADD COLUMN assigned_users uuid[] DEFAULT '{}'::uuid[];

-- Add comments for clarity
COMMENT ON COLUMN public.rams.assigned_users IS 'Specific users assigned to sign off on this RAMS. If empty, uses user_types for filtering.';
COMMENT ON COLUMN public.toolbox_talks.assigned_users IS 'Specific users assigned to sign off on this Toolbox Talk. If empty, uses user_types for filtering.';