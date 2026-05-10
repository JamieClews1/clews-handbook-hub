import { TallyCard } from "./TallyCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Package, Droplets, Scale, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface LineItem {
  waste_type: string;
  pallet_count: number;
  avg_weight_kg: number;
  total_weight_kg: number;
  display_order: number;
  pallet_weight_kg: number;
  wet_charge_applied?: boolean;
}

interface TallyScreenProps {
  lineItems: LineItem[];
  onLineItemChange: (index: number, updates: Partial<LineItem>) => void;
  onBack: () => void;
  onReview: () => void;
  customerType?: string | null;
  palletsOut?: number;
  onPalletsOutChange?: (count: number) => void;
  wetChargePercent?: number;
  onWetChargePercentChange?: (percent: number) => void;
  weighbridgeWeightKg?: number | null;
}

export const TallyScreen = ({
  lineItems,
  onLineItemChange,
  onBack,
  onReview,
  customerType,
  palletsOut = 0,
  onPalletsOutChange,
  wetChargePercent = 0,
  onWetChargePercentChange,
  weighbridgeWeightKg,
}: TallyScreenProps) => {
  const totalPallets = lineItems.reduce((sum, item) => sum + item.pallet_count, 0);
  const totalWeight = lineItems.reduce((sum, item) => sum + (item.pallet_count * item.avg_weight_kg), 0);

  const isEvri = customerType === "evri";

  // For Evri: find the first cardboard line item to drive "Pallets In"
  const cardboardIndex = isEvri
    ? lineItems.findIndex((i) => i.waste_type.toLowerCase().includes("card"))
    : -1;
  const palletsIn =
    cardboardIndex >= 0 ? lineItems[cardboardIndex].pallet_count : 0;

  const updatePalletsIn = (count: number) => {
    if (cardboardIndex < 0) return;
    const item = lineItems[cardboardIndex];
    const avg = item.avg_weight_kg || 90;
    onLineItemChange(cardboardIndex, {
      pallet_count: count,
      avg_weight_kg: avg,
      total_weight_kg: count * avg,
    });
  };

  const evriPalletsCard = isEvri && onPalletsOutChange ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card className="border-2 border-primary/40 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <Label htmlFor="palletsIn" className="text-base font-semibold text-foreground">
                Pallets In
              </Label>
              <p className="text-sm text-muted-foreground">Cardboard pallets delivered (90 kg each)</p>
            </div>
            <Input
              id="palletsIn"
              type="number"
              min={0}
              value={palletsIn}
              onChange={(e) => updatePalletsIn(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 h-14 text-center text-2xl font-bold"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <Label htmlFor="palletsOut" className="text-base font-semibold text-foreground">
                Pallets Out
              </Label>
              <p className="text-sm text-muted-foreground">Empty pallets loaded on truck</p>
            </div>
            <Input
              id="palletsOut"
              type="number"
              min={0}
              value={palletsOut}
              onChange={(e) => onPalletsOutChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24 h-14 text-center text-2xl font-bold"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  ) : null;

  return (
    <div className="space-y-4 pb-40 sm:pb-32">
      {/* Evri simplified: Pallets In + Pallets Out at top */}
      {evriPalletsCard}

      {/* Tally Cards Grid (hidden under "Other" for Evri) */}
      {isEvri ? (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 border border-dashed border-border rounded-lg">
            <ChevronDown className="h-4 w-4" />
            Other materials & contamination
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lineItems.map((item, index) => (
                <TallyCard
                  key={item.waste_type}
                  wasteType={item.waste_type}
                  palletCount={item.pallet_count}
                  avgWeight={item.avg_weight_kg}
                  onPalletChange={(count) => {
                    onLineItemChange(index, {
                      pallet_count: count,
                      total_weight_kg: count * item.avg_weight_kg,
                    });
                  }}
                  onWeightChange={(weight) => {
                    onLineItemChange(index, {
                      avg_weight_kg: weight,
                      total_weight_kg: item.pallet_count * weight,
                    });
                  }}
                />
              ))}
            </div>
            {wetChargeSection}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lineItems.map((item, index) => (
              <TallyCard
                key={item.waste_type}
                wasteType={item.waste_type}
                palletCount={item.pallet_count}
                avgWeight={item.avg_weight_kg}
                onPalletChange={(count) => {
                  onLineItemChange(index, {
                    pallet_count: count,
                    total_weight_kg: count * item.avg_weight_kg,
                  });
                }}
                onWeightChange={(weight) => {
                  onLineItemChange(index, {
                    avg_weight_kg: weight,
                    total_weight_kg: item.pallet_count * weight,
                  });
                }}
              />
            ))}
          </div>
        </>
      )}


      {!isEvri && wetChargeSection}

      {/* Fixed Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-lg p-4 z-50">
        <div className="container mx-auto max-w-5xl">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onBack}
                className="h-12 px-4 gap-2 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </Button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-center gap-3 sm:gap-6 text-center overflow-x-auto px-1">
                  <div className="min-w-[70px]">
                    <div className="text-xl sm:text-2xl font-bold text-foreground whitespace-nowrap">{totalPallets}</div>
                    <div className="text-xs text-muted-foreground">Pallets</div>
                  </div>
                  <div className="w-px h-10 bg-border shrink-0" />
                  <div className="min-w-[95px]">
                    <div className="text-xl sm:text-2xl font-bold text-primary whitespace-nowrap">{totalWeight.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total KG</div>
                  </div>
                  {weighbridgeWeightKg != null && (
                    <>
                      <div className="w-px h-10 bg-border shrink-0" />
                      <div className="min-w-[95px]">
                        <div className={`text-xl sm:text-2xl font-bold whitespace-nowrap ${
                          Math.abs(totalWeight - weighbridgeWeightKg) <= 50
                            ? "text-green-600"
                            : "text-orange-500"
                        }`}>
                          {totalWeight - weighbridgeWeightKg > 0 ? "+" : ""}
                          {(totalWeight - weighbridgeWeightKg).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center whitespace-nowrap">
                          <Scale className="h-3 w-3" />
                          vs Verified
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Button
                onClick={onReview}
                className="hidden sm:inline-flex h-12 px-6 gap-2 text-base font-semibold shrink-0"
              >
                Review
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

            <Button
              onClick={onReview}
              className="sm:hidden w-full h-12 gap-2 text-base font-semibold"
            >
              Review
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
