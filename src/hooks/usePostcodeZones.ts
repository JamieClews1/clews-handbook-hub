import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PostcodeZone = {
  id: string;
  zone_name: string;
  postcodes: string[];
  display_order: number;
};

export function usePostcodeZones() {
  const [zones, setZones] = useState<PostcodeZone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchZones = useCallback(async () => {
    const { data, error } = await supabase
      .from("postcode_zones")
      .select("id, zone_name, postcodes, display_order")
      .order("display_order");

    if (error) {
      console.error("Failed to load postcode zones", error);
    } else {
      setZones((data ?? []) as PostcodeZone[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const updateZone = async (id: string, updates: Partial<Pick<PostcodeZone, "zone_name" | "postcodes" | "display_order">>) => {
    const { error } = await supabase
      .from("postcode_zones")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
    await fetchZones();
  };

  const addZone = async (zone_name: string, postcodes: string[], display_order: number) => {
    const { error } = await supabase
      .from("postcode_zones")
      .insert({ zone_name, postcodes, display_order });
    if (error) throw error;
    await fetchZones();
  };

  const deleteZone = async (id: string) => {
    const { error } = await supabase
      .from("postcode_zones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    await fetchZones();
  };

  return { zones, loading, updateZone, addZone, deleteZone, refetch: fetchZones };
}
