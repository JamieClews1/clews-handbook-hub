import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, FileText, Palette, Scale } from "lucide-react";
import { StaciSummaryTable } from "./StaciSummaryTable";
import {
  StaciPalletEntry,
  StaciColourSummary,
  StaciPalletColour,
  STACI_PALLET_RATES,
  STACI_PALLET_GOOD_REBATE,
  getTotalPercentage,
  calculatePalletColour,
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
  papersDolavCount: number;
  papersDolavWeightKg: number;
  glassDolavCount: number;
  glassDolavWeightKg: number;
  scrapMetalLooseCount: number;
  scrapMetalLooseWeightKg: number;
  palletWeightKg?: number;
  palletChargeRatePerTonne?: number;
  weighbridgeWeightKg?: number | null;
  weighbridgeLoading?: boolean;
  onPalletEntriesChange?: (entries: StaciPalletEntry[]) => void;
  onCardBalesWeightKgChange?: (weight: number) => void;
  onFilmsBaleWeightKgChange?: (weight: number) => void;
  onPapersDolavWeightKgChange?: (weight: number) => void;
  onGlassDolavWeightKgChange?: (weight: number) => void;
  onScrapMetalLooseWeightKgChange?: (weight: number) => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  cardBalesRatePerTonne?: number;
  filmsRatePerTonne?: number;
  cardBalesOnPallets?: boolean;
  filmsBaleOnPallets?: boolean;
  papersDolavOnPallets?: boolean;
  glassDolavOnPallets?: boolean;
  scrapMetalLooseOnPallets?: boolean;
}

/**
 * Proportionally distribute weighbridge weight across valid pallet entries.
 * Each entry's weight is scaled so the total gross weight matches the target.
 */
function reconcileStaciEntries(
  entries: StaciPalletEntry[],
  targetKg: number
): StaciPalletEntry[] {
  // Only reconcile valid entries (100% breakdown, weight > 0)
  const validIndices: number[] = [];
  let currentTotal = 0;

  entries.forEach((entry, idx) => {
    const breakdownTotal = getTotalPercentage(entry.waste_breakdown);
    const isValid = Math.abs(breakdownTotal - 100) < 0.01 && entry.weight_kg > 0;
    if (isValid) {
      validIndices.push(idx);
      currentTotal += entry.weight_kg * (entry.pallet_count || 1);
    }
  });

  if (validIndices.length === 0 || currentTotal === 0) return entries;

  const ratio = targetKg / currentTotal;

  return entries.map((entry, idx) => {
    if (!validIndices.includes(idx)) return entry;

    const newWeight = Math.round(entry.weight_kg * ratio);
    const newColour = calculatePalletColour(newWeight, entry.waste_breakdown);
    return { ...entry, weight_kg: newWeight, colour: newColour };
  });
}

