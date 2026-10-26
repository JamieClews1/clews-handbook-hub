import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface VerifiedTippingSite {
  id: string;
  site_name: string;
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
}

export type NewVerifiedTippingSite = Omit<VerifiedTippingSite, "id" | "created_at" | "created_by">;

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
