import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tags, MapPin, History, Loader2 } from "lucide-react";
import {
  useRateCards,
  useRateCardData,
  computeCardWindows,
  CUSTOMER_TYPE_LABELS,
  FLAT_ZONE,
  TONNAGE_SECTION,
  type RateCard,
} from "@/components/pricing/useRateCard";

/** Rate-card zone codes keyed by the zone label held on pricing_zone_postcodes. */
const POSTCODE_ZONE_TO_CODE: Record<string, string> = {
  "Zone 1": "Z1",
  "Zone 2": "Z2",
  "Zone 3": "Z3",
  "Zone 3 RoRo Only": "Z3R",
  "Zone 4 RoRo Only": "Z4R",
  "Zone 4": "Z4",
};

const money = (n: number) => n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

type PrevPrice = {
  job_number: string | null;
  scheduled_date: string | null;
  container_type: string | null;
  haulage_cost: number | null;
  charge_per_tonne: number | null;
  min_weight_charge: number | null;
  weight_included_t: number | null;
  vat_rate: number | null;
  cost_items: any;
};

/**
 * Pricing block for the RouteOne job form.
 *
 * Pulls live rates out of the Pricing CMS for the customer's pricing tier
 * (Residential / Trade / Broker / a bespoke card) and the zone resolved from the
 * site postcode, and lets the booker click a rate straight into the job costs.
 * Also surfaces the pricing used on the last job for this customer/site so an
 * exchange can be priced identically.
 */