function buildSummaries(palletEntries: StaciPalletEntry[], goodPalletCount: number) {
  const colourMap = new Map<StaciPalletColour, { count: number; weight: number }>();

  for (const entry of palletEntries) {
    const breakdownTotal = getTotalPercentage(entry.waste_breakdown);
    const isValid = Math.abs(breakdownTotal - 100) < 0.01 && entry.weight_kg > 0;
    if (!isValid) continue;

    const palletCount = entry.pallet_count || 1;
    const colour = entry.colour;
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

  const palletRebate = goodPalletCount * STACI_PALLET_GOOD_REBATE;
  const netTotal = totalValue - palletRebate;

  return { summaries, totalPallets, totalWeightKg, totalValue, netTotal, palletRebate };
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
  papersDolavCount,
  papersDolavWeightKg,
  glassDolavCount,
  glassDolavWeightKg,
  scrapMetalLooseCount,
  scrapMetalLooseWeightKg,
  palletWeightKg = 20,
  palletChargeRatePerTonne = 0,
  weighbridgeWeightKg,
  weighbridgeLoading,
  onPalletEntriesChange,
  onCardBalesWeightKgChange,
  onFilmsBaleWeightKgChange,
  onPapersDolavWeightKgChange,
  onGlassDolavWeightKgChange,
  onScrapMetalLooseWeightKgChange,
  onBack,
  onSaveDraft,
  onSubmit,
  isSaving,
  cardBalesRatePerTonne = 0,
  filmsRatePerTonne = 0,
}: StaciReviewScreenProps) => {
  const [reconciledPreview, setReconciledPreview] = useState<StaciPalletEntry[] | null>(null);
  const [reconciledBaleDolavPreview, setReconciledBaleDolavPreview] = useState<{
    cardBalesWeightKg: number;
    filmsBaleWeightKg: number;
    papersDolavWeightKg: number;
    glassDolavWeightKg: number;
    scrapMetalLooseWeightKg: number;
  } | null>(null);
  const [isReconciled, setIsReconciled] = useState(false);

  const { summaries, totalPallets, totalWeightKg, totalValue, palletRebate } = useMemo(
    () => buildSummaries(palletEntries, goodPalletCount),
    [palletEntries, goodPalletCount]
  );

  // Compute pallet charge value, bale values, and effective net total
  const totalPalletDeductionKg = totalPallets * palletWeightKg;
  const palletChargeValue = palletChargeRatePerTonne !== 0 ? (totalPalletDeductionKg / 1000) * palletChargeRatePerTonne : 0;
  const cardBalesGrossKg = cardBalesCount * cardBalesWeightKg;
  const filmsBaleGrossKg = filmsBaleCount * filmsBaleWeightKg;
  const cardBalesValue = cardBalesRatePerTonne !== 0 ? (cardBalesGrossKg / 1000) * cardBalesRatePerTonne : 0;
  const filmsBaleValue = filmsRatePerTonne !== 0 ? (filmsBaleGrossKg / 1000) * filmsRatePerTonne : 0;
  const netTotal = totalValue - palletRebate + palletChargeValue + cardBalesValue + filmsBaleValue;

  // Reconciled preview summaries
  const reconciledSummaryData = useMemo(() => {
    if (!reconciledPreview) return null;
    return buildSummaries(reconciledPreview, goodPalletCount);
  }, [reconciledPreview, goodPalletCount]);

  // Total weight from bales/dolavs that must be subtracted from weighbridge target
  const baleDolavTotalKg =
    (cardBalesCount * cardBalesWeightKg) +
    (filmsBaleCount * filmsBaleWeightKg) +
    (papersDolavCount * papersDolavWeightKg) +
    (glassDolavCount * glassDolavWeightKg) +
    (scrapMetalLooseCount * scrapMetalLooseWeightKg);

  const hasPalletEntries = palletEntries.length > 0;
  const hasBaleDolavItems = baleDolavTotalKg > 0;

  const handleReconcile = () => {
    if (typeof weighbridgeWeightKg !== "number") return;

    if (hasPalletEntries) {
      // Subtract bale/dolav weight so only the pallet portion is reconciled
      const palletTargetKg = weighbridgeWeightKg - baleDolavTotalKg;
      const reconciled = reconcileStaciEntries(palletEntries, Math.max(0, palletTargetKg));
      setReconciledPreview(reconciled);
      setReconciledBaleDolavPreview(null);
    } else if (hasBaleDolavItems) {
      // No pallets — proportionally adjust bale/dolav per-unit weights to match weighbridge
      const targetKg = weighbridgeWeightKg;
      const currentTotal = baleDolavTotalKg;
      if (currentTotal === 0) return;
      const ratio = targetKg / currentTotal;

      setReconciledBaleDolavPreview({
        cardBalesWeightKg: cardBalesCount > 0 ? Math.round(cardBalesWeightKg * ratio) : cardBalesWeightKg,
        filmsBaleWeightKg: filmsBaleCount > 0 ? Math.round(filmsBaleWeightKg * ratio) : filmsBaleWeightKg,
        papersDolavWeightKg: papersDolavCount > 0 ? Math.round(papersDolavWeightKg * ratio) : papersDolavWeightKg,
        glassDolavWeightKg: glassDolavCount > 0 ? Math.round(glassDolavWeightKg * ratio) : glassDolavWeightKg,
        scrapMetalLooseWeightKg: scrapMetalLooseCount > 0 ? Math.round(scrapMetalLooseWeightKg * ratio) : scrapMetalLooseWeightKg,
      });
      setReconciledPreview(null);
    }
  };

  const handleAcceptReconciled = () => {
    if (reconciledPreview && onPalletEntriesChange) {
      onPalletEntriesChange(reconciledPreview);
      setReconciledPreview(null);
      setReconciledBaleDolavPreview(null);
      setIsReconciled(true);
    } else if (reconciledBaleDolavPreview) {
      onCardBalesWeightKgChange?.(reconciledBaleDolavPreview.cardBalesWeightKg);
      onFilmsBaleWeightKgChange?.(reconciledBaleDolavPreview.filmsBaleWeightKg);
      onPapersDolavWeightKgChange?.(reconciledBaleDolavPreview.papersDolavWeightKg);
      onGlassDolavWeightKgChange?.(reconciledBaleDolavPreview.glassDolavWeightKg);
      onScrapMetalLooseWeightKgChange?.(reconciledBaleDolavPreview.scrapMetalLooseWeightKg);
      setReconciledPreview(null);
      setReconciledBaleDolavPreview(null);
      setIsReconciled(true);
    }
  };

  const canReconcile = typeof weighbridgeWeightKg === "number" && (hasPalletEntries || hasBaleDolavItems);

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
            {jobNumber && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Weighbridge Weight:</span>
                <p className="font-medium">
                  {weighbridgeLoading ? (
                    <span className="text-muted-foreground">Looking up…</span>
                  ) : typeof weighbridgeWeightKg === "number" ? (
                    `${Math.round(weighbridgeWeightKg).toLocaleString()} kg`
                  ) : (
                    <span className="text-muted-foreground">Not found</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Load Summary */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-lg">Load Breakdown</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaries.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold">{totalPallets}</p>
                <p className="text-xs text-muted-foreground">Total Pallets</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold">{(totalPallets * palletWeightKg).toLocaleString()} kg</p>
                <p className="text-xs text-muted-foreground">Pallet Tare ({palletWeightKg}kg each)</p>
              </div>
            </div>
          )}
          {(summaries.length > 0 || cardBalesCount > 0 || filmsBaleCount > 0 || papersDolavCount > 0 || glassDolavCount > 0 || scrapMetalLooseCount > 0) ? (
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
              palletChargeRatePerTonne={palletChargeRatePerTonne}
              cardBalesRatePerTonne={cardBalesRatePerTonne}
              filmsRatePerTonne={filmsRatePerTonne}
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No items have been added yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reconcile Section */}
      {canReconcile && (
        <div className="space-y-4">
          {isReconciled ? (
            <div className="flex items-center gap-3 rounded-lg border-2 border-green-500/50 bg-green-50/30 dark:bg-green-950/20 p-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">Reconciled & Completed</p>
                <p className="text-sm text-muted-foreground">
                  Weights adjusted to weighbridge ({Math.round(weighbridgeWeightKg!).toLocaleString()} kg)
                </p>
              </div>
            </div>
          ) : (
            <>
              <Button
                type="button"
                onClick={handleReconcile}
                className="h-12 w-full text-base gap-2"
                variant="outline"
                disabled={isSaving || !!weighbridgeLoading}
              >
                <Scale className="h-5 w-5" />
                Reconcile to Weighbridge ({Math.round(weighbridgeWeightKg!).toLocaleString()} kg)
              </Button>

              {/* Pallet reconciliation preview */}
              {reconciledPreview && reconciledSummaryData && (
                <Card className="border-2 border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Reconciled Preview</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Target: {Math.round(weighbridgeWeightKg!).toLocaleString()} kg · 
                      Reconciled: {(reconciledSummaryData.totalWeightKg + baleDolavTotalKg).toLocaleString()} kg
                      {(reconciledSummaryData.totalWeightKg + baleDolavTotalKg) !== (totalWeightKg + baleDolavTotalKg) && (
                        <span className="ml-1">
                          (was {(totalWeightKg + baleDolavTotalKg).toLocaleString()} kg)
                        </span>
                      )}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <StaciSummaryTable
                      summaries={reconciledSummaryData.summaries}
                      totalPallets={reconciledSummaryData.totalPallets}
                      totalWeightKg={reconciledSummaryData.totalWeightKg}
                      totalValue={reconciledSummaryData.totalValue}
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
                      palletChargeRatePerTonne={palletChargeRatePerTonne}
                      cardBalesRatePerTonne={cardBalesRatePerTonne}
                      filmsRatePerTonne={filmsRatePerTonne}
                    />
                    <Button
                      type="button"
                      className="w-full h-12 text-base"
                      onClick={handleAcceptReconciled}
                      disabled={isSaving}
                    >
                      Accept Reconciled Weights
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Bale/dolav-only reconciliation preview */}
              {reconciledBaleDolavPreview && !reconciledPreview && (
                <Card className="border-2 border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Reconciled Preview</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Target: {Math.round(weighbridgeWeightKg!).toLocaleString()} kg · 
                      Current: {baleDolavTotalKg.toLocaleString()} kg
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <StaciSummaryTable
                      summaries={[]}
                      totalPallets={0}
                      totalWeightKg={0}
                      totalValue={0}
                      goodPalletCount={goodPalletCount}
                      palletsScrapCount={palletsScrapCount}
                      cardBalesCount={cardBalesCount}
                      cardBalesWeightKg={reconciledBaleDolavPreview.cardBalesWeightKg}
                      filmsBaleCount={filmsBaleCount}
                      filmsBaleWeightKg={reconciledBaleDolavPreview.filmsBaleWeightKg}
                      papersDolavCount={papersDolavCount}
                      papersDolavWeightKg={reconciledBaleDolavPreview.papersDolavWeightKg}
                      glassDolavCount={glassDolavCount}
                      glassDolavWeightKg={reconciledBaleDolavPreview.glassDolavWeightKg}
                      scrapMetalLooseCount={scrapMetalLooseCount}
                      scrapMetalLooseWeightKg={reconciledBaleDolavPreview.scrapMetalLooseWeightKg}
                      palletWeightKg={palletWeightKg}
                      palletChargeRatePerTonne={palletChargeRatePerTonne}
                      cardBalesRatePerTonne={cardBalesRatePerTonne}
                      filmsRatePerTonne={filmsRatePerTonne}
                    />
                    <Button
                      type="button"
                      className="w-full h-12 text-base"
                      onClick={handleAcceptReconciled}
                      disabled={isSaving}
                    >
                      Accept Reconciled Weights
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

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
                disabled={isSaving || (palletEntries.length === 0 && papersDolavWeightKg === 0 && glassDolavWeightKg === 0 && cardBalesWeightKg === 0 && filmsBaleWeightKg === 0 && scrapMetalLooseWeightKg === 0)}
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
