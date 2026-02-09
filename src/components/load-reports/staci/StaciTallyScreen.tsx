import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Palette, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StaciPalletEntryCard } from "./StaciPalletEntryCard";
import { StaciColourSelector } from "./StaciColourSelector";
import { StaciSummaryTable } from "./StaciSummaryTable";
import {
  StaciPalletEntry,
  StaciPalletColour,
  StaciColourSummary,
  STACI_PALLET_RATES,
} from "./types";

interface StaciTallyScreenProps {
  palletEntries: StaciPalletEntry[];
  onPalletEntriesChange: (entries: StaciPalletEntry[]) => void;
  onBack: () => void;
  onReview: () => void;
  goodPalletCount: number;
  onGoodPalletCountChange: (count: number) => void;
}

export const StaciTallyScreen = ({
  palletEntries,
  onPalletEntriesChange,
  onBack,
  onReview,
  goodPalletCount,
  onGoodPalletCountChange,
}: StaciTallyScreenProps) => {
  // Generate unique ID for new entries
  const generateId = () => crypto.randomUUID();

  // Add a new pallet with the selected colour
  const handleAddPallet = (colour: StaciPalletColour) => {
    const newEntry: StaciPalletEntry = {
      id: generateId(),
      colour,
      weight_kg: 0,
      pallet_type: "good",
      display_order: palletEntries.length,
    };
    onPalletEntriesChange([...palletEntries, newEntry]);
  };

  // Update weight for a specific entry
  const handleWeightChange = (id: string, weight: number) => {
    onPalletEntriesChange(
      palletEntries.map((e) => (e.id === id ? { ...e, weight_kg: weight } : e))
    );
  };

  // Delete an entry
  const handleDelete = (id: string) => {
    onPalletEntriesChange(palletEntries.filter((e) => e.id !== id));
  };

  // Calculate summaries by colour
  const { summaries, totalPallets, totalWeightKg, totalValue } = useMemo(() => {
    const colourMap = new Map<StaciPalletColour, { count: number; weight: number }>();

    for (const entry of palletEntries) {
      const existing = colourMap.get(entry.colour) || { count: 0, weight: 0 };
      colourMap.set(entry.colour, {
        count: existing.count + 1,
        weight: existing.weight + entry.weight_kg,
      });
    }

    const summaries: StaciColourSummary[] = [];
    let totalPallets = 0;
    let totalWeightKg = 0;
    let totalValue = 0;

    for (const [colour, data] of colourMap) {
      const rate = STACI_PALLET_RATES[colour];
      // For waste_wood, rate is per tonne, so calculate based on weight
      let value: number;
      if (colour === "waste_wood") {
        value = (data.weight / 1000) * rate; // Convert kg to tonnes, multiply by rate
      } else {
        value = data.count * rate; // Per pallet rate
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

    // Sort by colour order: red, yellow, blue, green, waste_wood
    const colourOrder: StaciPalletColour[] = ["red", "yellow", "blue", "green", "waste_wood"];
    summaries.sort((a, b) => colourOrder.indexOf(a.colour) - colourOrder.indexOf(b.colour));

    return { summaries, totalPallets, totalWeightKg, totalValue };
  }, [palletEntries]);

  return (
    <div className="space-y-6 pb-32">
      {/* Colour selector */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Staci Pallet Tally</CardTitle>
              <p className="text-sm text-muted-foreground">
                Add pallets by colour classification
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StaciColourSelector onAddPallet={handleAddPallet} />
        </CardContent>
      </Card>

      {/* Pallet entries list */}
      {palletEntries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Pallets ({palletEntries.length}):
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {palletEntries.map((entry, idx) => (
              <StaciPalletEntryCard
                key={entry.id}
                entry={entry}
                index={idx}
                onWeightChange={(weight) => handleWeightChange(entry.id, weight)}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </div>
        </div>
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

      {/* Summary table */}
      {summaries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Summary:</h3>
          <StaciSummaryTable
            summaries={summaries}
            totalPallets={totalPallets}
            totalWeightKg={totalWeightKg}
            totalValue={totalValue}
            goodPalletCount={goodPalletCount}
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

            <Button onClick={onReview} className="h-12 px-6 gap-2 text-base">
              <span className="hidden sm:inline">Review</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
