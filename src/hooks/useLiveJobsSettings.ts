import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CHASE_EMAIL_TEMPLATE } from "@/lib/rental-chase-email";

export { DEFAULT_CHASE_EMAIL_TEMPLATE };

export type LiveJobsSettings = {
  rental_free_days: number;
  artic_vehicle_regs: string[];
  artic_container_keywords: string[];
  roro_container_keywords: string[];
  skip_container_keywords: string[];
  waste_truck_months: number;
  rental_skip_rate: number;
  rental_roro_rate: number;
  rental_chase_email_template: string;
};

const DEFAULTS: LiveJobsSettings = {
  rental_free_days: 30,
  artic_vehicle_regs: ["FG61 SYV", "FJ18 FDM"],
  artic_container_keywords: ["curtain side", "walking floor", "bulk ejector", "artic haulage"],
  roro_container_keywords: ["ro ro", "roll on roll off", "ro ro haulage"],
  skip_container_keywords: ["skip", "yard", "yd", "chain lift"],
  waste_truck_months: 6,
  rental_skip_rate: 18,
  rental_roro_rate: 42,
  rental_chase_email_template: DEFAULT_CHASE_EMAIL_TEMPLATE,
};

const NUMBER_KEYS: (keyof LiveJobsSettings)[] = [
  "rental_free_days",
  "waste_truck_months",
  "rental_skip_rate",
  "rental_roro_rate",
];

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
        if (NUMBER_KEYS.includes(key)) {
          (merged as any)[key] = typeof val === "number" ? val : Number(val);
        } else {
          (merged as any)[key] = val;
        }
      }
    }
    setSettings(merged);
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = async (key: keyof LiveJobsSettings, value: any) => {
    // Upsert so newly-introduced settings (e.g. rental rates / email template)
    // are created on first save even if no seed row exists yet.
    const { error } = await supabase
      .from("live_jobs_settings")
      .upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });

    if (error) throw error;
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return { settings, loading, updateSetting, refetch: fetchSettings };
}
