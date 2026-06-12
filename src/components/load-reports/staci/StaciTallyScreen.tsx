import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Plus, Package, ClipboardList, Trash, Layers, Film, Check, ChevronRight, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { StaciPalletEntryCard } from "./StaciPalletEntryCard";
import { StaciSummaryTable } from "./StaciSummaryTable";
import { BaleDolavInput } from "./BaleDolavInput";
import {
  StaciPalletEntry,
  StaciWasteBreakdown,
  StaciPalletColour,
  StaciColourSummary,
  STACI_PALLET_RATES,
  EMPTY_WASTE_BREAKDOWN,
  calculatePalletColour,
  getTotalPercentage,
} from "./types";

interface StaciTallyScreenProps {
  palletEntries: StaciPalletEntry[];
  onPalletEntriesChange: (entries: StaciPalletEntry[]) => void;
  onBack: () => void;
  onReview: () => void;
  goodPalletCount: number;
  onGoodPalletCountChange: (count: number) => void;
  palletsScrapCount: number;
  onPalletsScrapCountChange: (count: number) => void;
  cardBalesCount: number;
  onCardBalesCountChange: (count: number) => void;
  cardBalesWeightKg: number;
  onCardBalesWeightKgChange: (weight: number) => void;
  filmsBaleCount: number;
  onFilmsBaleCountChange: (count: number) => void;
  filmsBaleWeightKg: number;
  onFilmsBaleWeightKgChange: (weight: number) => void;
  papersDolavCount: number;
  onPapersDolavCountChange: (count: number) => void;
  papersDolavWeightKg: number;
  onPapersDolavWeightKgChange: (weight: number) => void;
  glassDolavCount: number;
  onGlassDolavCountChange: (count: number) => void;
  glassDolavWeightKg: number;
  onGlassDolavWeightKgChange: (weight: number) => void;
  scrapMetalLooseCount: number;
  onScrapMetalLooseCountChange: (count: number) => void;
  scrapMetalLooseWeightKg: number;
  onScrapMetalLooseWeightKgChange: (weight: number) => void;
  cardBalesOnPallets: boolean;
  onCardBalesOnPalletsChange: (on: boolean) => void;
  filmsBaleOnPallets: boolean;
  onFilmsBaleOnPalletsChange: (on: boolean) => void;
  papersDolavOnPallets: boolean;
  onPapersDolavOnPalletsChange: (on: boolean) => void;
  glassDolavOnPallets: boolean;
  onGlassDolavOnPalletsChange: (on: boolean) => void;
  scrapMetalLooseOnPallets: boolean;
  onScrapMetalLooseOnPalletsChange: (on: boolean) => void;
  palletWeightKg?: number;
  greenRatePerTonne?: number;
  onGreenRatePerTonneChange?: (rate: number) => void;
}

type MobileStep = "pallet-entry" | "bales-pallets";

