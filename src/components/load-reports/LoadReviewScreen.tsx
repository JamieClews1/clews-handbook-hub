import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Save, Send, Truck, Scale } from "lucide-react";
import { LineItem } from "./TallyScreen";
import { Droplets } from "lucide-react";
import { reconcileLineItemsToTargetKg } from "@/lib/reconcile-load-line-items";
import { formatLoadReportDateLocale } from "@/lib/load-report-dates";

interface LoadReviewScreenProps {
  operatorName: string;
  vehicleReg: string;
  jobNumber: string;
  weighbridgeWeightKg?: number | null;
  rawWeighbridgeWeightKg?: number | null;
  palletsOutCount?: number;
  palletsOutAdjustmentKg?: number;
  cardboardPalletsIn?: number;
  cardboardIncomingKg?: number;
  weighbridgeLoading?: boolean;
  noPalletsOnLoad?: boolean;
  wetChargePercent?: number;
  rebateThresholdTonnes?: number;
  reportDate: string;
  lineItems: LineItem[];
  onAcceptReconciled?: (items: LineItem[]) => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  isReadOnly?: boolean;
  customerType?: "britvic" | "staci" | "vantiva" | "amazon" | "evri" | "other" | null;
}

export const LoadReviewScreen = ({
  operatorName,
  vehicleReg,
  jobNumber,
  weighbridgeWeightKg,
  rawWeighbridgeWeightKg,
  palletsOutCount = 0,
  palletsOutAdjustmentKg = 0,
  cardboardPalletsIn = 0,
  cardboardIncomingKg = 0,
  weighbridgeLoading,
  noPalletsOnLoad = false,
  wetChargePercent = 0,
  rebateThresholdTonnes = 0,
  reportDate,
  lineItems,
  onAcceptReconciled,
  onBack,
  onSaveDraft,
  onSubmit,
  isSaving,
  isReadOnly = false,
  customerType = null,
}: LoadReviewScreenProps) => {
  const [reconciledItems, setReconciledItems] = useState<LineItem[] | null>(null);

  const totalPallets = lineItems.reduce((sum, item) => sum + item.pallet_count, 0);
  const totalWeight = lineItems.reduce(
    (sum, item) => sum + item.pallet_count * item.avg_weight_kg,
    0
  );

  const reconcileSummary = useMemo(() => {
    if (typeof weighbridgeWeightKg !== "number") return null;
    if (!reconciledItems) return null;
    const targetTotalKg = Math.round(weighbridgeWeightKg);
    const reconciledTotalKg = Math.round(
      reconciledItems.reduce((sum, i) => sum + i.pallet_count * i.avg_weight_kg, 0)
    );
    return { targetTotalKg, reconciledTotalKg };
  }, [reconciledItems, weighbridgeWeightKg]);

  const getRowBgColor = (wasteType: string) => {
    const colors: Record<string, string> = {
      "Waste": "bg-red-100 dark:bg-red-950/30",
      "Wood": "bg-amber-100 dark:bg-amber-950/30",
    };
    return colors[wasteType] || "";
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Report Info Card */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Load Report Summary</CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatLoadReportDateLocale(reportDate, "en-GB", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Operator:</span>
            <span className="font-medium">{operatorName}</span>
          </div>
          {vehicleReg && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle:</span>
              <span className="font-medium">{vehicleReg}</span>
            </div>
          )}
          {jobNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Job Number:</span>
              <span className="font-medium">{jobNumber}</span>
            </div>
          )}

          {jobNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weighbridge Weight (kg):</span>
              <span className="font-medium">
                {weighbridgeLoading ? (
                  <span className="text-muted-foreground">Looking up…</span>
                ) : typeof weighbridgeWeightKg === "number" ? (
                  Math.round(weighbridgeWeightKg).toLocaleString()
                ) : (
                  <span className="text-muted-foreground">Not found</span>
                )}
              </span>
            </div>
          )}

          {(palletsOutAdjustmentKg > 0 || cardboardIncomingKg > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-xs space-y-1">
              {typeof rawWeighbridgeWeightKg === "number" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Midweigh weight (ignored):</span>
                  <span className="line-through">{Math.round(rawWeighbridgeWeightKg).toLocaleString()} kg</span>
                </div>
              )}
              {cardboardIncomingKg > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pallets In (cardboard):</span>
                  <span className="font-medium">{cardboardPalletsIn} × 90 kg = {cardboardIncomingKg.toLocaleString()} kg</span>
                </div>
              )}
              {palletsOutAdjustmentKg > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pallets Out (empty):</span>
                  <span className="font-medium">{palletsOutCount} × 20 kg = {palletsOutAdjustmentKg.toLocaleString()} kg</span>
                </div>
              )}
              <div className="flex justify-between border-t border-amber-300 dark:border-amber-700 pt-1 font-semibold">
                <span>Reconciliation target:</span>
                <span>{Math.round((weighbridgeWeightKg ?? 0)).toLocaleString()} kg</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tally Table */}
      <Card className="border-2 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold text-foreground">
                  Recyclable / Waste Type
                </TableHead>
                <TableHead className="text-center font-bold text-foreground">
                  Number of Pallets
                </TableHead>
                <TableHead className="text-center font-bold text-foreground">
                  Av Weight (KG)
                </TableHead>
                <TableHead className="text-right font-bold text-foreground">
                  Total Weight (KG)
                </TableHead>
                <TableHead className="text-right font-bold text-foreground">
                  Total Pallet Weight (KG)
                </TableHead>
                <TableHead className="text-right font-bold text-foreground">
                  Actual Recyclable/ Waste Weight (KG)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {lineItems.map((item) => {
                const totalWeight = item.pallet_count * item.avg_weight_kg;
                const totalPalletWeight = noPalletsOnLoad ? 0 : item.pallet_count * (item.pallet_weight_kg || 0);
                const actualWeight = totalWeight - totalPalletWeight;
                return (
                  <TableRow key={item.waste_type} className={getRowBgColor(item.waste_type)}>
                    <TableCell className="font-medium">{item.waste_type}</TableCell>
                    <TableCell className="text-center text-lg font-semibold">
                      {item.pallet_count}
                    </TableCell>
                    <TableCell className="text-center">{item.avg_weight_kg}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {totalWeight.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {totalPalletWeight.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {actualWeight.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Total Row */}
              <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                <TableCell className="font-bold text-primary">
                  TOTAL
                  {noPalletsOnLoad && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(no pallet deduction)</span>
                  )}
                </TableCell>
                <TableCell className="text-center text-xl font-bold text-primary">
                  {totalPallets}
                </TableCell>
                <TableCell />
                <TableCell className="text-right text-xl font-bold text-primary">
                  {totalWeight.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-xl font-bold text-primary">
                  {noPalletsOnLoad ? 0 : lineItems.reduce((sum, item) => sum + item.pallet_count * (item.pallet_weight_kg || 0), 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-xl font-bold text-primary">
                  {noPalletsOnLoad 
                    ? totalWeight.toLocaleString()
                    : lineItems.reduce((sum, item) => sum + (item.pallet_count * item.avg_weight_kg) - (item.pallet_count * (item.pallet_weight_kg || 0)), 0).toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Wet Charge Summary */}
      {wetChargePercent > 0 && (
        <Card className="border-2 border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Droplets className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">Contamination / Wet Charge</h4>
                <p className="text-sm text-muted-foreground">
                  {wetChargePercent}% discount applied to: {' '}
                  {lineItems
                    .filter((item) => item.wet_charge_applied && item.pallet_count > 0)
                    .map((item) => item.waste_type)
                    .join(', ') || 'None selected'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  -{wetChargePercent}%
                </div>
                <div className="text-xs text-muted-foreground">Rebate Discount</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weight Rebate Threshold Summary */}
      {rebateThresholdTonnes > 0 && (
        <Card className="border-2 border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">Weight Rebate Threshold</h4>
                <p className="text-sm text-muted-foreground">
                  Rebate paid after {rebateThresholdTonnes}t on: {' '}
                  {lineItems
                    .filter((item) => item.rebate_threshold_applied && item.pallet_count > 0)
                    .map((item) => item.waste_type)
                    .join(', ') || 'None selected'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  -{rebateThresholdTonnes}t
                </div>
                <div className="text-xs text-muted-foreground">No rebate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconcile */}
      {!isReadOnly && typeof weighbridgeWeightKg === "number" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              onClick={() => {
                const result = reconcileLineItemsToTargetKg(lineItems, weighbridgeWeightKg);
                setReconciledItems(result.reconciled);
              }}
              className="h-12 w-full text-base flex-1"
              disabled={isSaving || !!weighbridgeLoading}
            >
              Reconcile
            </Button>
            {customerType === "evri" && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = reconcileLineItemsToTargetKg(lineItems, weighbridgeWeightKg);
                  onAcceptReconciled?.(result.reconciled);
                  setReconciledItems(null);
                }}
                className="h-12 w-full text-base flex-1"
                disabled={isSaving || !!weighbridgeLoading || !onAcceptReconciled}
              >
                Auto Reconcile
              </Button>
            )}
          </div>

          {!!reconciledItems && (
            <Card className="border-2 overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reconciled figures</CardTitle>
                {reconcileSummary && (
                  <p className="text-sm text-muted-foreground">
                    Target: {reconcileSummary.targetTotalKg.toLocaleString()} kg · Reconciled: {reconcileSummary.reconciledTotalKg.toLocaleString()} kg
                  </p>
                )}
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold text-foreground">
                        Recyclable / Waste Type
                      </TableHead>
                      <TableHead className="text-center font-bold text-foreground">
                        Number of Pallets
                      </TableHead>
                      <TableHead className="text-center font-bold text-foreground">
                        Av Weight (KG)
                      </TableHead>
                      <TableHead className="text-right font-bold text-foreground">
                        Total Weight (KG)
                      </TableHead>
                      <TableHead className="text-right font-bold text-foreground">
                        Total Pallet Weight (KG)
                      </TableHead>
                      <TableHead className="text-right font-bold text-foreground">
                        Actual Recyclable/ Waste Weight (KG)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciledItems.map((item) => {
                      const totalW = Math.round(item.pallet_count * item.avg_weight_kg);
                      const totalPalletWeight =
                        item.pallet_count * (item.pallet_weight_kg || 0);
                      const actualWeight = totalW - totalPalletWeight;
                      return (
                        <TableRow
                          key={`reconciled-${item.waste_type}`}
                          className={getRowBgColor(item.waste_type)}
                        >
                          <TableCell className="font-medium">{item.waste_type}</TableCell>
                          <TableCell className="text-center text-lg font-semibold">
                            {item.pallet_count}
                          </TableCell>
                          <TableCell className="text-center">{item.avg_weight_kg}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {totalW.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {totalPalletWeight.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {actualWeight.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                      <TableCell className="font-bold text-primary">TOTAL</TableCell>
                      <TableCell className="text-center text-xl font-bold text-primary">
                        {reconciledItems.reduce((sum, i) => sum + i.pallet_count, 0)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right text-xl font-bold text-primary">
                        {Math.round(
                          reconciledItems.reduce(
                            (sum, i) => sum + i.pallet_count * i.avg_weight_kg,
                            0
                          )
                        ).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xl font-bold text-primary">
                        {reconciledItems
                          .reduce(
                            (sum, i) => sum + i.pallet_count * (i.pallet_weight_kg || 0),
                            0
                          )
                          .toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xl font-bold text-primary">
                        {Math.round(
                          reconciledItems.reduce((sum, i) => {
                            const t = i.pallet_count * i.avg_weight_kg;
                            const p = i.pallet_count * (i.pallet_weight_kg || 0);
                            return sum + (t - p);
                          }, 0)
                        ).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <CardContent className="pt-4">
                <Button
                  type="button"
                  className="w-full h-12 text-base"
                  disabled={!onAcceptReconciled || isSaving}
                  onClick={() => {
                    onAcceptReconciled?.(reconciledItems);
                    setReconciledItems(null);
                  }}
                >
                  Accept reconciled
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-14 text-base gap-2 flex-1"
            disabled={isSaving}
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Tally
          </Button>
          <Button
            variant="secondary"
            onClick={onSaveDraft}
            className="h-14 text-base gap-2 flex-1"
            disabled={isSaving}
          >
            <Save className="h-5 w-5" />
            Save Draft
          </Button>
          <Button
            onClick={onSubmit}
            className="h-14 text-base gap-2 flex-1"
            disabled={isSaving}
          >
            <Send className="h-5 w-5" />
            Submit Load
          </Button>
        </div>
      )}
    </div>
  );
};
