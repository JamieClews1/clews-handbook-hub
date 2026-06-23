import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Copy, MapPin, Search, FileText } from "lucide-react";
import {
  CUSTOMER_TYPE_LABELS,
  FLAT_ZONE,
  useRateCardData,
  useRateCards,
  computeCardWindows,
  formatUkDate,
  type RateCard,
  type RateRow,
  type RateValue,
  type RateZone,
} from "./useRateCard";
import { usePricingSettings } from "@/hooks/usePricingSettings";

type CustomerType = RateCard["customer_type"];
const TYPE_ORDER: CustomerType[] = ["residential", "trade", "broker", "bespoke"];
const VAT_RATE = 0.2;

type FuelVehicle = "Skips" | "RoRo" | "Artic";

type FuelRate = {
  vehicle_category: string;
  zone: string;
  surcharge_amount: number;
  active: boolean;
  customer_match: string | null;
  effective_from_date: string;
};

type QuoteLine = {
  key: string;
  rowId: string;
  zoneId: string;
  label: string;
  zoneLabel: string;
  unit: string | null;
  unitPrice: number;
  qty: number;
};

/** Classify a rate-card line into a fuel-surcharge vehicle category from its label. */
function classifyFuelVehicle(label: string): FuelVehicle | null {
  const s = label.toLowerCase();
  if (/artic|curtain|walking floor|bulk ejector/.test(s)) return "Artic";
  if (/ro ?-?ro|roll on roll off/.test(s)) return "RoRo";
  if (/skip|yard|yd|chain lift/.test(s)) return "Skips";
  return null;
}

/** Map a quote zone label to a fuel-surcharge zone (Zone 1/2/3, 3+ collapse to Zone 3). */
function mapFuelZone(zoneLabel: string): string | null {
  const s = zoneLabel.toLowerCase();
  if (/zone\s*1/.test(s)) return "Zone 1";
  if (/zone\s*2/.test(s)) return "Zone 2";
  if (/zone\s*[34]/.test(s)) return "Zone 3";
  return null;
}

/** Find the applicable surcharge amount for a vehicle/zone, honouring customer overrides. */
function fuelSurchargeFor(
  rates: FuelRate[],
  vehicle: FuelVehicle,
  zone: string,
  customer: string,
): number | null {
  const cust = customer.toLowerCase();
  const byNewest = (a: FuelRate, b: FuelRate) =>
    a.effective_from_date < b.effective_from_date ? 1 : -1;

  if (cust) {
    const override = rates
      .filter(
        (r) =>
          r.active &&
          r.vehicle_category === vehicle &&
          r.customer_match &&
          cust.includes(r.customer_match.toLowerCase()),
      )
      .sort(byNewest)[0];
    if (override) return Number(override.surcharge_amount);
  }

  const generic = rates
    .filter(
      (r) =>
        r.active && !r.customer_match && r.vehicle_category === vehicle && r.zone === zone,
    )
    .sort(byNewest)[0];
  return generic ? Number(generic.surcharge_amount) : null;
}

