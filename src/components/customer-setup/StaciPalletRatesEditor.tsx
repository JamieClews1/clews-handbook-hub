import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Trash2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { STACI_COLOUR_CONFIG, type StaciPalletColour } from "@/components/load-reports/staci/types";

const COLOUR_ORDER: StaciPalletColour[] = ["red", "yellow", "blue", "green", "waste_wood"];

interface RateRow {
  id?: string;
  colour: string;
  rate: number;
  effective_from: string;
  isNew?: boolean;
}

interface ChargeRow {
  id?: string;
  charge_key: string;
  charge_value: number;
  effective_from: string;
  isNew?: boolean;
}

const CHARGE_LABELS: Record<string, string> = {
  good_pallet_rebate: "Good Pallet Rebate (£/pallet)",
  pallet_weight_charge: "Pallet Weight Charge (£/tonne)",
};

export function StaciPalletRatesEditor() {
  const { toast } = useToast();
  const [rates, setRates] = useState<RateRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPeriodDate, setNewPeriodDate] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: ratesData, error: ratesErr }, { data: chargesData, error: chargesErr }] = await Promise.all([
        supabase.from("staci_pallet_rates").select("*").order("effective_from", { ascending: false }).order("colour"),
        supabase.from("staci_pallet_charges").select("*").order("effective_from", { ascending: false }).order("charge_key"),
      ]);
      if (ratesErr) throw ratesErr;
      if (chargesErr) throw chargesErr;
      setRates((ratesData ?? []) as RateRow[]);
      setCharges((chargesData ?? []) as ChargeRow[]);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load rates.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Group rates by effective_from
  const periods = Array.from(new Set(rates.map((r) => r.effective_from))).sort((a, b) => b.localeCompare(a));

  const addNewPeriod = () => {
    if (!newPeriodDate) {
      toast({ title: "Select a date", description: "Please enter the effective-from date for the new rate period.", variant: "destructive" });
      return;
    }
    // Check if period already exists
    if (periods.includes(newPeriodDate)) {
      toast({ title: "Period exists", description: "A rate period for this date already exists.", variant: "destructive" });
      return;
    }

    // Get the latest rates as defaults
    const latestPeriod = periods[0];
    const latestRates = rates.filter((r) => r.effective_from === latestPeriod);
    const latestCharges = charges.filter((c) => c.effective_from === latestPeriod);

    const newRates: RateRow[] = COLOUR_ORDER.map((colour) => {
      const existing = latestRates.find((r) => r.colour === colour);
      return { colour, rate: existing?.rate ?? 0, effective_from: newPeriodDate, isNew: true };
    });

    const newCharges: ChargeRow[] = Object.keys(CHARGE_LABELS).map((key) => {
      const existing = latestCharges.find((c) => c.charge_key === key);
      return { charge_key: key, charge_value: existing?.charge_value ?? 0, effective_from: newPeriodDate, isNew: true };
    });

    setRates((prev) => [...newRates, ...prev]);
    setCharges((prev) => [...newCharges, ...prev]);
    setNewPeriodDate("");
  };

  const updateRate = (period: string, colour: string, value: number) => {
    setRates((prev) =>
      prev.map((r) => (r.effective_from === period && r.colour === colour ? { ...r, rate: value } : r))
    );
  };

  const updateCharge = (period: string, key: string, value: number) => {
    setCharges((prev) =>
      prev.map((c) => (c.effective_from === period && c.charge_key === key ? { ...c, charge_value: value } : c))
    );
  };

  const deletePeriod = async (period: string) => {
    if (!confirm(`Delete all rates for the period starting ${format(new Date(period + "T00:00:00"), "dd MMM yyyy")}?`)) return;
    try {
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from("staci_pallet_rates").delete().eq("effective_from", period),
        supabase.from("staci_pallet_charges").delete().eq("effective_from", period),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      toast({ title: "Deleted", description: "Rate period removed." });
      await loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to delete.", variant: "destructive" });
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Upsert rates
      const ratePayloads = rates.map(({ id, isNew, ...rest }) => ({
        ...(id && !isNew ? { id } : {}),
        ...rest,
      }));

      const chargePayloads = charges.map(({ id, isNew, ...rest }) => ({
        ...(id && !isNew ? { id } : {}),
        ...rest,
      }));

      const { error: e1 } = await supabase.from("staci_pallet_rates").upsert(ratePayloads, { onConflict: "colour,effective_from" });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("staci_pallet_charges").upsert(chargePayloads, { onConflict: "charge_key,effective_from" });
      if (e2) throw e2;

      toast({ title: "Saved", description: "All Staci pallet rates saved." });
      await loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading rates...</p>
        </CardContent>
      </Card>
    );
  }

  // Recalculate periods after potential new additions
  const allPeriods = Array.from(new Set(rates.map((r) => r.effective_from))).sort((a, b) => b.localeCompare(a));
  const allChargePeriods = Array.from(new Set(charges.map((c) => c.effective_from))).sort((a, b) => b.localeCompare(a));
  const combinedPeriods = Array.from(new Set([...allPeriods, ...allChargePeriods])).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How pallets are classified</CardTitle>
          <CardDescription>
            Colour is auto-assigned from the pallet weight and its waste breakdown. Any non-recyclable
            content (PVC, RDF, landfill) makes a pallet "mixed" — it can no longer be Blue/Green above the weight limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Colour</TableHead>
                <TableHead>Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {([
                ["green", "100% recyclable AND 300KG or more (no contamination)"],
                ["blue", "100% recyclable under 300KG (no contamination)"],
                ["yellow", "Mixed (any contamination): majority-recyclable, or majority non-recyclable at 150KG or less"],
                ["red", "Over 150KG with majority non-recyclable"],
                ["waste_wood", "Pallet scrap / waste wood, charged per tonne"],
              ] as [StaciPalletColour, string][]).map(([colour, rule]) => (
                <TableRow key={colour}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-3 h-3 rounded-full ${STACI_COLOUR_CONFIG[colour].bgColor}`} />
                      {STACI_COLOUR_CONFIG[colour].label}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{rule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staci Pallet Rates</CardTitle>
          <CardDescription>
            Manage pallet colour rates and charges. Each period defines rates from its start date until the next period begins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new period */}
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label>New rate period from</Label>
              <Input
                type="date"
                value={newPeriodDate}
                onChange={(e) => setNewPeriodDate(e.target.value)}
                className="w-48"
              />
            </div>
            <Button onClick={addNewPeriod} variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Period
            </Button>
            <div className="ml-auto">
              <Button onClick={saveAll} disabled={saving} className="gap-1.5">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save All"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Periods */}
          {combinedPeriods.map((period, idx) => {
            const periodRates = rates.filter((r) => r.effective_from === period);
            const periodCharges = charges.filter((c) => c.effective_from === period);
            const isLatest = idx === 0;
            const periodLabel = format(new Date(period + "T00:00:00"), "dd MMM yyyy");

            return (
              <Card key={period} className={isLatest ? "border-primary" : ""}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">From {periodLabel}</CardTitle>
                      {isLatest && <Badge variant="default">Current</Badge>}
                    </div>
                    {combinedPeriods.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => deletePeriod(period)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  {/* Colour rates */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colour</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-36">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {COLOUR_ORDER.map((colour) => {
                        const row = periodRates.find((r) => r.colour === colour);
                        const config = STACI_COLOUR_CONFIG[colour];
                        const isPerTonne = colour === "waste_wood";
                        return (
                          <TableRow key={colour}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={`inline-block w-3 h-3 rounded-full ${config.bgColor}`} />
                                {config.label}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{config.description}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-sm text-muted-foreground">£</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="w-24 text-right"
                                  value={row?.rate ?? 0}
                                  onChange={(e) => updateRate(period, colour, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-xs text-muted-foreground">{isPerTonne ? "/t" : "/pallet"}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Charges */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Charges & Rebates</p>
                    {Object.keys(CHARGE_LABELS).map((key) => {
                      const row = periodCharges.find((c) => c.charge_key === key);
                      return (
                        <div key={key} className="flex items-center justify-between gap-4">
                          <Label className="text-sm">{CHARGE_LABELS[key]}</Label>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">£</span>
                            <Input
                              type="number"
                              step="0.01"
                              className="w-24 text-right"
                              value={row?.charge_value ?? 0}
                              onChange={(e) => updateCharge(period, key, parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {combinedPeriods.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No rate periods configured. Add one above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
