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

/* ── Effective-window helpers (April pricing cycle) ─────────────────── */

export type CardWindowState = "current" | "future" | "past";
export type CardWindow = { start: string | null; end: string | null; state: CardWindowState };

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** End of the April→March pricing year that contains `startIso` (i.e. 31 March of the following cycle). */
function aprilCycleEnd(startIso: string): string {
  const [y, m] = startIso.split("-").map(Number);
  const endYear = m >= 4 ? y + 1 : y;
  return `${endYear}-03-31`;
}

export function formatUkDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Work out the effective window + current/future/past state for each rate card.
 * Cards are grouped by customer type (and customer for bespoke). A card runs from its
 * effective date until the day before the next card in its group, or to 31 March of its
 * April pricing cycle when it is the latest card.
 */
export function computeCardWindows(cards: RateCard[], todayIso?: string): Map<string, CardWindow> {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  const result = new Map<string, CardWindow>();
  const groups = new Map<string, RateCard[]>();

  for (const c of cards) {
    const key = `${c.customer_type}|${c.customer_id ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  for (const group of groups.values()) {
    const dated = group
      .filter((c) => c.effective_date)
      .sort((a, b) => (a.effective_date! < b.effective_date! ? -1 : 1));
    const undated = group.filter((c) => !c.effective_date);

    for (let i = 0; i < dated.length; i++) {
      const c = dated[i];
      const start = c.effective_date!;
      const next = dated[i + 1];
      const end = next?.effective_date ? addDaysIso(next.effective_date, -1) : aprilCycleEnd(start);
      let state: CardWindowState;
      if (start > today) state = "future";
      else if (end < today) state = "past";
      else state = "current";
      result.set(c.id, { start, end, state });
    }

    for (const c of undated) result.set(c.id, { start: null, end: null, state: "current" });
  }

  return result;
}

/**
 * Deep-clone a rate card (zones, rows and values) into a new card with the supplied header
 * fields. Used to roll a card forward to the next April pricing year.
 */
export async function duplicateRateCard(
  sourceId: string,
  newCard: {
    customer_type: RateCard["customer_type"];
    name: string;
    customer_id: string | null;
    vat_inclusive: boolean;
    effective_date: string | null;
    notes?: string | null;
  },
): Promise<{ id: string } | { error: string }> {
  const { data: created, error: cErr } = await supabase
    .from("pricing_rate_cards")
    .insert({
      customer_type: newCard.customer_type,
      name: newCard.name,
      customer_id: newCard.customer_id,
      vat_inclusive: newCard.vat_inclusive,
      effective_date: newCard.effective_date,
      notes: newCard.notes ?? null,
    })
    .select()
    .single();
  if (cErr || !created) return { error: cErr?.message || "Could not create card" };

  // clone zones
  const { data: zones } = await supabase.from("pricing_rate_card_zones").select("*").eq("card_id", sourceId);
  const zoneIdMap = new Map<string, string>();
  if (zones?.length) {
    const { data: newZones } = await supabase
      .from("pricing_rate_card_zones")
      .insert(
        zones.map((z) => ({
          card_id: created.id,
          zone_code: z.zone_code,
          zone_name: z.zone_name,
          description: z.description,
          display_order: z.display_order,
        })),
      )
      .select();
    newZones?.forEach((nz) => {
      const old = zones.find((z) => z.zone_code === nz.zone_code && z.display_order === nz.display_order);
      if (old) zoneIdMap.set(old.id, nz.id);
    });
  }

  // clone rows
  const { data: rows } = await supabase.from("pricing_rate_card_rows").select("*").eq("card_id", sourceId);
  const rowIdMap = new Map<string, string>();
  if (rows?.length) {
    const { data: newRows } = await supabase
      .from("pricing_rate_card_rows")
      .insert(
        rows.map((r) => ({
          card_id: created.id,
          section: r.section,
          label: r.label,
          note: r.note,
          unit: r.unit,
          display_order: r.display_order,
        })),
      )
      .select();
    newRows?.forEach((nr) => {
      const old = rows.find((r) => r.label === nr.label && r.display_order === nr.display_order);
      if (old) rowIdMap.set(old.id, nr.id);
    });
  }

  // clone values
  const oldRowIds = rows?.map((r) => r.id) || [];
  if (oldRowIds.length) {
    const { data: values } = await supabase.from("pricing_rate_card_values").select("*").in("row_id", oldRowIds);
    const newValues = (values || [])
      .map((v) => {
        const nr = rowIdMap.get(v.row_id);
        const nz = zoneIdMap.get(v.zone_id);
        if (!nr || !nz) return null;
        return { row_id: nr, zone_id: nz, status: v.status, price: v.price, text_value: v.text_value };
      })
      .filter(Boolean);
    if (newValues.length) {
      await supabase.from("pricing_rate_card_values").insert(newValues as never[]);
    }
  }

  return { id: created.id };
}

/** Suggest the next April pricing year for a card, from its current effective date or today. */
export function nextAprilYear(effectiveDate: string | null): number {
  const base = effectiveDate ? Number(effectiveDate.slice(0, 4)) : new Date().getUTCFullYear();
  return base + 1;
}

