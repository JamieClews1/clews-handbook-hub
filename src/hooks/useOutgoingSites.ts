import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OutgoingSite = { site_name: string; loads: number; last_date: string | null };

/** Tipping/outlet sites from past Midweigh and WeighOne outgoing loads, most recently used first. */
export function useOutgoingSites() {
  return useQuery({
    queryKey: ["outgoing-sites"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_outgoing_sites");
      if (error) throw error;
      return (data ?? []) as OutgoingSite[];
    },
  });
}