export function QuoteBuilder() {
  const { toast } = useToast();
  const { cards, loading } = useRateCards();
  const { settings } = usePricingSettings();

  const [customerName, setCustomerName] = useState("");
  const [reference, setReference] = useState("");
  const [activeType, setActiveType] = useState<CustomerType>("residential");
  const [cardId, setCardId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [fuelRates, setFuelRates] = useState<FuelRate[]>([]);

  // Load active fuel surcharge rates (used when auto-add is enabled in Pricing settings)
  useEffect(() => {
    supabase
      .from("fuel_surcharge_rates")
      .select("vehicle_category, zone, surcharge_amount, active, customer_match, effective_from_date")
      .eq("active", true)
      .then(({ data }) => setFuelRates((data as FuelRate[]) || []));
  }, []);

  const cardsForType = useMemo(
    () => cards.filter((c) => c.customer_type === activeType),
    [cards, activeType],
  );

  const windows = useMemo(() => computeCardWindows(cards), [cards]);

  // default to the currently-effective card when type changes
  useEffect(() => {
    const current = cardsForType.find((c) => windows.get(c.id)?.state === "current");
    setCardId(current?.id || cardsForType[0]?.id || "");
    setZoneId("");
    setLines([]);
  }, [activeType, cardsForType, windows]);


  const selectedCard = cards.find((c) => c.id === cardId) || null;
  const { zones, rows, values, loading: cardLoading } = useRateCardData(cardId || null);

  const matrixZones = useMemo(() => zones.filter((z) => z.zone_code !== FLAT_ZONE), [zones]);
  const flatZone = useMemo(() => zones.find((z) => z.zone_code === FLAT_ZONE) || null, [zones]);

  // default zone when card loads
  useEffect(() => {
    setZoneId((prev) => (prev && zones.some((z) => z.id === prev) ? prev : matrixZones[0]?.id || ""));
  }, [zones, matrixZones]);

  const valueMap = useMemo(() => {
    const m = new Map<string, RateValue>();
    for (const v of values) m.set(`${v.row_id}:${v.zone_id}`, v);
    return m;
  }, [values]);

  const selectedZone = zones.find((z) => z.id === zoneId) || null;

  const addLine = (row: RateRow, zone: RateZone, value: RateValue) => {
    const key = `${row.id}:${zone.id}`;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          rowId: row.id,
          zoneId: zone.id,
          label: row.label,
          zoneLabel: zone.zone_name || zone.zone_code,
          unit: row.unit,
          unitPrice: value.price || 0,
          qty: 1,
        },
      ];
    });
  };

  const updateQty = (key: string, qty: number) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty) } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const vatInclusive = selectedCard?.vat_inclusive ?? false;
  const lineTotal = (l: QuoteLine) => l.unitPrice * l.qty;
  const grandLineSum = lines.reduce((s, l) => s + lineTotal(l), 0);

  const fuelEnabled = settings.auto_add_fuel_surcharge;

  // Per-line fuel surcharge (net of VAT) based on inferred vehicle category + zone.
  const fuelDetails = useMemo(() => {
    if (!fuelEnabled) return { total: 0, lines: [] as { key: string; amount: number }[] };
    const detail: { key: string; amount: number }[] = [];
    let total = 0;
    for (const l of lines) {
      const vehicle = classifyFuelVehicle(l.label);
      const zone = mapFuelZone(l.zoneLabel);
      if (!vehicle || !zone) continue;
      const rate = fuelSurchargeFor(fuelRates, vehicle, zone, customerName);
      if (rate == null) continue;
      const amount = rate * l.qty;
      detail.push({ key: l.key, amount });
      total += amount;
    }
    return { total, lines: detail };
  }, [fuelEnabled, lines, fuelRates, customerName]);

  // Work in net terms, then apply VAT once at the end so the fuel surcharge (net) blends in.
  const linesNet = vatInclusive ? grandLineSum / (1 + VAT_RATE) : grandLineSum;
  const fuelNet = fuelDetails.total;
  const subtotal = linesNet + fuelNet;
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  const fmt = (n: number) => `£${n.toFixed(2)}`;


  // priceable rows for the selected zone, grouped by section
  const matrixSections = useMemo(() => {
    if (!selectedZone || selectedZone.zone_code === FLAT_ZONE) return [];
    const order: string[] = [];
    const map = new Map<string, { row: RateRow; value: RateValue }[]>();
    for (const r of rows) {
      if (r.section === "Tonnage & Material Rates") continue;
      const v = valueMap.get(`${r.id}:${selectedZone.id}`);
      if (!v || v.status !== "price" || v.price == null) continue;
      const s = r.section || "Rates";
      if (!map.has(s)) {
        map.set(s, []);
        order.push(s);
      }
      map.get(s)!.push({ row: r, value: v });
    }
    return order.map((s) => ({ section: s, items: map.get(s)! }));
  }, [rows, valueMap, selectedZone]);

  const flatItems = useMemo(() => {
    if (!flatZone) return [];
    return rows
      .filter((r) => r.section === "Tonnage & Material Rates")
      .map((r) => ({ row: r, value: valueMap.get(`${r.id}:${flatZone.id}`) }))
      .filter((x): x is { row: RateRow; value: RateValue } => !!x.value && x.value.status === "price" && x.value.price != null);
  }, [rows, valueMap, flatZone]);

  const copyQuote = async () => {
    const lineText = lines
      .map((l) => `${l.qty} × ${l.label} (${l.zoneLabel}) @ ${fmt(l.unitPrice)} = ${fmt(lineTotal(l))}`)
      .join("\n");
    const text = [
      `QUOTE${reference ? ` — Ref ${reference}` : ""}`,
      customerName ? `Customer: ${customerName}` : "",
      selectedCard ? `Rate card: ${selectedCard.name}` : "",
      "",
      lineText,
      "",
      fuelEnabled && fuelNet > 0 ? `Fuel surcharge (net): ${fmt(fuelNet)}` : "",
      `Subtotal (net): ${fmt(subtotal)}`,
      `VAT (20%): ${fmt(vat)}`,
      `Total: ${fmt(total)}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Quote copied", description: "The quote has been copied to your clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not access the clipboard.", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading rate cards…</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] items-start">
      {/* LEFT: builder */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quote details</CardTitle>
            <CardDescription>Pick the customer type, rate card and delivery zone, then add items.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Customer name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. ACME Ltd" />
              </div>
              <div className="space-y-1.5">
                <Label>Quote reference (optional)</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Q-1024" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Customer type</Label>
                <Select value={activeType} onValueChange={(v) => setActiveType(v as CustomerType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CUSTOMER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rate card</Label>
                <Select value={cardId} onValueChange={setCardId} disabled={!cardsForType.length}>
                  <SelectTrigger>
                    <SelectValue placeholder={cardsForType.length ? "Select card" : "No cards"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cardsForType.map((c) => {
                      const w = windows.get(c.id);
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {w?.state === "future" ? " · upcoming" : w?.state === "past" ? " · expired" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Zone / area</Label>
                <Select value={zoneId} onValueChange={setZoneId} disabled={!matrixZones.length}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {matrixZones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.zone_name || z.zone_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <PostcodeResolver
              matrixZones={matrixZones}
              onResolved={(zid) => zid && setZoneId(zid)}
            />

            {selectedCard && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{vatInclusive ? "Prices inc. VAT" : "Prices net of VAT"}</Badge>
                {selectedCard.effective_date && <span>Effective {selectedCard.effective_date}</span>}
              </div>
            )}
          </CardContent>
        </Card>

        {cardLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading rate card…</div>
        ) : !selectedCard ? (
          <div className="p-8 text-center text-muted-foreground">Select a rate card to start building a quote.</div>
        ) : (
          <div className="space-y-6">
            {matrixSections.map(({ section, items }) => (
              <Card key={section}>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b">
                    <h3 className="font-semibold text-sm">{section}</h3>
                  </div>
                  <ItemTable
                    items={items}
                    zone={selectedZone!}
                    onAdd={addLine}
                    fmt={fmt}
                  />
                </CardContent>
              </Card>
            ))}

            {flatZone && flatItems.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b">
                    <h3 className="font-semibold text-sm">Tonnage & Material Rates</h3>
                  </div>
                  <ItemTable items={flatItems} zone={flatZone} onAdd={addLine} fmt={fmt} />
                </CardContent>
              </Card>
            )}

            {!matrixSections.length && !flatItems.length && (
              <div className="p-8 text-center text-muted-foreground">
                No priced items available for this zone. Try another zone or rate card.
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: quote summary */}
      <Card className="lg:sticky lg:top-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Quote
          </CardTitle>
          {customerName && <CardDescription>{customerName}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items added yet. Click “Add” on any priced item.</p>
          ) : (
            <div className="space-y-3">
              {lines.map((l) => (
                <div key={l.key} className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm">
                      <div className="font-medium">{l.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.zoneLabel} · {fmt(l.unitPrice)}
                        {l.unit ? ` / ${l.unit}` : ""}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeLine(l.key)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => updateQty(l.key, parseInt(e.target.value) || 1)}
                      className="h-8 w-20 text-xs"
                    />
                    <span className="text-sm font-semibold">{fmt(lineTotal(l))}</span>
                  </div>
                </div>
              ))}

              <Separator />

              <div className="space-y-1 text-sm">
                {fuelEnabled && fuelNet > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fuel surcharge (net)</span>
                    <span>{fmt(fuelNet)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal (net)</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT (20%)</span>
                  <span>{fmt(vat)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-1">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>

              <Button className="w-full" onClick={copyQuote}>
                <Copy className="h-4 w-4 mr-1" /> Copy quote
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemTable({
  items,
  zone,
  onAdd,
  fmt,
}: {
  items: { row: RateRow; value: RateValue }[];
  zone: RateZone;
  onAdd: (row: RateRow, zone: RateZone, value: RateValue) => void;
  fmt: (n: number) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Item</TableHead>
            <TableHead className="w-32 text-right">Price</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(({ row, value }) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium align-top">
                {row.label}
                {row.unit && <span className="text-xs text-muted-foreground ml-2">({row.unit})</span>}
                {row.note && <p className="text-xs text-muted-foreground font-normal mt-0.5">{row.note}</p>}
              </TableCell>
              <TableCell className="text-right font-semibold">{fmt(value.price || 0)}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => onAdd(row, zone, value)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const ZONE_CODE_MAP: Record<string, string> = {
  "Zone 1": "Z1",
  "Zone 2": "Z2",
  "Zone 3": "Z3",
  "Zone 3 RoRo Only": "Z3R",
  "Zone 4 RoRo Only": "Z4R",
};

function PostcodeResolver({
  matrixZones,
  onResolved,
}: {
  matrixZones: RateZone[];
  onResolved: (zoneId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const q = query.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ");
    if (!q) return;
    setSearching(true);
    const outward = q.split(" ")[0];
    const { data } = await supabase
      .from("pricing_zone_postcodes")
      .select("postcode_prefix,zone_code,area")
      .or(`postcode_prefix.ilike.${q}%,postcode_prefix.ilike.${outward}%`)
      .order("postcode_prefix")
      .limit(1);
    setSearching(false);
    const match = (data || [])[0];
    if (!match) {
      setResult("No zone found — likely a phone-for-quote area.");
      return;
    }
    const code = ZONE_CODE_MAP[match.zone_code] ?? match.zone_code;
    const zone = matrixZones.find((z) => z.zone_code === code);
    if (zone) {
      onResolved(zone.id);
      setResult(`${match.zone_code} → applied (${match.area || match.postcode_prefix})`);
    } else {
      setResult(`Matched ${match.zone_code}, but this card has no matching zone.`);
    }
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <Label className="flex items-center gap-1.5 text-xs">
        <MapPin className="h-3.5 w-3.5" /> Resolve zone from postcode
      </Label>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="e.g. CV21 3 or LE17"
          className="max-w-xs h-9"
        />
        <Button size="sm" onClick={search} disabled={searching} className="h-9">
          <Search className="h-3.5 w-3.5 mr-1" /> Check
        </Button>
      </div>
      {result && <p className="text-xs text-muted-foreground">{result}</p>}
    </div>
  );
}
