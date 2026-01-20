import { TallyCard } from "./TallyCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";

export interface LineItem {
  waste_type: string;
  pallet_count: number;
  avg_weight_kg: number;
  total_weight_kg: number;
  display_order: number;
}

interface TallyScreenProps {
  lineItems: LineItem[];
  onLineItemChange: (index: number, updates: Partial<LineItem>) => void;
  onBack: () => void;
  onReview: () => void;
}

export const TallyScreen = ({
  lineItems,
  onLineItemChange,
  onBack,
  onReview,
}: TallyScreenProps) => {
  const totalPallets = lineItems.reduce((sum, item) => sum + item.pallet_count, 0);
  const totalWeight = lineItems.reduce((sum, item) => sum + (item.pallet_count * item.avg_weight_kg), 0);

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