export function JobPricingPicker({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const { cards } = useRateCards();
  const [cardId, setCardId] = useState<string>("");
  const [zoneCode, setZoneCode] = useState<string>("");
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const [zoneArea, setZoneArea] = useState<string | null>(null);
  const [prev, setPrev] = useState<PrevPrice | null>(null);
  const [prevLoading, setPrevLoading] = useState(false);
  const [userPickedCard, setUserPickedCard] = useState(false);

  const customer = (form.customer_name || "").trim();
  const postcode = (form.site_postcode || "").trim();
  const site = (form.site_name || "").trim();

  /* Only cards whose effective window covers today. */
  const currentCards = useMemo(() => {
    const windows = computeCardWindows(cards);
    return cards.filter((c) => c.is_active && windows.get(c.id)?.state === "current");
  }, [cards]);

  /* Auto-pick a bespoke card when the customer has one, otherwise leave the
     booker to choose the tier. */
  useEffect(() => {
    if (userPickedCard || !customer || !currentCards.length) return;
    const lc = customer.toLowerCase();
    const bespoke = currentCards.find(
      (c) => c.customer_type === "bespoke" && c.name.toLowerCase().startsWith(lc.slice(0, Math.min(lc.length, 12))),
    );
    if (bespoke) setCardId(bespoke.id);
  }, [customer, currentCards, userPickedCard]);

  const card: RateCard | null = currentCards.find((c) => c.id === cardId) || null;
  const { zones, rows, values } = useRateCardData(cardId || null);

  /* Postcode → zone. */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const q = postcode.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
      if (q.length < 2) { setDetectedZone(null); setZoneArea(null); return; }
      const outward = q.split(" ")[0];
      const { data } = await supabase
        .from("pricing_zone_postcodes")
        .select("postcode_prefix, zone_code, area")
        .or(`postcode_prefix.ilike.${q}%,postcode_prefix.ilike.${outward}%`)
        .order("postcode_prefix")
        .limit(5);
      if (cancelled) return;
      const hit = (data || [])[0] as any;
      setDetectedZone(hit ? POSTCODE_ZONE_TO_CODE[hit.zone_code] ?? null : null);
      setZoneArea(hit?.area ?? null);
    };
    run();
    return () => { cancelled = true; };
  }, [postcode]);

  const matrixZones = useMemo(() => zones.filter((z) => z.zone_code !== FLAT_ZONE), [zones]);

  /* Default the zone to the detected one (or the first) whenever the card changes. */
  useEffect(() => {
    if (!matrixZones.length) { setZoneCode(""); return; }
    setZoneCode((prevCode) => {
      if (prevCode && matrixZones.some((z) => z.zone_code === prevCode)) return prevCode;
      if (detectedZone && matrixZones.some((z) => z.zone_code === detectedZone)) return detectedZone;
      return matrixZones[0].zone_code;
    });
  }, [matrixZones, detectedZone]);

  /* Follow the postcode when it resolves to a zone this card has. */
  useEffect(() => {
    if (detectedZone && matrixZones.some((z) => z.zone_code === detectedZone)) setZoneCode(detectedZone);
  }, [detectedZone, matrixZones]);

  const selectedZone = zones.find((z) => z.zone_code === zoneCode) || null;
  const flatZone = zones.find((z) => z.zone_code === FLAT_ZONE) || null;

  const valueFor = (rowId: string, zoneId: string | undefined) =>
    zoneId ? values.find((v) => v.row_id === rowId && v.zone_id === zoneId) : undefined;

  /** Priceable haulage/container rows for the selected zone, grouped by section. */
  const zoneSections = useMemo(() => {
    if (!selectedZone) return [] as { section: string; items: { id: string; label: string; price: number }[] }[];
    const groups = new Map<string, { id: string; label: string; price: number }[]>();
    for (const r of rows) {
      if (r.section === TONNAGE_SECTION) continue;
      const v = valueFor(r.id, selectedZone.id);
      if (!v || v.status !== "price" || v.price == null) continue;
      const sec = r.section || "Other";
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec)!.push({ id: r.id, label: r.label, price: Number(v.price) });
    }
    return [...groups.entries()].map(([section, items]) => ({ section, items }));
  }, [rows, values, selectedZone]);

  /** Per-tonne material rates (FLAT zone). */
  const tonnageRates = useMemo(() => {
    if (!flatZone) return [] as { id: string; label: string; price: number }[];
    return rows
      .filter((r) => r.section === TONNAGE_SECTION)
      .map((r) => {
        const v = valueFor(r.id, flatZone.id);
        return v && v.status === "price" && v.price != null
          ? { id: r.id, label: r.label, price: Number(v.price) }
          : null;
      })
      .filter(Boolean) as { id: string; label: string; price: number }[];
  }, [rows, values, flatZone]);

  /* Pricing used on the last comparable job (same customer, same site). */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!customer) { setPrev(null); return; }
      setPrevLoading(true);
      let q = supabase
        .from("route_one_jobs")
        .select("job_number, scheduled_date, container_type, haulage_cost, charge_per_tonne, min_weight_charge, weight_included_t, vat_rate, cost_items")
        .ilike("customer_name", `%${customer}%`)
        .not("haulage_cost", "is", null)
        .order("scheduled_date", { ascending: false })
        .limit(1);
      if (site) q = q.ilike("site_name", site);
      const { data } = await q;
      if (cancelled) return;
      setPrev(((data || [])[0] as PrevPrice) ?? null);
      setPrevLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [customer, site]);

  const applyHaulage = (label: string, price: number) => {
    setForm({
      ...form,
      haulage_cost: price,
      vat_rate: card?.vat_inclusive ? 0 : form.vat_rate ?? 20,
      notes: `${form.notes ? form.notes + "\n" : ""}Priced from ${card?.name}: ${label}${selectedZone ? ` (${selectedZone.zone_name || selectedZone.zone_code})` : ""} @ ${money(price)}`.trim(),
    });
  };

  const applyTonnage = (label: string, price: number) => {
    setForm({ ...form, charge_per_tonne: price, waste_type: form.waste_type || label });
  };

  const applyPrevPricing = () => {
    if (!prev) return;
    setForm({
      ...form,
      haulage_cost: prev.haulage_cost ?? form.haulage_cost,
      charge_per_tonne: prev.charge_per_tonne ?? form.charge_per_tonne,
      min_weight_charge: prev.min_weight_charge ?? form.min_weight_charge,
      weight_included_t: prev.weight_included_t ?? form.weight_included_t,
      vat_rate: prev.vat_rate ?? form.vat_rate ?? 20,
      cost_items: Array.isArray(prev.cost_items) ? prev.cost_items : form.cost_items,
    });
  };

  const grouped = useMemo(() => {
    const byType = new Map<RateCard["customer_type"], RateCard[]>();
    for (const c of currentCards) {
      if (!byType.has(c.customer_type)) byType.set(c.customer_type, []);
      byType.get(c.customer_type)!.push(c);
    }
    return byType;
  }, [currentCards]);

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Tags className="h-3.5 w-3.5" /> Pricing
        </h4>
        {prevLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : prev ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={applyPrevPricing}>
            <History className="h-3.5 w-3.5" />
            Use last price{prev.haulage_cost != null ? ` — ${money(Number(prev.haulage_cost))}` : ""}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Customer type / rate card</Label>
          <Select
            value={cardId}
            onValueChange={(v) => { setUserPickedCard(true); setCardId(v); }}
          >
            <SelectTrigger><SelectValue placeholder="Select pricing tier..." /></SelectTrigger>
            <SelectContent className="max-h-72">
              {[...grouped.entries()].map(([type, list]) => (
                <div key={type}>
                  <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {CUSTOMER_TYPE_LABELS[type]}
                  </div>
                  {list.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> Zone
            {detectedZone && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {postcode.toUpperCase()} → {detectedZone}{zoneArea ? ` · ${zoneArea}` : ""}
              </Badge>
            )}
          </Label>
          <Select value={zoneCode} onValueChange={setZoneCode} disabled={!matrixZones.length}>
            <SelectTrigger>
              <SelectValue placeholder={cardId ? "Select zone" : "Pick a rate card first"} />
            </SelectTrigger>
            <SelectContent>
              {matrixZones.map((z) => (
                <SelectItem key={z.id} value={z.zone_code}>{z.zone_name || z.zone_code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cardId && !detectedZone && postcode.length >= 2 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              No zone found for this postcode — likely a phone-for-quote area.
            </p>
          )}
        </div>
      </div>

      {cardId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-md border border-border max-h-64 overflow-y-auto">
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50 sticky top-0">
              Haulage & container rates {card?.vat_inclusive ? "(inc VAT)" : "(ex VAT)"}
            </div>
            {zoneSections.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No priced rows for this zone.</p>
            ) : (
              zoneSections.map((g) => (
                <div key={g.section}>
                  <div className="px-2 py-1 text-[11px] text-muted-foreground bg-muted/20">{g.section}</div>
                  {g.items.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => applyHaulage(it.label, it.price)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs hover:bg-accent text-left"
                    >
                      <span className="truncate">{it.label}</span>
                      <span className="font-medium shrink-0">{money(it.price)}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="rounded-md border border-border max-h-64 overflow-y-auto">
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50 sticky top-0">
              Per-tonne material rates
            </div>
            {tonnageRates.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No tonnage rates on this card.</p>
            ) : (
              tonnageRates.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => applyTonnage(it.label, it.price)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs hover:bg-accent text-left"
                >
                  <span className="truncate">{it.label}</span>
                  <span className="font-medium shrink-0">{money(it.price)}/t</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
