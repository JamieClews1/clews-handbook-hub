import { TallyCard } from "./TallyCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Package, Droplets } from "lucide-react";

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
}: TallyScreenProps) => {
  const totalPallets = lineItems.reduce((sum, item) => sum + item.pallet_count, 0);
  const totalWeight = lineItems.reduce((sum, item) => sum + (item.pallet_count * item.avg_weight_kg), 0);

  const isEvri = customerType === "evri";

  return (
    <div className="space-y-4 pb-32">
      {/* Tally Cards Grid */}
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

      {/* EVRi-specific: Pallets Out section */}
      {isEvri && onPalletsOutChange && (
        <Card className="border-2 border-amber-500/50 bg-amber-50/30">
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
      )}

      {/* Contamination/Wet Charge Section */}
      {onWetChargePercentChange && (
        <Card className="border-2 border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Droplets className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Contamination / Wet Charge</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Apply a % discount for materials not as described
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Percentage Input */}
            <div className="flex items-center gap-4">
              <Label htmlFor="wetChargePercent" className="text-sm font-medium whitespace-nowrap">
                Discount %
              </Label>
              <Input
                id="wetChargePercent"
                type="number"
                min={0}
                max={100}
                value={wetChargePercent}
                onChange={(e) => onWetChargePercentChange(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-24 h-12 text-center text-xl font-bold"
              />
              <span className="text-muted-foreground">%</span>
            </div>

            {/* Material Selection */}
            {wetChargePercent > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Apply to materials:</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {lineItems
                    .filter((item) => item.pallet_count > 0)
                    .map((item, idx) => {
                      const originalIndex = lineItems.findIndex(
                        (li) => li.waste_type === item.waste_type
                      );
                      return (
                        <div
                          key={item.waste_type}
                          className="flex items-center space-x-2 rounded-lg border border-border bg-background p-3"
                        >
                          <Checkbox
                            id={`wet-charge-${item.waste_type}`}
                            checked={item.wet_charge_applied || false}
                            onCheckedChange={(checked) =>
                              onLineItemChange(originalIndex, {
                                wet_charge_applied: checked === true,
                              })
                            }
                          />
                          <Label
                            htmlFor={`wet-charge-${item.waste_type}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {item.waste_type}
                          </Label>
                        </div>
                      );
                    })}
                </div>
                {lineItems.filter((item) => item.pallet_count > 0).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    Add pallets to materials above to apply the wet charge
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fixed Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-lg p-4 z-50">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={onBack}
              className="h-12 px-4 gap-2"
            >
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
                <div className="text-2xl font-bold text-primary">{totalWeight.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total KG</div>
              </div>
            </div>

            <Button
              onClick={onReview}
              className="h-12 px-6 gap-2 text-base"
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
