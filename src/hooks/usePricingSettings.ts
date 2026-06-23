import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PricingSettings = {
  auto_add_fuel_surcharge: boolean;
};

const DEFAULTS: PricingSettings = {
  auto_add_fuel_surcharge: false,
};

const BOOLEAN_KEYS: (keyof PricingSettings)[] = ["auto_add_fuel_surcharge"];

export function usePricingSettings() {
  const [settings, setSettings] = useState<PricingSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("pricing_settings")
      .select("setting_key, setting_value");

    if (error) {
      console.error("Failed to load pricing settings", error);
      setLoading(false);
      return;
    }

    const merged = { ...DEFAULTS };
    for (const row of data ?? []) {
      const key = row.setting_key as keyof PricingSettings;
      if (key in merged) {
        const val = row.setting_value;
        if (BOOLEAN_KEYS.includes(key)) {
          (merged as any)[key] = val === true || val === "true";
        } else {
          (merged as any)[key] = val;
        }
      }
    }
    setSettings(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: keyof PricingSettings, value: any) => {
    const { error } = await supabase
      .from("pricing_settings")
      .upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });

    if (error) throw error;
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, loading, updateSetting, refetch: fetchSettings };
}
