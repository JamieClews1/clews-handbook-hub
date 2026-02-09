import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, FileText, Palette } from "lucide-react";
import { StaciSummaryTable } from "./StaciSummaryTable";
import {
  StaciPalletEntry,
  StaciColourSummary,
  StaciPalletColour,
  STACI_PALLET_RATES,
  STACI_PALLET_GOOD_REBATE,
} from "./types";

interface StaciReviewScreenProps {
  operatorName: string;
  vehicleReg: string;
  jobNumber: string;
  reportDate: string;
  palletEntries: StaciPalletEntry[];
  goodPalletCount: number;
  palletsScrapCount: number;
  cardBalesCount: number;
  cardBalesWeightKg: number;
  filmsBaleCount: number;
  filmsBaleWeightKg: number;
  palletWeightKg?: number;
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  isSaving: boolean;
}

export const StaciReviewScreen = ({
  operatorName,
  vehicleReg,
  jobNumber,
  reportDate,
  palletEntries,
  goodPalletCount,
  palletsScrapCount,
  cardBalesCount,
  cardBalesWeightKg,
  filmsBaleCount,
  filmsBaleWeightKg,
  palletWeightKg = 20,
  onBack,
  onSaveDraft,
  onSubmit,
  isSaving,
}: StaciReviewScreenProps) => {
  // Calculate summaries
  const { summaries, totalPallets, totalWeightKg, totalValue, netTotal } = useMemo(() => {
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

    const palletRebate = goodPalletCount * STACI_PALLET_GOOD_REBATE;
    const netTotal = totalValue - palletRebate;

    return { summaries, totalPallets, totalWeightKg, totalValue, netTotal };
  }, [palletEntries, goodPalletCount]);

  return (
    <div className="space-y-6 pb-32">
      {/* Report Details */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-lg">Staci Load Report</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Operator:</span>
              <p className="font-medium">{operatorName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>
              <p className="font-medium">{new Date(reportDate).toLocaleDateString()}</p>
            </div>
            {vehicleReg && (
              <div>
                <span className="text-muted-foreground">Vehicle:</span>
                <p className="font-medium">{vehicleReg}</p>
              </div>
            )}
            {jobNumber && (
              <div>
                <span className="text-muted-foreground">Job Number:</span>
                <p className="font-medium">{jobNumber}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pallet Summary */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-lg">Pallet Breakdown</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {summaries.length > 0 ? (
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
              palletWeightKg={palletWeightKg}
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No pallets have been added yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Total Value Card */}
      <Card className={`border-2 ${netTotal < 0 ? "border-green-500/50 bg-green-50/30" : "border-orange-500/50 bg-orange-50/30"}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Total</p>
              <p className="text-xs text-muted-foreground">
                {netTotal < 0 ? "(Rebate to customer)" : "(Charge to customer)"}
              </p>
            </div>
            <div className={`text-3xl font-bold ${netTotal < 0 ? "text-green-600" : "text-orange-600"}`}>
              {netTotal < 0 ? "-" : ""}£{Math.abs(netTotal).toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-lg p-4 z-50">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={onBack} className="h-12 px-4 gap-2">
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Back</span>
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={onSaveDraft}
                disabled={isSaving}
                className="h-12 px-4"
              >
                Save Draft
              </Button>
              <Button
                onClick={onSubmit}
                disabled={isSaving || palletEntries.length === 0}
                className="h-12 px-6 gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
