import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Sparkles, Fuel, AlertTriangle, Copy, Check } from "lucide-react";
import { useRateCards, useRateCardData, type RateCard, type RateValue } from "@/components/pricing/useRateCard";
import { usePostcodeZones } from "@/hooks/usePostcodeZones";
import type { FuelSurchargeRate, PostcodeZoneRow } from "@/lib/fuel-surcharge";
import { useLiveJobsSettings } from "@/hooks/useLiveJobsSettings";

/* ── Email parsing ────────────────────────────────────────────────── */

type ParsedEmail = {
  postcode: string | null;
  sizeYd: number | null;
  isRoRo: boolean;
  enclosed: boolean;
  waste: "general" | "plasterboard" | "wood" | "inert";
  broker: "papilo" | "reconomy" | null;
  residential: boolean;
};

function parseEmail(text: string): ParsedEmail {
  // Strip signature / disclaimer / footer so keywords there (e.g. "RORO" in a
  // surcharge notice) don't drive the detection.
  const body = text.split(/kind regards|best regards|regards,|many thanks|confidentiality notice|sign into our|customer portal at/i)[0] ?? text;
  // Normalise dash-separated postcodes like "CV22 – 7DH" / "CV22-7DH".
  const norm = body.replace(/[‐‑‒–—]/g, " ");
  const t = norm.toLowerCase();
  const pcMatch = norm.toUpperCase().match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/);
  const sizeMatch = t.match(/(\d{1,2})\s*(?:yd|yard|yrd)\b/);
  // Only a RoRo when the word sits near a size, or the size itself is 20yd+
  const roroNearSize =
    /(\d{1,2})\s*(?:yd|yard|yrd)[^.\n]{0,40}(roro|ro-ro|ro ro|roll.?on.?roll.?off)/.test(t) ||
    /(roro|ro-ro|ro ro|roll.?on.?roll.?off)[^.\n]{0,40}(\d{1,2})\s*(?:yd|yard|yrd)/.test(t);
  const isRoRo = roroNearSize || (sizeMatch ? Number(sizeMatch[1]) >= 20 : false);
  const enclosed = /enclosed|lockable|covered skip/.test(t);
  let waste: ParsedEmail["waste"] = "general";
  if (/plasterboard|gypsum/.test(t)) waste = "plasterboard";
  else if (/hardcore|inert|soil|rubble|brick|concrete|muck/.test(t)) waste = "inert";
  else if (/\bwood\b|\bgreen\b|garden|timber/.test(t)) waste = "wood";
  let broker: ParsedEmail["broker"] = null;
  if (/papilo|allwood|project waste|kenny/.test(t)) broker = "papilo";
  else if (/reconomy|biffa|go green|suez|select a skip/.test(t)) broker = "reconomy";
  const residential = !broker && /driveway|my house|home|domestic|garden clearance/.test(t);
  return {
    postcode: pcMatch ? `${pcMatch[1]} ${pcMatch[2]}` : null,
    sizeYd: sizeMatch ? Number(sizeMatch[1]) : null,
    isRoRo,
    enclosed,
    waste,
    broker,
    residential,
  };
}

/* ── Card / row selection ─────────────────────────────────────────── */

function pickCard(cards: RateCard[], p: ParsedEmail): RateCard | null {
  const current = cards.filter((c) => c.is_active);
  // Match the start of the card name only — a loose "includes" match picks the
  // wrong card (e.g. "trade rates" also matches "Papilo … — Trade Rates 2026",
  // and "reconomy" matches "Allen Ford (UK) Ltd (Reconomy) — Bespoke Rates").
  const byName = (frag: string) => current.find((c) => c.name.toLowerCase().startsWith(frag));
  if (p.broker === "papilo") return byName("papilo") ?? null;
  if (p.broker === "reconomy") return byName("reconomy") ?? null;
  if (p.residential) return current.find((c) => c.customer_type === "residential") ?? byName("trade rates") ?? null;
  return byName("trade rates") ?? current.find((c) => c.customer_type === "trade") ?? null;
}

type RowChoice = { sectionMatch: string; labelMatch: RegExp; vehicle: "Skips" | "RoRo" };

function pickRow(p: ParsedEmail): RowChoice {
  if (p.isRoRo) {
    if (p.waste === "inert")
      return { sectionMatch: "RoRo — Inert", labelMatch: /hardcore/i, vehicle: "RoRo" };
    return { sectionMatch: "RoRo — General Waste", labelMatch: /inc 2/i, vehicle: "RoRo" };
  }
  const size = p.sizeYd ?? 8;
  const sizeRe =
    size <= 8 ? /8 YD open/i : size <= 12 ? (p.enclosed ? /12 YD enclosed/i : /12 YD open/i) : /14 \/ 16 YD open/i;
  if (p.waste === "plasterboard")
    return { sectionMatch: "Plasterboard", labelMatch: size <= 8 ? /8 YD open/i : p.enclosed ? /12 YD enclosed/i : /12 \/ 14 \/ 16 YD open/i, vehicle: "Skips" };
  if (p.waste === "wood") return { sectionMatch: "Wood / Green", labelMatch: sizeRe, vehicle: "Skips" };
  if (p.waste === "inert") return { sectionMatch: "Mixed Inert", labelMatch: /6 YD inc 6T/i, vehicle: "Skips" };
  return { sectionMatch: "General Waste", labelMatch: sizeRe, vehicle: "Skips" };
}

