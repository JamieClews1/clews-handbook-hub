CREATE TABLE public.toolbox_talk_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  toolbox_talk_id UUID NOT NULL REFERENCES public.toolbox_talks(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toolbox_talk_share_links TO authenticated;
GRANT ALL ON public.toolbox_talk_share_links TO service_role;
ALTER TABLE public.toolbox_talk_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage toolbox talk share links" ON public.toolbox_talk_share_links
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
CREATE INDEX toolbox_talk_share_links_talk_idx ON public.toolbox_talk_share_links (toolbox_talk_id);
CREATE TRIGGER update_toolbox_talk_share_links_updated_at BEFORE UPDATE ON public.toolbox_talk_share_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.toolbox_talk_guest_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  toolbox_talk_id UUID NOT NULL REFERENCES public.toolbox_talks(id) ON DELETE CASCADE,
  share_link_id UUID REFERENCES public.toolbox_talk_share_links(id) ON DELETE SET NULL,
  signer_name TEXT NOT NULL,
  company_name TEXT,
  job_title TEXT,
  language TEXT NOT NULL DEFAULT 'EN',
  signature_image TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.toolbox_talk_guest_signatures TO authenticated;
GRANT ALL ON public.toolbox_talk_guest_signatures TO service_role;
ALTER TABLE public.toolbox_talk_guest_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view toolbox talk guest signatures" ON public.toolbox_talk_guest_signatures
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY "Admins delete toolbox talk guest signatures" ON public.toolbox_talk_guest_signatures
  FOR DELETE TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
CREATE INDEX toolbox_talk_guest_signatures_talk_idx ON public.toolbox_talk_guest_signatures (toolbox_talk_id, signed_at);