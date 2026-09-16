import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EwcCode, SicCode } from "@/lib/code-registers";

export const useEwcCodes = (includeInactive = false) =>
  useQuery({
    queryKey: ["ewc_codes", includeInactive],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<EwcCode[]> => {
      let q = supabase.from("ewc_codes").select("*").order("code");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EwcCode[];
    },
  });

export const useSicCodes = (includeInactive = false) =>
  useQuery({
    queryKey: ["sic_codes", includeInactive],
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<SicCode[]> => {
      let q = supabase.from("sic_codes").select("*").order("code");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SicCode[];
    },
  });
