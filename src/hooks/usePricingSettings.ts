import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PricingSettings = {
  auto_add_fuel_surcharge: boolean;
  free_rental_weeks_residential: number;
  free_rental_weeks_trade: number;
  rental_cost_skip: number;
  rental_cost_roro: number;
  bespoke_rules: string;
  terms_url: string;
  quote_attachment_enabled: boolean;
  quote_attachment_path: string;
  quote_attachment_name: string;
};

const DEFAULTS: PricingSettings = {
  auto_add_fuel_surcharge: false,
  free_rental_weeks_residential: 2,
  free_rental_weeks_trade: 4,
  rental_cost_skip: 18,
  rental_cost_roro: 42,
  bespoke_rules: "Mixed waste loads cannot accept any soil, hardcore or plasterboard.",
  terms_url: "https://www.clewsrecycling.co.uk/terms-and-conditions",
  quote_attachment_enabled: true,
  quote_attachment_path: "skip-permitted-waste.pdf",
  quote_attachment_name: "Skip Permitted Waste.pdf",
};

const BOOLEAN_KEYS: (keyof PricingSettings)[] = ["auto_add_fuel_surcharge", "quote_attachment_enabled"];
const NUMBER_KEYS: (keyof PricingSettings)[] = [
  "free_rental_weeks_residential",
  "free_rental_weeks_trade",
  "rental_cost_skip",
  "rental_cost_roro",
];

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
      if (!(key in merged)) continue;
      const val = row.setting_value;
      if (BOOLEAN_KEYS.includes(key)) {
        (merged as any)[key] = val === true || val === "true";
      } else if (NUMBER_KEYS.includes(key)) {
        const num = typeof val === "number" ? val : Number(val);
        if (!Number.isNaN(num)) (merged as any)[key] = num;
      } else {
        (merged as any)[key] = typeof val === "string" ? val : String(val ?? "");
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