function zoneCodeForName(zoneName: string | null): string {
  if (!zoneName) return "Z3";
  if (/^zone\s*1/i.test(zoneName)) return "Z1";
  if (/^zone\s*2/i.test(zoneName)) return "Z2";
  if (/^zone\s*3\s*roro/i.test(zoneName)) return "Z3R";
  if (/^zone\s*4\s*roro/i.test(zoneName)) return "Z4R";
  return "Z3";
}

function matchPostcodeZone(postcode: string | null, zones: PostcodeZoneRow[]): string | null {
  if (!postcode) return null;
  const pc = postcode.toUpperCase().replace(/\s+/g, " ").trim();
  const variants = new Set<string>([pc, pc.replace(/\s+/g, "")]);
  const m = pc.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d)/);
  if (m) variants.add(`${m[1]} ${m[2]}`);
  const outward = pc.split(" ")[0];
  if (outward) variants.add(outward);
  for (const z of zones) {
    const setU = new Set(z.postcodes.map((x) => x.toUpperCase().trim()));
    for (const v of variants) if (setU.has(v) || setU.has(v.replace(/\s+/g, ""))) return z.zone_name;
  }
  return null;
}

/* ── Component ────────────────────────────────────────────────────── */

export function EmailPriceLookup() {
  const { cards } = useRateCards();
  const { zones: postcodeZones } = usePostcodeZones();
  const [emailText, setEmailText] = useState("");
  const [parsed, setParsed] = useState<ParsedEmail | null>(null);
  const [cardId, setCardId] = useState("");
  const [rowKey, setRowKey] = useState("");
  const [zoneCode, setZoneCode] = useState("");
  const [surchargeRates, setSurchargeRates] = useState<FuelSurchargeRate[]>([]);

  useEffect(() => {
    supabase
      .from("fuel_surcharge_rates")
      .select("id, effective_from_date, vehicle_category, zone, surcharge_amount, active, customer_match")
      .eq("active", true)
      .then(({ data }) => setSurchargeRates((data as FuelSurchargeRate[]) || []));
  }, []);

  const card = cards.find((c) => c.id === cardId) ?? null;
  const { zones, rows, values } = useRateCardData(cardId || null);

  const analyse = () => {
    const p = parseEmail(emailText);
    setParsed(p);
    const c = pickCard(cards, p);
    setCardId(c?.id ?? "");
    const zoneName = matchPostcodeZone(p.postcode, postcodeZones as PostcodeZoneRow[]);
    setZoneCode(zoneCodeForName(zoneName));
    setRowKey(""); // re-picked once card data loads
  };

  // pick the row once card rows are loaded — only match rows belonging to the
  // currently selected card, otherwise a stale previous card's rows can win
  useEffect(() => {
    if (!parsed || !rows.length || rowKey || !cardId) return;
    if (rows[0]?.card_id !== cardId) return;
    const choice = pickRow(parsed);
    const row = rows.find(
      (r) => (r.section ?? "").includes(choice.sectionMatch) && choice.labelMatch.test(r.label)
    );
    if (row) setRowKey(row.id);
  }, [parsed, rows, rowKey, cardId]);

  const selectedRow = rows.find((r) => r.id === rowKey) ?? null;
  const value: RateValue | null = useMemo(() => {
    if (!selectedRow || !zoneCode) return null;
    const zone = zones.find((z) => z.zone_code === zoneCode);
    if (!zone) return null;
    const direct = values.find((v) => v.row_id === selectedRow.id && v.zone_id === zone.id);
    if (direct) return direct;
    // RoRo-only zones fall back to Zone 3 pricing
    if (zoneCode === "Z3R" || zoneCode === "Z4R") {
      const z3 = zones.find((z) => z.zone_code === "Z3");
      return values.find((v) => v.row_id === selectedRow.id && v.zone_id === z3?.id) ?? null;
    }
    return null;
  }, [selectedRow, zoneCode, zones, values]);

  const vehicle: "Skips" | "RoRo" = parsed?.isRoRo ? "RoRo" : "Skips";
  const surcharge = useMemo(() => {
    if (!value || value.status !== "price") return null;
    const zoneName = zoneCode === "Z1" ? "Zone 1" : zoneCode === "Z2" ? "Zone 2" : "Zone 3";
    const today = new Date().toISOString().slice(0, 10);
    const custText = emailText.toLowerCase();
    const override = surchargeRates
      .filter((r) => r.customer_match && r.vehicle_category === vehicle && r.effective_from_date <= today && custText.includes(r.customer_match.toLowerCase()))
      .sort((a, b) => (a.effective_from_date < b.effective_from_date ? 1 : -1))[0];
    if (override) return override;
    return (
      surchargeRates
        .filter((r) => !r.customer_match && r.vehicle_category === vehicle && r.zone === zoneName && r.effective_from_date <= today)
        .sort((a, b) => (a.effective_from_date < b.effective_from_date ? 1 : -1))[0] ?? null
    );
  }, [value, zoneCode, surchargeRates, vehicle, emailText]);

  // Per-tonne disposal rate for the detected waste type (FLAT zone, "Tonnage & Material Rates")
  const TONNAGE_LABEL: Record<ParsedEmail["waste"], RegExp> = {
    general: /^general waste$/i,
    plasterboard: /^plasterboard$/i,
    wood: /grade a wood/i,
    inert: /mixed inert/i,
  };
  const perTonne = useMemo(() => {
    if (!parsed) return null;
    // General waste skips include disposal in the lift price — no per-tonne charge
    if (parsed.waste === "general" && !parsed.isRoRo) return null;
    const flatZone = zones.find((z) => z.zone_code === "FLAT");
    if (!flatZone) return null;
    const row = rows.find(
      (r) => (r.section ?? "").includes("Tonnage") && TONNAGE_LABEL[parsed.waste].test(r.label)
    );
    if (!row) return null;
    const v = values.find((x) => x.row_id === row.id && x.zone_id === flatZone.id);
    return v?.status === "price" && v.price != null ? { label: row.label, price: Number(v.price) } : null;
  }, [parsed, zones, rows, values]);

  const net = value?.status === "price" ? Number(value.price) : null;
  const surchargeAmt = surcharge ? Number(surcharge.surcharge_amount) : 0;
  const totalNet = net != null ? net + surchargeAmt : null;
  const vat = totalNet != null && !card?.vat_inclusive ? totalNet * 0.2 : 0;
  const gross = totalNet != null ? totalNet + vat : null;
  const gbp = (n: number) => `£${n.toFixed(2)}`;

  // Tonnes included in the price — the matrix is colour-coordinated by zone:
  // RoRo general waste ("Inc 2 / Inc 3") includes 2t in Zone 2 and 3t in
  // Zone 3 / RoRo-only zones; per-tonne skip materials include the first tonne.
  const includedTonnes = useMemo(() => {
    if (!parsed) return 1;
    if (parsed.isRoRo && parsed.waste === "general") {
      if (zoneCode === "Z1") return 1;
      if (zoneCode === "Z2") return 2;
      return 3; // Z3 / Z3R / Z4R
    }
    return 1;
  }, [parsed, zoneCode]);
  const includedLabel = includedTonnes === 1 ? "the first tonne" : `the first ${includedTonnes} tonnes`;

  const { settings: rental } = useLiveJobsSettings();
  const rentalRate = (n: number) => (Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`);

  // Plain-text email reply draft
  const wasteLabel =
    parsed?.waste === "plasterboard" ? "plasterboard" : parsed?.waste === "wood" ? "wood/green waste" : parsed?.waste === "inert" ? "inert/hardcore" : "general waste";
  const serviceDesc = selectedRow
    ? `${selectedRow.label}${parsed?.postcode ? ` to ${parsed.postcode}` : ""}`
    : null;
  const emailDraft = useMemo(() => {
    if (!parsed || !selectedRow) return "";
    const lines: string[] = ["Good morning,", "", "Thank you for your enquiry."];
    if (value?.status === "call_for_quote") {
      lines.push("", `For ${serviceDesc} (${wasteLabel}), please give us a call on 01788 555111 and we'll put a price together for you.`);
    } else if (totalNet != null) {
      lines.push(
        "",
        `Price for ${serviceDesc} (${wasteLabel}):`,
        `  • ${selectedRow.label}: ${gbp(net!)} + VAT`,
        surcharge ? `  • Fuel surcharge: ${gbp(surchargeAmt)} + VAT` : null,
        perTonne
          ? `  • Price includes ${includedLabel} — disposal thereafter at ${gbp(perTonne.price)} per tonne + VAT`
          : null,
        parsed.waste === "general" && !parsed.isRoRo
          ? "  • Price includes disposal — strictly no soils, hardcore or plasterboard to be placed in the skip."
          : null,
        "",
        `Total: ${gbp(totalNet)} + VAT (${gbp(gross!)} inc. VAT)`,
      );
    }
    lines.push(
      "",
      "Please note the following charges which may apply. All quotes are subject to VAT.",
      `Containers kept beyond the ${rental.rental_free_days}-day free rental period are charged at ${rentalRate(rental.rental_skip_rate)} per week for a skip or ${rentalRate(rental.rental_roro_rate)} per week for a RoRo, plus VAT. Contamination charges may apply for non-acceptable materials.`,
      "",
      "Kind regards,",
      "Clews Recycling",
    );
    return lines.filter((l) => l !== null).join("\n");
  }, [parsed, selectedRow, value, totalNet, net, surcharge, surchargeAmt, perTonne, gross, serviceDesc, wasteLabel, rental, includedLabel]);

  const [copied, setCopied] = useState(false);
  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(emailDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Paste the customer email
          </CardTitle>
          <CardDescription>
            We detect the customer, postcode, container size and waste type, then price it from the right rate card with the fuel surcharge.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            placeholder={"e.g. Hi, can I get a price for an 8 yard skip for general waste to CV21 2AB please — thanks, Papilo"}
            className="min-h-[220px]"
          />
          <Button onClick={analyse} disabled={!emailText.trim()}>
            <Sparkles className="h-4 w-4 mr-1" /> Work out price
          </Button>
          {parsed && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="secondary">{parsed.postcode ?? "No postcode found"}</Badge>
              <Badge variant="secondary">{parsed.sizeYd ? `${parsed.sizeYd} yd` : "Size not found"}</Badge>
              <Badge variant="secondary">{parsed.isRoRo ? "RoRo" : parsed.enclosed ? "Enclosed skip" : "Skip"}</Badge>
              <Badge variant="secondary">
                {parsed.waste === "general" ? "General waste" : parsed.waste === "plasterboard" ? "Plasterboard" : parsed.waste === "wood" ? "Wood / Green" : "Inert / Hardcore"}
              </Badge>
              {parsed.broker && <Badge>{parsed.broker === "papilo" ? "Papilo group" : "Major broker"}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price</CardTitle>
          <CardDescription>Adjust any of these if the email read wrong — the price updates instantly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!parsed ? (
            <p className="text-sm text-muted-foreground">Paste an email and press “Work out price”.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Rate card</Label>
                  <Select value={cardId} onValueChange={(v) => { setCardId(v); setRowKey(""); }}>
                    <SelectTrigger><SelectValue placeholder="Pick card" /></SelectTrigger>
                    <SelectContent>
                      {cards.filter((c) => c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Service</Label>
                  <Select value={rowKey} onValueChange={setRowKey}>
                    <SelectTrigger><SelectValue placeholder="Pick service" /></SelectTrigger>
                    <SelectContent>
                      {rows.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {(r.section ?? "").replace(/^Skip Hire — |^RoRo — /, "")} — {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Zone</Label>
                  <Select value={zoneCode} onValueChange={setZoneCode}>
                    <SelectTrigger><SelectValue placeholder="Pick zone" /></SelectTrigger>
                    <SelectContent>
                      {zones.filter((z) => z.zone_code !== "FLAT").map((z) => (
                        <SelectItem key={z.id} value={z.zone_code}>{z.zone_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {value?.status === "call_for_quote" && (
                <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> This service is “Call for quote” on the selected card.
                </div>
              )}
              {value?.status === "text" && value.text_value && (
                <p className="text-sm font-medium">{value.text_value}</p>
              )}

              {totalNet != null && (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedRow?.label} ({zones.find((z) => z.zone_code === zoneCode)?.zone_name})
                    </span>
                    <span className="font-medium">{gbp(net!)}</span>
                  </div>
                  {perTonne && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Disposal after {includedLabel} — {perTonne.label}</span>
                      <span className="font-medium">{gbp(perTonne.price)}/t</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Fuel className="h-3.5 w-3.5" /> Fuel surcharge ({vehicle})
                    </span>
                    <span className="font-medium">{surcharge ? gbp(surchargeAmt) : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Total net</span>
                    <span className="font-semibold">{gbp(totalNet)}</span>
                  </div>
                  {!card?.vat_inclusive && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT (20%)</span>
                      <span className="font-medium">{gbp(vat)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total {card?.vat_inclusive ? "(card prices include VAT)" : "inc. VAT"}</span>
                    <span className="text-lg font-bold text-primary">{gbp(gross!)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">From: {card?.name}</p>
                </div>
              )}
              {value == null && selectedRow && (
                <p className="text-sm text-muted-foreground">No price on this card for that service and zone.</p>
              )}

              {emailDraft && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Email reply draft</Label>
                    <Button size="sm" variant="outline" onClick={copyDraft}>
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <Textarea
                    value={emailDraft}
                    readOnly
                    className="min-h-[260px] text-sm font-mono"
                    onFocus={(e) => e.target.select()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Edit the wording in your email client after pasting — nothing is sent from here.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
