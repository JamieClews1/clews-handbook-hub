import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { type SiteClass, SITE_CLASSES } from "@/lib/tipping-site-classification";

export interface VerifiedTippingSite {
  id: string;
  site_name: string;
  site_class?: SiteClass;
  operator_name: string | null;
  registration_number: string | null;
  register: string;
  facility_type: string | null;
  address: string | null;
  postcode: string | null;
  status: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  register_details?: RegisterDetails | null;
  register_checked_at?: string | null;
}

export interface RegisterPermit { permit_number: string; licence_holder: string | null; site_name: string | null; facility_type: string | null; status: string | null; holder_match?: boolean }
export interface RegisterCarrier { business_name: string; registration_number: string; postcode: string | null; company_type: string | null; tier: string | null }
export interface RegisterDetails { permits?: RegisterPermit[]; carriers?: RegisterCarrier[] }

export type NewVerifiedTippingSite = Omit<VerifiedTippingSite, "id" | "created_at" | "created_by" | "register_details" | "register_checked_at">;

export function useVerifiedTippingSites() {
  return useQuery({
    queryKey: ["verified-tipping-sites"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verified_tipping_sites")
        .select("*")
        .order("site_name");
      if (error) throw error;
      return (data ?? []) as VerifiedTippingSite[];
    },
  });
}

export function useSaveVerifiedTippingSite() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (site: NewVerifiedTippingSite) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("verified_tipping_sites").upsert(
        { ...site, created_by: user?.id ?? null },
        { onConflict: "site_name,postcode" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verified-tipping-sites"] });
      qc.invalidateQueries({ queryKey: ["tipping-sites"] });
      toast({ title: "Tipping site saved", description: "It will now appear first when choosing tipping locations." });
    },
    onError: (e) => toast({ title: "Could not save site", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
  });
}

export function useDeleteVerifiedTippingSite() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("verified_tipping_sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verified-tipping-sites"] });
      qc.invalidateQueries({ queryKey: ["tipping-sites"] });
      toast({ title: "Site removed" });
    },
    onError: (e) => toast({ title: "Could not remove site", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
  });
}

export function useUpdateSiteClass() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, site_class }: { id: string; site_class: SiteClass }) => {
      const { data, error } = await supabase.from("verified_tipping_sites")
        .update({ site_class }).eq("id", id).select("id").single();
      if (error) throw error;
      if (!data) throw new Error("The entry could not be updated.");
    },
    onSuccess: (_, { site_class }) => {
      qc.invalidateQueries({ queryKey: ["verified-tipping-sites"] });
      qc.invalidateQueries({ queryKey: ["tipping-sites"] });
      toast({ title: `Moved to ${SITE_CLASSES[site_class]}`, description: "Company details and permit evidence have been kept." });
    },
    onError: () => toast({ title: "Could not change classification", description: "Please try again.", variant: "destructive" }),
  });
}
