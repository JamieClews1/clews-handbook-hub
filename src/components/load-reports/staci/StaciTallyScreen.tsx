import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Plus, Package, ClipboardList, Trash, Layers, Film } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StaciPalletEntryCard } from "./StaciPalletEntryCard";
import { StaciSummaryTable } from "./StaciSummaryTable";
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
}

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
}: StaciTallyScreenProps) => {
  // Generate unique ID for new entries
  const generateId = () => crypto.randomUUID();

  // Add a new blank pallet type
  const handleAddPallet = () => {
    const newEntry: StaciPalletEntry = {
      id: generateId(),
      colour: "blue", // Default, will be recalculated
      weight_kg: 0,
      pallet_type: "good",
      display_order: palletEntries.length,
      description: "",
      waste_breakdown: { ...EMPTY_WASTE_BREAKDOWN },
      pallet_count: 1,
    };
    onPalletEntriesChange([...palletEntries, newEntry]);
  };

  // Update pallet count
  const handlePalletCountChange = (id: string, count: number) => {
    onPalletEntriesChange(
      palletEntries.map((e) => (e.id === id ? { ...e, pallet_count: count } : e))
    );
  };

  // Update description for a specific entry
  const handleDescriptionChange = (id: string, description: string) => {
    onPalletEntriesChange(
      palletEntries.map((e) => (e.id === id ? { ...e, description } : e))
    );
  };

  // Update weight and recalculate colour
  const handleWeightChange = (id: string, weight: number) => {
    onPalletEntriesChange(
      palletEntries.map((e) => {
        if (e.id !== id) return e;
        const newColour = calculatePalletColour(weight, e.waste_breakdown);
        return { ...e, weight_kg: weight, colour: newColour };
      })
    );
  };

  // Update breakdown and recalculate colour
  const handleBreakdownChange = (id: string, breakdown: StaciWasteBreakdown) => {
    onPalletEntriesChange(
      palletEntries.map((e) => {
        if (e.id !== id) return e;
        const newColour = calculatePalletColour(e.weight_kg, breakdown);
        return { ...e, waste_breakdown: breakdown, colour: newColour };
      })
    );
  };

  // Delete an entry
  const handleDelete = (id: string) => {
    onPalletEntriesChange(palletEntries.filter((e) => e.id !== id));
  };

  // Calculate summaries by colour (only include valid entries)
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
      let value: number;
      if (colour === "waste_wood") {
        value = (data.weight / 1000) * rate;
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
  }, [palletEntries]);

  const incompleteCount = palletEntries.length - totalPalletTypes;

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
              <Label className="text-base font-semibold text-foreground">
                Card Bales
              </Label>
              <p className="text-sm text-muted-foreground">
                Baled cardboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <Input
                  id="cardBalesCount"
                  type="number"
                  min={0}
                  value={cardBalesCount}
                  onChange={(e) => onCardBalesCountChange(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 h-14 text-center text-2xl font-bold"
                />
                <span className="text-xs text-muted-foreground">Qty</span>
              </div>
              <div className="text-center">
                <Input
                  id="cardBalesWeight"
                  type="number"
                  min={0}
                  value={cardBalesWeightKg}
                  onChange={(e) => onCardBalesWeightKgChange(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 h-14 text-center text-2xl font-bold"
                />
                <span className="text-xs text-muted-foreground">Est KG</span>
              </div>
            </div>
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
              <Label className="text-base font-semibold text-foreground">
                Films Bale
              </Label>
              <p className="text-sm text-muted-foreground">
                Baled film/plastic
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <Input
                  id="filmsBaleCount"
                  type="number"
                  min={0}
                  value={filmsBaleCount}
                  onChange={(e) => onFilmsBaleCountChange(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 h-14 text-center text-2xl font-bold"
                />
                <span className="text-xs text-muted-foreground">Qty</span>
              </div>
              <div className="text-center">
                <Input
                  id="filmsBaleWeight"
                  type="number"
                  min={0}
                  value={filmsBaleWeightKg}
                  onChange={(e) => onFilmsBaleWeightKgChange(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 h-14 text-center text-2xl font-bold"
                />
                <span className="text-xs text-muted-foreground">Est KG</span>
              </div>
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
                <div className="text-2xl font-bold text-foreground">{totalPallets}</div>
                <div className="text-xs text-muted-foreground">Pallets</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div>
                <div className="text-2xl font-bold text-primary">
                  {(totalWeightKg / 1000).toFixed(2)}t
                </div>
                <div className="text-xs text-muted-foreground">Total Weight</div>
              </div>
            </div>

            <Button 
              onClick={onReview} 
              className="h-12 px-6 gap-2 text-base"
              disabled={validEntryCount === 0}
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
