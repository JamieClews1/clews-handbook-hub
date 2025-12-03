-- Create enum for user types
CREATE TYPE public.user_type AS ENUM ('driver', 'yard', 'office', 'management');

-- Add user_types array to profiles
ALTER TABLE public.profiles 
ADD COLUMN user_types user_type[] DEFAULT '{}';

-- Create table for tracking RAMS signatures/completions by users
CREATE TABLE public.rams_user_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rams_id uuid NOT NULL REFERENCES public.rams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signature_image text,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(rams_id, user_id)
);

-- Enable RLS
ALTER TABLE public.rams_user_signatures ENABLE ROW LEVEL SECURITY;

-- Users can view their own signatures
CREATE POLICY "Users can view their own RAMS signatures"
ON public.rams_user_signatures FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own signatures
CREATE POLICY "Users can insert their own RAMS signatures"
ON public.rams_user_signatures FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all signatures
CREATE POLICY "Admins can view all RAMS signatures"
ON public.rams_user_signatures FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete signatures
CREATE POLICY "Admins can delete RAMS signatures"
ON public.rams_user_signatures FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Update profiles policy to allow users to update their own profile (including user_types for admin)
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));