export const StaciTallyScreen = ({
  palletEntries,
  onPalletEntriesChange,
  onBack,
  onReview,
  goodPalletCount,
  onGoodPalletCountChange,
  palletsScrapCount,
  onPalletsScrapCountChange,
  cardBalesCount,
  onCardBalesCountChange,
  cardBalesWeightKg,
  onCardBalesWeightKgChange,
  filmsBaleCount,
  onFilmsBaleCountChange,
  filmsBaleWeightKg,
  onFilmsBaleWeightKgChange,
  papersDolavCount,
  onPapersDolavCountChange,
  papersDolavWeightKg,
  onPapersDolavWeightKgChange,
  glassDolavCount,
  onGlassDolavCountChange,
  glassDolavWeightKg,
  onGlassDolavWeightKgChange,
  scrapMetalLooseCount,
  onScrapMetalLooseCountChange,
  scrapMetalLooseWeightKg,
  onScrapMetalLooseWeightKgChange,
  cardBalesOnPallets,
  onCardBalesOnPalletsChange,
  filmsBaleOnPallets,
  onFilmsBaleOnPalletsChange,
  papersDolavOnPallets,
  onPapersDolavOnPalletsChange,
  glassDolavOnPallets,
  onGlassDolavOnPalletsChange,
  scrapMetalLooseOnPallets,
  onScrapMetalLooseOnPalletsChange,
  palletWeightKg = 20,
  greenRatePerTonne = 0,
  onGreenRatePerTonneChange,
}: StaciTallyScreenProps) => {
  const isMobile = useIsMobile();
  const [mobileStep, setMobileStep] = useState<MobileStep>("pallet-entry");
  const [activePalletIndex, setActivePalletIndex] = useState(0);

  const generateId = () => crypto.randomUUID();

  const handleAddPallet = () => {
    const newEntry: StaciPalletEntry = {
      id: generateId(),
      colour: "blue",
      weight_kg: 0,
      pallet_type: "good",
      display_order: palletEntries.length,
      description: "",
      waste_breakdown: { ...EMPTY_WASTE_BREAKDOWN },
      pallet_count: 1,
    };
    onPalletEntriesChange([...palletEntries, newEntry]);
    setActivePalletIndex(palletEntries.length);
  };

  const handlePalletCountChange = (id: string, count: number) => {
    onPalletEntriesChange(
      palletEntries.map((e) => (e.id === id ? { ...e, pallet_count: count } : e))
    );
  };

  const handleDescriptionChange = (id: string, description: string) => {
    onPalletEntriesChange(
      palletEntries.map((e) => (e.id === id ? { ...e, description } : e))
    );
  };

  const handleWeightChange = (id: string, weight: number) => {
    onPalletEntriesChange(
      palletEntries.map((e) => {
        if (e.id !== id) return e;
        const newColour = calculatePalletColour(weight, e.waste_breakdown);
        return { ...e, weight_kg: weight, colour: newColour };
      })
    );
  };

  const handleBreakdownChange = (id: string, breakdown: StaciWasteBreakdown) => {
    onPalletEntriesChange(
      palletEntries.map((e) => {
        if (e.id !== id) return e;
        const newColour = calculatePalletColour(e.weight_kg, breakdown);
        return { ...e, waste_breakdown: breakdown, colour: newColour };
      })
    );
  };

  const handleDelete = (id: string) => {
    const newEntries = palletEntries.filter((e) => e.id !== id);
    onPalletEntriesChange(newEntries);
    if (activePalletIndex >= newEntries.length) {
      setActivePalletIndex(Math.max(0, newEntries.length - 1));
    }
  };

  // Save current pallet and add next
  const handleSaveAndNext = () => {
    const newEntry: StaciPalletEntry = {
      id: generateId(),
      colour: "blue",
      weight_kg: 0,
      pallet_type: "good",
      display_order: palletEntries.length,
      description: "",
      waste_breakdown: { ...EMPTY_WASTE_BREAKDOWN },
      pallet_count: 1,
    };
    onPalletEntriesChange([...palletEntries, newEntry]);
    setActivePalletIndex(palletEntries.length);
  };

  // No more palletised waste - go to bales/pallets step
  const handleNoMorePallets = () => {
    setMobileStep("bales-pallets");
  };

  const { summaries, totalPallets, totalWeightKg, totalValue, validEntryCount, totalPalletTypes } = useMemo(() => {
    const colourMap = new Map<StaciPalletColour, { count: number; weight: number }>();

    let validCount = 0;
    let totalPalletTypes = 0;
    for (const entry of palletEntries) {
      const breakdownTotal = getTotalPercentage(entry.waste_breakdown);
      const isValid = Math.abs(breakdownTotal - 100) < 0.01 && entry.weight_kg > 0;
      
      if (!isValid) continue;
      validCount++;
      totalPalletTypes++;

      const palletCount = entry.pallet_count || 1;
      const colour = calculatePalletColour(entry.weight_kg, entry.waste_breakdown);
      const existing = colourMap.get(colour) || { count: 0, weight: 0 };
      colourMap.set(colour, {
        count: existing.count + palletCount,
        weight: existing.weight + (entry.weight_kg * palletCount),
      });
    }

    const summaries: StaciColourSummary[] = [];
    let totalPallets = 0;
    let totalWeightKg = 0;
    let totalValue = 0;

    for (const [colour, data] of colourMap) {
      const rate = STACI_PALLET_RATES[colour];
      const isGreenOverride = colour === "green" && greenRatePerTonne !== 0;
      let value: number;
      if (colour === "waste_wood") {
        value = (data.weight / 1000) * rate;
      } else if (isGreenOverride) {
        const netWeight = data.weight - data.count * palletWeightKg;
        value = (netWeight / 1000) * greenRatePerTonne;
      } else {
        value = data.count * rate;
      }

      summaries.push({
        colour,
        palletCount: data.count,
        totalWeightKg: data.weight,
        ratePerPallet: rate,
        totalValue: value,
      });

      totalPallets += data.count;
      totalWeightKg += data.weight;
      totalValue += value;
    }

    const colourOrder: StaciPalletColour[] = ["red", "yellow", "blue", "green", "waste_wood"];
    summaries.sort((a, b) => colourOrder.indexOf(a.colour) - colourOrder.indexOf(b.colour));

    return { summaries, totalPallets, totalWeightKg, totalValue, validEntryCount: validCount, totalPalletTypes };
  }, [palletEntries, greenRatePerTonne, palletWeightKg]);

  const onPalletsBaleDolavCount = 
    (cardBalesOnPallets ? cardBalesCount : 0) +
    (filmsBaleOnPallets ? filmsBaleCount : 0) +
    (papersDolavOnPallets ? papersDolavCount : 0) +
    (glassDolavOnPallets ? glassDolavCount : 0) +
    (scrapMetalLooseOnPallets ? scrapMetalLooseCount : 0);

  const hasDolavData = papersDolavWeightKg > 0 || glassDolavWeightKg > 0 || cardBalesWeightKg > 0 || filmsBaleWeightKg > 0 || scrapMetalLooseWeightKg > 0;
  const hasPalletOnlyData = palletsScrapCount > 0 || goodPalletCount > 0;

  const grandTotalPallets = totalPallets + onPalletsBaleDolavCount;

  const incompleteCount = palletEntries.length - totalPalletTypes;

  const isCurrentPalletValid = () => {
    if (palletEntries.length === 0) return false;
    const current = palletEntries[activePalletIndex];
    if (!current) return false;
    const breakdownTotal = getTotalPercentage(current.waste_breakdown);
    return Math.abs(breakdownTotal - 100) < 0.01 && current.weight_kg > 0;
  };

  // ============ MOBILE WIZARD VIEW ============
  if (isMobile) {
    // Step indicator
    const stepIndicator = (
      <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
          mobileStep === "pallet-entry" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          <span>1</span>
          <span>Pallet Types</span>
        </div>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
          mobileStep === "bales-pallets" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          <span>2</span>
          <span>Bales & Pallets</span>
        </div>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          <span>3</span>
          <span>Review</span>
        </div>
      </div>
    );

    // STEP 1: Pallet entry - one at a time
    if (mobileStep === "pallet-entry") {
      const currentEntry = palletEntries[activePalletIndex];
      const currentValid = isCurrentPalletValid();

      return (
        <div className="space-y-4 pb-32">
          {stepIndicator}

          {palletEntries.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="py-12 text-center space-y-3">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pallet types added yet</p>
                <Button onClick={handleAddPallet} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add First Pallet Type
                </Button>
                <div>
                  <Button variant="outline" onClick={handleNoMorePallets} className="gap-2">
                    Skip to Bales & Dolavs
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Progress indicator */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Pallet Type {activePalletIndex + 1} of {palletEntries.length}</span>
                {validEntryCount > 0 && (
                  <span className="text-green-600">{validEntryCount} completed</span>
                )}
              </div>

              {/* Navigation dots for multiple pallets */}
              {palletEntries.length > 1 && (
                <div className="flex items-center gap-1.5 justify-center">
                  {palletEntries.map((entry, idx) => {
                    const bd = getTotalPercentage(entry.waste_breakdown);
                    const valid = Math.abs(bd - 100) < 0.01 && entry.weight_kg > 0;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setActivePalletIndex(idx)}
                        className={`w-3 h-3 rounded-full transition-colors ${
                          idx === activePalletIndex
                            ? "bg-primary"
                            : valid
                            ? "bg-green-500"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Current pallet entry */}
              {currentEntry && (
                <>
                  <StaciPalletEntryCard
                    entry={currentEntry}
                    index={activePalletIndex}
                    onDescriptionChange={(desc) => handleDescriptionChange(currentEntry.id, desc)}
                    onWeightChange={(weight) => handleWeightChange(currentEntry.id, weight)}
                    onPalletCountChange={(count) => handlePalletCountChange(currentEntry.id, count)}
                    onBreakdownChange={(breakdown) => handleBreakdownChange(currentEntry.id, breakdown)}
                    onDelete={() => handleDelete(currentEntry.id)}
                  />
                  {(() => {
                    const total = getTotalPercentage(currentEntry.waste_breakdown);
                    const hasAnyInput = total > 0;
                    const isNot100 = hasAnyInput && Math.abs(total - 100) >= 0.01;
                    if (!isNot100) return null;
                    return (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-destructive">
                            Waste breakdown totals {total.toFixed(0)}% — must equal 100%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Adjust percentages before moving to the next step.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {/* Fixed Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-lg p-4 z-50">
            <div className="space-y-2">
              {palletEntries.length > 0 && currentValid && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleSaveAndNext}
                    variant="outline"
                    className="h-12 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Save & Next Pallet
                  </Button>
                  <Button
                    onClick={handleNoMorePallets}
                    className="h-12 gap-2"
                  >
                    <Check className="h-4 w-4" />
                    No More Pallets
                  </Button>
                </div>
              )}
              {palletEntries.length > 0 && !currentValid && (
                <Button
                  onClick={handleNoMorePallets}
                  variant="outline"
                  className="h-12 w-full gap-2"
                   disabled={validEntryCount === 0 && !hasDolavData && !hasPalletOnlyData}
                >
                  <Check className="h-4 w-4" />
                  No More Palletised Waste
                </Button>
              )}
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="h-10 px-3 gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <div className="flex items-center gap-4 text-center text-sm">
                  <div>
                    <div className="font-bold">{grandTotalPallets}</div>
                    <div className="text-xs text-muted-foreground">Pallets</div>
                  </div>
                  <div>
                    <div className="font-bold text-primary">{(totalWeightKg / 1000).toFixed(2)}t</div>
                    <div className="text-xs text-muted-foreground">Weight</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // STEP 2: Bales & Pallets
    if (mobileStep === "bales-pallets") {
      return (
        <div className="space-y-4 pb-32">
          {stepIndicator}

          <Card className="border-2 shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Bales & Pallets</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Good pallets, scrap, bales
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Good Pallets */}
          <Card className="border-2 border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <Label className="text-base font-semibold">Good Pallets</Label>
                  <p className="text-sm text-muted-foreground">£0.75 rebate each</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={goodPalletCount}
                  onChange={(e) => onGoodPalletCountChange(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 h-14 text-center text-2xl font-bold"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pallets Scrap */}
          <Card className="border-2 border-orange-500/50 bg-orange-50/30 dark:bg-orange-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <Trash className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <Label className="text-base font-semibold">Pallets Scrap</Label>
                  <p className="text-sm text-muted-foreground">Pallet charge applied</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={palletsScrapCount}
                  onChange={(e) => onPalletsScrapCountChange(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 h-14 text-center text-2xl font-bold"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card Bales */}
          <Card className="border-2 border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <Label className="text-base font-semibold">Card Bales</Label>
                  <p className="text-sm text-muted-foreground">Baled cardboard</p>
                </div>
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm text-muted-foreground">On Pallets?</span>
                  <Checkbox checked={cardBalesOnPallets} onCheckedChange={(v) => onCardBalesOnPalletsChange(!!v)} />
                </div>
                <BaleDolavInput
                  count={cardBalesCount}
                  totalWeightKg={cardBalesWeightKg}
                  onCountChange={onCardBalesCountChange}
                  onTotalWeightChange={onCardBalesWeightKgChange}
                  compact
                />
              </div>
            </CardContent>
          </Card>

          {/* Films Bale */}
          <Card className="border-2 border-violet-500/50 bg-violet-50/30 dark:bg-violet-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                  <Film className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <Label className="text-base font-semibold">Films Bale</Label>
                  <p className="text-sm text-muted-foreground">Baled film/plastic</p>
                </div>
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm text-muted-foreground">On Pallets?</span>
                  <Checkbox checked={filmsBaleOnPallets} onCheckedChange={(v) => onFilmsBaleOnPalletsChange(!!v)} />
                </div>
                <BaleDolavInput
                  count={filmsBaleCount}
                  totalWeightKg={filmsBaleWeightKg}
                  onCountChange={onFilmsBaleCountChange}
                  onTotalWeightChange={onFilmsBaleWeightKgChange}
                  compact
                />
              </div>
            </CardContent>
          </Card>

          {/* Papers Dolav */}
          <Card className="border-2 border-sky-500/50 bg-sky-50/30 dark:bg-sky-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <Label className="text-base font-semibold">Papers Dolav</Label>
                  <p className="text-sm text-muted-foreground">Paper recycling</p>
                </div>
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm text-muted-foreground">On Pallets?</span>
                  <Checkbox checked={papersDolavOnPallets} onCheckedChange={(v) => onPapersDolavOnPalletsChange(!!v)} />
                </div>
                <BaleDolavInput
                  count={papersDolavCount}
                  totalWeightKg={papersDolavWeightKg}
                  onCountChange={onPapersDolavCountChange}
                  onTotalWeightChange={onPapersDolavWeightKgChange}
                  compact
                />
              </div>
            </CardContent>
          </Card>

          {/* Glass Dolav */}
          <Card className="border-2 border-teal-500/50 bg-teal-50/30 dark:bg-teal-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <Label className="text-base font-semibold">Glass Dolav</Label>
                  <p className="text-sm text-muted-foreground">Glass recycling</p>
                </div>
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm text-muted-foreground">On Pallets?</span>
                  <Checkbox checked={glassDolavOnPallets} onCheckedChange={(v) => onGlassDolavOnPalletsChange(!!v)} />
                </div>
                <BaleDolavInput
                  count={glassDolavCount}
                  totalWeightKg={glassDolavWeightKg}
                  onCountChange={onGlassDolavCountChange}
                  onTotalWeightChange={onGlassDolavWeightKgChange}
                  compact
                />
              </div>
            </CardContent>
          </Card>

          {/* Scrap Metal Loose */}
          <Card className="border-2 border-zinc-500/50 bg-zinc-50/30 dark:bg-zinc-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-500 to-zinc-600 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <Label className="text-base font-semibold">Scrap Metal Loose</Label>
                  <p className="text-sm text-muted-foreground">Loose scrap metal</p>
                </div>
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm text-muted-foreground">On Pallets?</span>
                  <Checkbox checked={scrapMetalLooseOnPallets} onCheckedChange={(v) => onScrapMetalLooseOnPalletsChange(!!v)} />
                </div>
                <BaleDolavInput
                  count={scrapMetalLooseCount}
                  totalWeightKg={scrapMetalLooseWeightKg}
                  onCountChange={onScrapMetalLooseCountChange}
                  onTotalWeightChange={onScrapMetalLooseWeightKgChange}
                  compact
                />
              </div>
            </CardContent>
          </Card>
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-lg p-4 z-50">
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setMobileStep("pallet-entry")} className="h-12 px-4 gap-2">
                <ArrowLeft className="h-5 w-5" />
                Pallets
              </Button>
              <div className="flex items-center gap-4 text-center text-sm">
                <div>
                  <div className="font-bold">{grandTotalPallets}</div>
                  <div className="text-xs text-muted-foreground">Pallets</div>
                </div>
                <div>
                  <div className="font-bold text-primary">{(totalWeightKg / 1000).toFixed(2)}t</div>
                  <div className="text-xs text-muted-foreground">Weight</div>
                </div>
              </div>
              <Button
                onClick={onReview}
                className="h-12 px-6 gap-2"
                 disabled={validEntryCount === 0 && !hasDolavData && !hasPalletOnlyData}
              >
                Review
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  // ============ DESKTOP VIEW (unchanged) ============
  return (
    <div className="space-y-6 pb-32">
      {/* Header card with add button */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Staci Pallet Tally</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter pallet types with quantity and waste % breakdown
                </p>
              </div>
            </div>
            <Button onClick={handleAddPallet} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Pallet Type
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Pallet entries list */}
      {palletEntries.length > 0 ? (
        <div className="space-y-4">
          {palletEntries.map((entry, idx) => (
              <StaciPalletEntryCard
                key={entry.id}
                entry={entry}
                index={idx}
                onDescriptionChange={(desc) => handleDescriptionChange(entry.id, desc)}
                onWeightChange={(weight) => handleWeightChange(entry.id, weight)}
                onPalletCountChange={(count) => handlePalletCountChange(entry.id, count)}
                onBreakdownChange={(breakdown) => handleBreakdownChange(entry.id, breakdown)}
                onDelete={() => handleDelete(entry.id)}
              />
          ))}
        </div>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No pallet types added yet</p>
            <Button onClick={handleAddPallet} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Pallet Type
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Good pallet rebate section */}
      <Card className="border-2 border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <Label htmlFor="goodPallets" className="text-base font-semibold text-foreground">
                Good Pallets
              </Label>
              <p className="text-sm text-muted-foreground">
                Pallets returned in good condition (£0.75 rebate each)
              </p>
            </div>
            <Input
              id="goodPallets"
              type="number"
              min={0}
              value={goodPalletCount}
              onChange={(e) => onGoodPalletCountChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 h-14 text-center text-2xl font-bold"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pallets Scrap */}
      <Card className="border-2 border-orange-500/50 bg-orange-50/30 dark:bg-orange-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Trash className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <Label htmlFor="palletsScrap" className="text-base font-semibold text-foreground">
                Pallets Scrap
              </Label>
              <p className="text-sm text-muted-foreground">
                Pallet charge to be applied
              </p>
            </div>
            <Input
              id="palletsScrap"
              type="number"
              min={0}
              value={palletsScrapCount}
              onChange={(e) => onPalletsScrapCountChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 h-14 text-center text-2xl font-bold"
            />
          </div>
        </CardContent>
      </Card>

      {/* Card Bales */}
      <Card className="border-2 border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <Label className="text-base font-semibold text-foreground">Card Bales</Label>
              <p className="text-sm text-muted-foreground">Baled cardboard</p>
            </div>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">On Pallets?</span>
              <Checkbox checked={cardBalesOnPallets} onCheckedChange={(v) => onCardBalesOnPalletsChange(!!v)} />
            </div>
            <BaleDolavInput
              count={cardBalesCount}
              totalWeightKg={cardBalesWeightKg}
              onCountChange={onCardBalesCountChange}
              onTotalWeightChange={onCardBalesWeightKgChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Films Bale */}
      <Card className="border-2 border-violet-500/50 bg-violet-50/30 dark:bg-violet-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
              <Film className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <Label className="text-base font-semibold text-foreground">Films Bale</Label>
              <p className="text-sm text-muted-foreground">Baled film/plastic</p>
            </div>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">On Pallets?</span>
              <Checkbox checked={filmsBaleOnPallets} onCheckedChange={(v) => onFilmsBaleOnPalletsChange(!!v)} />
            </div>
            <BaleDolavInput
              count={filmsBaleCount}
              totalWeightKg={filmsBaleWeightKg}
              onCountChange={onFilmsBaleCountChange}
              onTotalWeightChange={onFilmsBaleWeightKgChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Papers Dolav */}
      <Card className="border-2 border-sky-500/50 bg-sky-50/30 dark:bg-sky-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <Label className="text-base font-semibold text-foreground">Papers Dolav</Label>
              <p className="text-sm text-muted-foreground">Paper recycling</p>
            </div>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">On Pallets?</span>
              <Checkbox checked={papersDolavOnPallets} onCheckedChange={(v) => onPapersDolavOnPalletsChange(!!v)} />
            </div>
            <BaleDolavInput
              count={papersDolavCount}
              totalWeightKg={papersDolavWeightKg}
              onCountChange={onPapersDolavCountChange}
              onTotalWeightChange={onPapersDolavWeightKgChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Glass Dolav */}
      <Card className="border-2 border-teal-500/50 bg-teal-50/30 dark:bg-teal-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <Label className="text-base font-semibold text-foreground">Glass Dolav</Label>
              <p className="text-sm text-muted-foreground">Glass recycling</p>
            </div>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">On Pallets?</span>
              <Checkbox checked={glassDolavOnPallets} onCheckedChange={(v) => onGlassDolavOnPalletsChange(!!v)} />
            </div>
            <BaleDolavInput
              count={glassDolavCount}
              totalWeightKg={glassDolavWeightKg}
              onCountChange={onGlassDolavCountChange}
              onTotalWeightChange={onGlassDolavWeightKgChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Scrap Metal Loose */}
      <Card className="border-2 border-zinc-500/50 bg-zinc-50/30 dark:bg-zinc-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-500 to-zinc-600 flex items-center justify-center">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <Label className="text-base font-semibold text-foreground">Scrap Metal Loose</Label>
              <p className="text-sm text-muted-foreground">Loose scrap metal</p>
            </div>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground">On Pallets?</span>
              <Checkbox checked={scrapMetalLooseOnPallets} onCheckedChange={(v) => onScrapMetalLooseOnPalletsChange(!!v)} />
            </div>
            <BaleDolavInput
              count={scrapMetalLooseCount}
              totalWeightKg={scrapMetalLooseWeightKg}
              onCountChange={onScrapMetalLooseCountChange}
              onTotalWeightChange={onScrapMetalLooseWeightKgChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Green pallet per-tonne override (specific to this load) */}
      <Card className="border-green-500/40">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <Label htmlFor="greenRatePerTonne" className="text-base font-semibold text-foreground">
                Green Pallet Cost (£/tonne) — this load
              </Label>
              <p className="text-xs text-muted-foreground">
                Optional override. When set, Green pallets are costed per tonne (net weight) for this load instead of the per-pallet rate. Leave 0 to use the standard rate. Use a negative value for a rebate.
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-sm text-muted-foreground">£</span>
              <Input
                id="greenRatePerTonne"
                type="number"
                step="0.01"
                className="w-32 text-right"
                value={greenRatePerTonne || ""}
                placeholder="0.00"
                onChange={(e) => onGreenRatePerTonneChange?.(parseFloat(e.target.value) || 0)}
              />
              <span className="text-xs text-muted-foreground">/t</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary table */}
      {summaries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Summary:</h3>
            {incompleteCount > 0 && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                {incompleteCount} pallet type(s) incomplete
              </span>
            )}
          </div>
          <StaciSummaryTable
            summaries={summaries}
            totalPallets={totalPallets}
            totalWeightKg={totalWeightKg}
            totalValue={totalValue}
            goodPalletCount={goodPalletCount}
            palletsScrapCount={palletsScrapCount}
            cardBalesCount={cardBalesCount}
            cardBalesWeightKg={cardBalesWeightKg}
            filmsBaleCount={filmsBaleCount}
            filmsBaleWeightKg={filmsBaleWeightKg}
            papersDolavCount={papersDolavCount}
            papersDolavWeightKg={papersDolavWeightKg}
            glassDolavCount={glassDolavCount}
            glassDolavWeightKg={glassDolavWeightKg}
            scrapMetalLooseCount={scrapMetalLooseCount}
            scrapMetalLooseWeightKg={scrapMetalLooseWeightKg}
            palletWeightKg={palletWeightKg}
            cardBalesOnPallets={cardBalesOnPallets}
            filmsBaleOnPallets={filmsBaleOnPallets}
            papersDolavOnPallets={papersDolavOnPallets}
            glassDolavOnPallets={glassDolavOnPallets}
            scrapMetalLooseOnPallets={scrapMetalLooseOnPallets}
            greenRatePerTonne={greenRatePerTonne}
          />
        </div>
      )}

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-lg p-4 z-50">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" onClick={onBack} className="h-12 px-4 gap-2">
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Back</span>
            </Button>

            <div className="flex items-center gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{grandTotalPallets}</div>
                <div className="text-xs text-muted-foreground">Pallets</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div>
                <div className="text-2xl font-bold text-primary">
                  {((totalWeightKg + cardBalesWeightKg + filmsBaleWeightKg + papersDolavWeightKg + glassDolavWeightKg + scrapMetalLooseWeightKg) / 1000).toFixed(2)}t
                </div>
                <div className="text-xs text-muted-foreground">Total Weight</div>
              </div>
            </div>

            <Button 
              onClick={onReview} 
              className="h-12 px-6 gap-2 text-base"
              disabled={validEntryCount === 0 && !hasDolavData && !hasPalletOnlyData}
            >
              <span className="hidden sm:inline">Review</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
