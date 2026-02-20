import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveJobsSettings = {
  rental_free_days: number;
  artic_vehicle_regs: string[];
  artic_container_keywords: string[];
  roro_container_keywords: string[];
  skip_container_keywords: string[];
  waste_truck_months: number;
};

const DEFAULTS: LiveJobsSettings = {
  rental_free_days: 28,
  artic_vehicle_regs: ["FG61 SYV", "FJ18 FDM"],
  artic_container_keywords: ["curtain side", "walking floor", "bulk ejector", "artic haulage"],
  roro_container_keywords: ["ro ro", "roll on roll off", "ro ro haulage"],
  skip_container_keywords: ["skip", "yard", "yd", "chain lift"],
  waste_truck_months: 6,
};

export function useLiveJobsSettings() {
  const [settings, setSettings] = useState<LiveJobsSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("live_jobs_settings")
      .select("setting_key, setting_value");

    if (error) {
      console.error("Failed to load live jobs settings", error);
      setLoading(false);
      return;
    }

    const merged = { ...DEFAULTS };
    for (const row of data ?? []) {
      const key = row.setting_key as keyof LiveJobsSettings;
      const val = row.setting_value;
      if (key in merged) {
        if (key === "rental_free_days" || key === "waste_truck_months") {
          merged[key] = typeof val === "number" ? val : Number(val);
        } else {
          (merged as any)[key] = Array.isArray(val) ? val : val;
        }
      }
    }
    setSettings(merged);
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = async (key: keyof LiveJobsSettings, value: any) => {
    const { error } = await supabase
      .from("live_jobs_settings")
      .update({ setting_value: value })
      .eq("setting_key", key);

    if (error) throw error;
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return { settings, loading, updateSetting, refetch: fetchSettings };
}
