import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PermitApplication, PermitPricingRow } from "@/lib/permits";

export type PermitCouncil = {
  id: string;
  area: string;
  council_name: string | null;
  application_emails: string[];
  cc_emails: string[];
  portal_url: string | null;
  notes: string | null;
  active: boolean;
};

export type PermitSettings = {
  id: string;
  auto_send_applications: boolean;
  auto_confirm_from_replies: boolean;
  chase_lead_hours: number;
  chase_recipient: string;
  expiry_check_enabled: boolean;
  sender_name: string;
  sender_email: string;
  application_subject: string;
  application_body: string;
  chase_subject: string;
  chase_body: string;
};

export function usePermitPricing() {
  return useQuery({
    queryKey: ["permit_pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permit_pricing")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as PermitPricingRow[];
    },
  });
}

export function usePermitCouncils() {
  return useQuery({
    queryKey: ["permit_councils"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permit_councils").select("*").order("area");
      if (error) throw error;
      return (data ?? []) as unknown as PermitCouncil[];
    },
  });
}

export function usePermitSettings() {
  return useQuery({
    queryKey: ["permit_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permit_settings")
        .select("*")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PermitSettings | null;
    },
  });
}

export function usePermitApplications() {
  return useQuery({
    queryKey: ["permit_applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permit_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PermitApplication[];
    },
  });
}

export function useUpdatePermit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("permit_applications").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permit_applications"] });
      qc.invalidateQueries({ queryKey: ["route_one_jobs"] });
    },
  });
}
