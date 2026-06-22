import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RateZone = {
  id: string;
  card_id: string;
  zone_code: string;
  zone_name: string | null;
  description: string | null;
  display_order: number;
};

export type RateRow = {
  id: string;
  card_id: string;
  section: string | null;
  label: string;
  note: string | null;
  unit: string | null;
  display_order: number;
};

export type RateValue = {
  id: string;
  row_id: string;
  zone_id: string;
  status: "price" | "call_for_quote" | "na" | "text";
  price: number | null;
  text_value: string | null;
};

export type RateCard = {
  id: string;
  customer_type: "residential" | "trade" | "broker" | "bespoke";
  name: string;
  customer_id: string | null;
  vat_inclusive: boolean;
  effective_date: string | null;
  agreed_by: string | null;
  notes: string | null;
  is_active: boolean;
};

export const FLAT_ZONE = "FLAT";
export const TONNAGE_SECTION = "Tonnage & Material Rates";

export function useRateCards() {
  const [cards, setCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pricing_rate_cards")
      .select("*")
      .order("customer_type")
      .order("name");
    setCards((data as RateCard[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { cards, loading, refresh };
}

export function useRateCardData(cardId: string | null) {
  const [zones, setZones] = useState<RateZone[]>([]);
  const [rows, setRows] = useState<RateRow[]>([]);
  const [values, setValues] = useState<RateValue[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!cardId) {
      setZones([]);
      setRows([]);
      setValues([]);
      return;
    }
    setLoading(true);
    const [zRes, rRes] = await Promise.all([
      supabase.from("pricing_rate_card_zones").select("*").eq("card_id", cardId).order("display_order"),
      supabase.from("pricing_rate_card_rows").select("*").eq("card_id", cardId).order("display_order"),
    ]);
    const rowIds = (rRes.data || []).map((r) => r.id);
    let vData: RateValue[] = [];
    if (rowIds.length) {
      const { data } = await supabase
        .from("pricing_rate_card_values")
        .select("*")
        .in("row_id", rowIds);
      vData = (data as RateValue[]) || [];
    }
    setZones((zRes.data as RateZone[]) || []);
    setRows((rRes.data as RateRow[]) || []);
    setValues(vData);
    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { zones, rows, values, loading, refresh, setValues };
}

export const CUSTOMER_TYPE_LABELS: Record<RateCard["customer_type"], string> = {
  residential: "Residential",
  trade: "Trade",
  broker: "Major Broker",
  bespoke: "Bespoke",
};
