import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WasteStreamValue = {
  id: string;
  stream: string;
  processes: string | null;
  share: number;
  waste_cost: number;
  additional_processing: number;
  haulage: number;
  is_recovery: boolean;
  sort_order: number;
};

export type WasteValueRates = {
  landfill_gate_rate: number;
  rdf_gate_rate: number;
  landfill_haulage_rate: number;
  gate_fee_per_tonne: number;
};

const DEFAULT_RATES: WasteValueRates = {
  landfill_gate_rate: 161,
  rdf_gate_rate: 133,
  landfill_haulage_rate: 7,
  gate_fee_per_tonne: 161,
};

export function streamCostPerTonne(s: WasteStreamValue) {
  return Number(s.waste_cost || 0) + Number(s.additional_processing || 0) + Number(s.haulage || 0);
}

export function useWasteValueSettings() {
  const [streams, setStreams] = useState<WasteStreamValue[]>([]);
  const [rates, setRates] = useState<WasteValueRates>(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: streamRows }, { data: settingRows }] = await Promise.all([
      supabase.from("waste_stream_values").select("*").order("sort_order", { ascending: true }),
      supabase.from("waste_value_settings").select("setting_key, setting_value"),
    ]);

    setStreams((streamRows ?? []).map((r: any) => ({
      ...r,
      share: Number(r.share ?? 0),
      waste_cost: Number(r.waste_cost ?? 0),
      additional_processing: Number(r.additional_processing ?? 0),
      haulage: Number(r.haulage ?? 0),
    })));

    const merged = { ...DEFAULT_RATES };
    for (const row of settingRows ?? []) {
      const key = row.setting_key as keyof WasteValueRates;
      if (!(key in merged)) continue;
      const num = Number(row.setting_value as any);
      if (!Number.isNaN(num)) merged[key] = num;
    }
    setRates(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveRate = async (key: keyof WasteValueRates, value: number) => {
    const { error } = await supabase
      .from("waste_value_settings")
      .upsert({ setting_key: key, setting_value: value as any }, { onConflict: "setting_key" });
    if (error) throw error;
    setRates((prev) => ({ ...prev, [key]: value }));
  };

  const saveStream = async (id: string, patch: Partial<WasteStreamValue>) => {
    const { error } = await supabase.from("waste_stream_values").update(patch as any).eq("id", id);
    if (error) throw error;
    setStreams((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } as WasteStreamValue : s)));
  };

  const addStream = async () => {
    const sort = (streams.at(-1)?.sort_order ?? 0) + 1;
    const { data, error } = await supabase
      .from("waste_stream_values")
      .insert({ stream: "New stream", sort_order: sort } as any)
      .select("*")
      .single();
    if (error) throw error;
    setStreams((prev) => [...prev, { ...(data as any), share: 0, waste_cost: 0, additional_processing: 0, haulage: 0 }]);
  };

  const deleteStream = async (id: string) => {
    const { error } = await supabase.from("waste_stream_values").delete().eq("id", id);
    if (error) throw error;
    setStreams((prev) => prev.filter((s) => s.id !== id));
  };

  const blendedCostPerTonne = streams.reduce((sum, s) => sum + s.share * streamCostPerTonne(s), 0);
  const totalShare = streams.reduce((sum, s) => sum + s.share, 0);

  return { streams, rates, loading, saveRate, saveStream, addStream, deleteStream, refetch: fetchAll, blendedCostPerTonne, totalShare };
}
