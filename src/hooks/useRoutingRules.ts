import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RoutingRules = {
  max_skips_per_load: number;
  max_8yd_per_load: number;
  max_12yd_per_load: number;
  max_skips_on_empty_vehicle: number;
  roro_containers_per_trip: number;
  mins_delivery: number;
  mins_collection: number;
  mins_exchange: number;
  mins_tipping: number;
  mins_travel: number;
  mins_break: number;
  day_start: string;
  day_length_hours: number;
  artic_regs: string[];
  skip_drivers_no_roro: boolean;
  idle_drivers_not_working: boolean;
  loaded_skips_one_at_a_time: boolean;
  /** How travel time between jobs is worked out. */
  travel_model: "fixed" | "distance" | "zone";
  /** Depot / yard postcode — the first and last leg of every day. */
  yard_postcode: string;
  /** Average road speed used to turn miles into minutes. */
  avg_speed_mph: number;
  /** Straight-line miles are multiplied by this to approximate road miles. */
  road_distance_factor: number;
  /** Never allow a travel leg shorter than this. */
  mins_travel_min: number;
  /** Average minutes to reach each postcode zone from the yard. */
  zone_travel_minutes: Record<string, number>;
  /** Minutes between two jobs inside the same zone. */
  mins_travel_within_zone: number;
};

export const DEFAULT_ROUTING_RULES: RoutingRules = {
  max_skips_per_load: 3,
  max_8yd_per_load: 3,
  max_12yd_per_load: 2,
  max_skips_on_empty_vehicle: 3,
  roro_containers_per_trip: 1,
  mins_delivery: 20,
  mins_collection: 25,
  mins_exchange: 35,
  mins_tipping: 20,
  mins_travel: 25,
  mins_break: 30,
  day_start: "07:00",
  day_length_hours: 10,
  artic_regs: ["FG61 SYV", "FJ18 FDM"],
  skip_drivers_no_roro: true,
  idle_drivers_not_working: true,
  loaded_skips_one_at_a_time: true,
};

const NUMBER_KEYS: (keyof RoutingRules)[] = [
  "max_skips_per_load",
  "max_8yd_per_load",
  "max_12yd_per_load",
  "max_skips_on_empty_vehicle",
  "roro_containers_per_trip",
  "mins_delivery",
  "mins_collection",
  "mins_exchange",
  "mins_tipping",
  "mins_travel",
  "mins_break",
  "day_length_hours",
];

export function useRoutingRules() {
  const queryClient = useQueryClient();

  const { data: rules = DEFAULT_ROUTING_RULES, isLoading } = useQuery({
    queryKey: ["route-one-routing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_routing_rules")
        .select("setting_key, setting_value");
      if (error) throw error;
      const merged: RoutingRules = { ...DEFAULT_ROUTING_RULES };
      for (const row of data ?? []) {
        const key = row.setting_key as keyof RoutingRules;
        if (!(key in merged)) continue;
        const val = (row as any).setting_value;
        if (NUMBER_KEYS.includes(key)) {
          (merged as any)[key] = typeof val === "number" ? val : Number(val);
        } else {
          (merged as any)[key] = val;
        }
      }
      return merged;
    },
  });

  const saveRule = useMutation({
    mutationFn: async ({ key, value }: { key: keyof RoutingRules; value: any }) => {
      const { error } = await supabase
        .from("route_one_routing_rules")
        .upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["route-one-routing-rules"] }),
  });

  return { rules, isLoading, saveRule };
}
