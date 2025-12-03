-- Create toolbox_talks table
CREATE TABLE public.toolbox_talks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  user_types TEXT[] NOT NULL DEFAULT '{}',
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.toolbox_talks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view toolbox talks" ON public.toolbox_talks FOR SELECT USING (true);
CREATE POLICY "Admins can insert toolbox talks" ON public.toolbox_talks FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update toolbox talks" ON public.toolbox_talks FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete toolbox talks" ON public.toolbox_talks FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_toolbox_talks_updated_at
  BEFORE UPDATE ON public.toolbox_talks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create toolbox_talk_signatures table
CREATE TABLE public.toolbox_talk_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  toolbox_talk_id UUID NOT NULL REFERENCES public.toolbox_talks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  signature_image TEXT,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.toolbox_talk_signatures ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own signatures" ON public.toolbox_talk_signatures FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all signatures" ON public.toolbox_talk_signatures FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert their own signatures" ON public.toolbox_talk_signatures FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Management can insert signatures for users" ON public.toolbox_talk_signatures FOR INSERT WITH CHECK (is_management(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete signatures" ON public.toolbox_talk_signatures FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));