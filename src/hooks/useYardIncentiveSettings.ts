import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type YardIncentiveSettings = {
  bonus_share_pct: number;
  baseline_recovery_pct: number;
  target_recovery_pct: number;
  team_size: number;
  monthly_bonus_cap: number;
  // Recycling incentive (% of outgoing waste not going to landfill or RDF)
  recycling_bonus_share_pct: number;
  recycling_baseline_pct: number;
  recycling_target_pct: number;
  recycling_team_size: number;
  recycling_monthly_bonus_cap: number;
  recycling_value_per_tonne: number;
};

const DEFAULTS: YardIncentiveSettings = {
  bonus_share_pct: 20,
  baseline_recovery_pct: 0,
  target_recovery_pct: 0,
  team_size: 0,
  monthly_bonus_cap: 0,
  recycling_bonus_share_pct: 20,
  recycling_baseline_pct: 0,
  recycling_target_pct: 0,
  recycling_team_size: 0,
  recycling_monthly_bonus_cap: 0,
  recycling_value_per_tonne: 0,
};


export function useYardIncentiveSettings() {
  const [settings, setSettings] = useState<YardIncentiveSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("yard_incentive_settings")
      .select("setting_key, setting_value");
    const merged = { ...DEFAULTS };
    for (const row of data ?? []) {
      const key = row.setting_key as keyof YardIncentiveSettings;
      if (!(key in merged)) continue;
      const num = Number(row.setting_value as any);
      if (!Number.isNaN(num)) merged[key] = num;
    }
    setSettings(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveSetting = async (key: keyof YardIncentiveSettings, value: number) => {
    const { error } = await supabase
      .from("yard_incentive_settings")
      .upsert({ setting_key: key, setting_value: value } as any, { onConflict: "setting_key" });
    if (error) throw error;
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, loading, saveSetting, refetch: fetchAll };
}
