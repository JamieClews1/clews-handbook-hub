import { TallyCard } from "./TallyCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Package } from "lucide-react";

export interface LineItem {
  waste_type: string;
  pallet_count: number;
  avg_weight_kg: number;
  total_weight_kg: number;
  display_order: number;
  pallet_weight_kg: number;
}

interface TallyScreenProps {
  lineItems: LineItem[];
  onLineItemChange: (index: number, updates: Partial<LineItem>) => void;
  onBack: () => void;
  onReview: () => void;
  customerType?: string | null;
  palletsOut?: number;
  onPalletsOutChange?: (count: number) => void;
}

export const TallyScreen = ({
  lineItems,
  onLineItemChange,
  onBack,
  onReview,
  customerType,
  palletsOut = 0,
  onPalletsOutChange,
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
