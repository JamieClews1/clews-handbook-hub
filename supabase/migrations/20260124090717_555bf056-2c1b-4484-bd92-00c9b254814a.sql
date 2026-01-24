-- Customers + customer portal scaffolding

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  -- manual attach to Data Hub values (optional)
  data_hub_customer text,
  data_hub_site text,
  owner_contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, site_name)
);

-- Price-set templates for rebate items
CREATE TABLE IF NOT EXISTS public.rebate_price_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rebate_price_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_set_id uuid NOT NULL REFERENCES public.rebate_price_sets(id) ON DELETE CASCADE,
  rebate_item_id uuid NOT NULL REFERENCES public.rebate_items(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (price_set_id, rebate_item_id)
);

-- assign one price-set template to a site
CREATE TABLE IF NOT EXISTS public.customer_site_price_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.customer_sites(id) ON DELETE CASCADE,
  price_set_id uuid NOT NULL REFERENCES public.rebate_price_sets(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Portal access (site-scoped)
CREATE TABLE IF NOT EXISTS public.customer_portal_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.customer_portal_site_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.customer_portal_memberships(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.customer_sites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, site_id)
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebate_price_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebate_price_set_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_site_price_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_site_access ENABLE ROW LEVEL SECURITY;

-- Admin/management management policies
CREATE POLICY "Admin/management can manage customers"
ON public.customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admin/management can manage customer contacts"
ON public.customer_contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admin/management can manage customer sites"
ON public.customer_sites
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admin/management can manage rebate price sets"
ON public.rebate_price_sets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admin/management can manage rebate price set items"
ON public.rebate_price_set_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admin/management can manage site price sets"
ON public.customer_site_price_sets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admin/management can manage portal memberships"
ON public.customer_portal_memberships
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

CREATE POLICY "Admin/management can manage portal site access"
ON public.customer_portal_site_access
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_management(auth.uid()));

-- Portal user read access (self)
CREATE POLICY "Portal users can view their memberships"
ON public.customer_portal_memberships
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Portal users can view their site access"
ON public.customer_portal_site_access
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_portal_memberships m
    WHERE m.id = customer_portal_site_access.membership_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Portal users can view their customer"
ON public.customers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_portal_memberships m
    WHERE m.customer_id = customers.id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Portal users can view contacts for their customer"
ON public.customer_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_portal_memberships m
    WHERE m.customer_id = customer_contacts.customer_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Portal users can view sites they have access to"
ON public.customer_sites
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_portal_memberships m
    JOIN public.customer_portal_site_access a ON a.membership_id = m.id
    WHERE m.user_id = auth.uid()
      AND a.site_id = customer_sites.id
  )
);

-- updated_at triggers
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_contacts_updated_at
BEFORE UPDATE ON public.customer_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_sites_updated_at
BEFORE UPDATE ON public.customer_sites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rebate_price_sets_updated_at
BEFORE UPDATE ON public.rebate_price_sets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rebate_price_set_items_updated_at
BEFORE UPDATE ON public.rebate_price_set_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_site_price_sets_updated_at
BEFORE UPDATE ON public.customer_site_price_sets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_portal_memberships_updated_at
BEFORE UPDATE ON public.customer_portal_memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_portal_site_access_updated_at
BEFORE UPDATE ON public.customer_portal_site_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helpful indexes
CREATE INDEX IF NOT EXISTS idx_customer_sites_customer_id ON public.customer_sites(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON public.customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.customer_portal_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_site_access_membership_id ON public.customer_portal_site_access(membership_id);
