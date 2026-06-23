import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminPageLayout } from "@/components/AdminPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Copy, LayoutGrid, Calculator, Settings2 } from "lucide-react";
import { RateCardEditor } from "@/components/pricing/RateCardEditor";
import { PostcodeZoneChecker } from "@/components/pricing/PostcodeZoneChecker";
import { QuoteBuilder } from "@/components/pricing/QuoteBuilder";
import { PricingSettings } from "@/components/pricing/PricingSettings";
import {
  CUSTOMER_TYPE_LABELS,
  useRateCards,
  computeCardWindows,
  duplicateRateCard,
  formatUkDate,
  nextAprilYear,
  type RateCard,
  type CardWindow,
} from "@/components/pricing/useRateCard";

type CustomerType = RateCard["customer_type"];
const TYPE_ORDER: CustomerType[] = ["residential", "trade", "broker", "bespoke"];

type CustomerOption = { id: string; customer_name: string };

const PricingPage = () => {
  const { toast } = useToast();
  const { cards, loading, refresh } = useRateCards();
  const [activeType, setActiveType] = useState<CustomerType>("residential");
  const [selectedCardId, setSelectedCardId] = useState<Record<CustomerType, string>>({
    residential: "",
    trade: "",
    broker: "",
    bespoke: "",
  });
  const [highlightZone, setHighlightZone] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    supabase
      .from("customers")
      .select("id,customer_name")
      .order("customer_name")
      .then(({ data }) => setCustomers((data as CustomerOption[]) || []));
  }, []);

  const cardsByType = useMemo(() => {
    const m: Record<CustomerType, RateCard[]> = {
      residential: [],
      trade: [],
      broker: [],
      bespoke: [],
    };
    for (const c of cards) m[c.customer_type].push(c);
    return m;
  }, [cards]);

  const windows = useMemo(() => computeCardWindows(cards), [cards]);

  // pick a sensible default per type — prefer the currently-effective card
  const pickDefault = (list: RateCard[]) =>
    list.find((c) => windows.get(c.id)?.state === "current")?.id || list[0]?.id || "";

  // ensure a default selected card per type
  useEffect(() => {
    setSelectedCardId((prev) => {
      const next = { ...prev };
      for (const t of TYPE_ORDER) {
        if (!next[t] && cardsByType[t][0]) next[t] = pickDefault(cardsByType[t]);
        if (next[t] && !cardsByType[t].some((c) => c.id === next[t])) next[t] = pickDefault(cardsByType[t]);
      }
      return next;
    });
  }, [cardsByType, windows]);


  if (loading) {
    return (
      <AdminPageLayout title="Pricing">
        <div className="p-8 text-center text-muted-foreground">Loading rate cards…</div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title="Pricing"
      description="Manage rate cards and build customer quotes. All figures are exclusive of VAT unless a card states otherwise."
    >
      <Tabs defaultValue="rate-cards">
        <TabsList className="mb-6">
          <TabsTrigger value="rate-cards">
            <LayoutGrid className="h-4 w-4 mr-2" /> Rate Cards
          </TabsTrigger>
          <TabsTrigger value="builder">
            <Calculator className="h-4 w-4 mr-2" /> Price Builder
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="h-4 w-4 mr-2" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rate-cards" className="space-y-6">
          <PostcodeZoneChecker onZoneResolved={setHighlightZone} />

          <Tabs value={activeType} onValueChange={(v) => setActiveType(v as CustomerType)}>
            <TabsList>
              {TYPE_ORDER.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {CUSTOMER_TYPE_LABELS[t]}
                  <Badge variant="secondary" className="ml-2">
                    {cardsByType[t].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {TYPE_ORDER.map((t) => (
              <TabsContent key={t} value={t} className="mt-4 space-y-4">
                <TypePanel
                  type={t}
                  cards={cardsByType[t]}
                  windows={windows}
                  templates={cards.filter((c) => c.customer_type === "trade" || c.customer_type === "broker")}
                  customers={customers}
                  selectedCardId={selectedCardId[t]}
                  onSelectCard={(id) => setSelectedCardId((p) => ({ ...p, [t]: id }))}
                  highlightZone={highlightZone}
                  onChanged={refresh}
                  toast={toast}
                />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        <TabsContent value="builder">
          <QuoteBuilder />
        </TabsContent>

        <TabsContent value="settings">
          <PricingSettings />
        </TabsContent>
      </Tabs>
    </AdminPageLayout>
  );
};

function TypePanel({
  type,
  cards,
  windows,
  templates,
  customers,
  selectedCardId,
  onSelectCard,
  highlightZone,
  onChanged,
  toast,
}: {
  type: CustomerType;
  cards: RateCard[];
  windows: Map<string, CardWindow>;
  templates: RateCard[];
  customers: CustomerOption[];
  selectedCardId: string;
  onSelectCard: (id: string) => void;
  highlightZone: string | null;
  onChanged: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const selected = cards.find((c) => c.id === selectedCardId);
  const selectedWindow = selected ? windows.get(selected.id) : undefined;

  const windowLabel = (w?: CardWindow) => {
    if (!w || !w.start) return "";
    return `${formatUkDate(w.start)} – ${formatUkDate(w.end)}`;
  };
  const stateBadge = (w?: CardWindow) => {
    if (!w) return null;
    if (w.state === "current")
      return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Current</Badge>;
    if (w.state === "future") return <Badge variant="secondary">Upcoming</Badge>;
    return <Badge variant="outline">Expired</Badge>;
  };

  if (!cards.length && type !== "bespoke") {
    return <div className="p-8 text-center text-muted-foreground">No {CUSTOMER_TYPE_LABELS[type]} card yet.</div>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {cards.length > 0 && (
          <Select value={selectedCardId} onValueChange={onSelectCard}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Select a rate card" />
            </SelectTrigger>
            <SelectContent>
              {cards.map((c) => {
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
        )}
        {type === "bespoke" && (
          <NewBespokeDialog templates={templates} customers={customers} onCreated={onChanged} toast={toast} />
        )}
        {selected && (
          <NextYearCardDialog source={selected} cards={cards} windows={windows} onCreated={onChanged} toast={toast} />
        )}
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {stateBadge(selectedWindow)}
          {selected.vat_inclusive ? (
            <Badge variant="outline">Inc. VAT</Badge>
          ) : (
            <Badge variant="outline">Net of VAT</Badge>
          )}
          {selectedWindow?.start && (
            <span className="text-muted-foreground">
              {selectedWindow.state === "future" ? "Effective from " : "Prices effective "}
              <span className="font-medium text-foreground">{windowLabel(selectedWindow)}</span>
              {selectedWindow.state === "future" && " (takes over automatically)"}
            </span>
          )}
        </div>
      )}

      {selected?.notes && (
        <Card>
          <CardContent className="py-3 text-sm text-muted-foreground">{selected.notes}</CardContent>
        </Card>
      )}

      {selected ? (
        <RateCardEditor cardId={selected.id} highlightZoneCode={highlightZone} />
      ) : type === "bespoke" ? (
        <div className="p-8 text-center text-muted-foreground">
          No bespoke cards yet. Create one for a customer using the button above.
        </div>
      ) : null}
    </>
  );
}

function NextYearCardDialog({
  source,
  cards,
  windows,
  onCreated,
  toast,
}: {
  source: RateCard;
  cards: RateCard[];
  windows: Map<string, CardWindow>;
  onCreated: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const year = nextAprilYear(source.effective_date);
  const effective = `${year}-04-01`;
  const defaultName = /\b(20\d{2})\b/.test(source.name)
    ? source.name.replace(/\b20\d{2}\b/, String(year))
    : `${source.name} ${year}`;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  // does a card already cover the target effective date for this group?
  const exists = cards.some((c) => c.id !== source.id && c.effective_date === effective);

  const create = async () => {
    setSaving(true);
    const result = await duplicateRateCard(source.id, {
      customer_type: source.customer_type,
      name: name.trim() || defaultName,
      customer_id: source.customer_id,
      vat_inclusive: source.vat_inclusive,
      effective_date: effective,
      notes: source.notes,
    });
    setSaving(false);
    if ("error" in result) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
      return;
    }
    toast({
      title: `${year} rate card created`,
      description: `A copy effective 1 April ${year} was created. Edit it now — it will take over automatically on that date.`,
    });
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Copy className="h-4 w-4 mr-1" /> Create {year} card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {year} rate card</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This copies <span className="font-medium text-foreground">{source.name}</span> into a new card
            effective <span className="font-medium text-foreground">1 April {year}</span>. The new prices
            take over automatically on that date, and the current card will then read as valid to{" "}
            <span className="font-medium text-foreground">31 March {year}</span>. Edit the copy without
            affecting the prices in use today.
          </p>
          {exists && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              A card effective 1 April {year} already exists. Creating another will result in duplicates.
            </div>
          )}
          <div className="space-y-1.5">
            <Label>New card name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : `Create ${year} card`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function NewBespokeDialog({
  templates,
  customers,
  onCreated,
  toast,
}: {
  templates: RateCard[];
  customers: CustomerOption[];
  onCreated: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!customerId || !templateId) {
      toast({ title: "Missing info", description: "Pick a customer and a template.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const customer = customers.find((c) => c.id === customerId);
    const cardName = name.trim() || `${customer?.customer_name || "Bespoke"} — Bespoke Rates`;

    // 1. create card
    const { data: newCard, error: cErr } = await supabase
      .from("pricing_rate_cards")
      .insert({ customer_type: "bespoke", name: cardName, customer_id: customerId, vat_inclusive: false })
      .select()
      .single();
    if (cErr || !newCard) {
      toast({ title: "Error", description: cErr?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // 2. clone zones
    const { data: zones } = await supabase.from("pricing_rate_card_zones").select("*").eq("card_id", templateId);
    const zoneIdMap = new Map<string, string>();
    if (zones?.length) {
      const { data: newZones } = await supabase
        .from("pricing_rate_card_zones")
        .insert(
          zones.map((z) => ({
            card_id: newCard.id,
            zone_code: z.zone_code,
            zone_name: z.zone_name,
            description: z.description,
            display_order: z.display_order,
          })),
        )
        .select();
      // map old->new by zone_code+order
      newZones?.forEach((nz) => {
        const old = zones.find((z) => z.zone_code === nz.zone_code && z.display_order === nz.display_order);
        if (old) zoneIdMap.set(old.id, nz.id);
      });
    }

    // 3. clone rows
    const { data: rows } = await supabase.from("pricing_rate_card_rows").select("*").eq("card_id", templateId);
    const rowIdMap = new Map<string, string>();
    if (rows?.length) {
      const { data: newRows } = await supabase
        .from("pricing_rate_card_rows")
        .insert(
          rows.map((r) => ({
            card_id: newCard.id,
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

    // 4. clone values
    const oldRowIds = rows?.map((r) => r.id) || [];
    if (oldRowIds.length) {
      const { data: values } = await supabase
        .from("pricing_rate_card_values")
        .select("*")
        .in("row_id", oldRowIds);
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

    toast({ title: "Created", description: `${cardName} created from template.` });
    setSaving(false);
    setOpen(false);
    setName("");
    setCustomerId("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> New bespoke card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create bespoke rate card</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.customer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Copy className="h-3.5 w-3.5" /> Start from template
            </Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Card name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-generated from customer" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PricingPage;
