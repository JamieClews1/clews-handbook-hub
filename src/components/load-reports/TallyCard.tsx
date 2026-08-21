import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Camera } from "lucide-react";

interface TallyCardProps {
  wasteType: string;
  palletCount: number;
  avgWeight: number;
  onPalletChange: (count: number) => void;
  onWeightChange: (weight: number) => void;
  onAddPhoto?: () => void;
  colorClass?: string;
}

export const TallyCard = ({
  wasteType,
  palletCount,
  avgWeight,
  onPalletChange,
  onWeightChange,
  onAddPhoto,
  colorClass = "bg-primary",
}: TallyCardProps) => {
  const totalWeight = palletCount * avgWeight;
  const [isEditingWeight, setIsEditingWeight] = useState(false);

  const handleDecrement = () => {
    if (palletCount > 0) {
      onPalletChange(palletCount - 1);
    }
  };

  const handleIncrement = () => {
    onPalletChange(palletCount + 1);
  };

  const getWasteTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      "Card Bales": "from-blue-500 to-blue-600",
      "Card Loose": "from-cyan-500 to-cyan-600",
      "Paper": "from-emerald-500 to-emerald-600",
      "Paper Tubes": "from-teal-500 to-teal-600",
      "Waste": "from-red-500 to-red-600",
      "Wood": "from-amber-600 to-amber-700",
      "Pallets of PET": "from-indigo-500 to-indigo-600",
      "Cans": "from-violet-500 to-violet-600",
    };
    return colors[type] || "from-gray-500 to-gray-600";
  };

  return (
    <Card className="overflow-hidden border-2 border-border shadow-lg">
      {/* Header with waste type */}
      <div className={`bg-gradient-to-r ${getWasteTypeColor(wasteType)} px-4 py-3`}>
        <h3 className="text-lg font-bold text-white text-center tracking-wide">
          {wasteType}
        </h3>
      </div>
      
      <CardContent className="p-4 space-y-4">
        {/* Pallet Counter - Large touch targets */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDecrement}
            disabled={palletCount === 0}
            className="h-16 w-16 text-3xl font-bold rounded-xl border-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive active:scale-95 transition-transform"
          >
            <Minus className="h-8 w-8" />
          </Button>
          
          <div className="w-24 h-20 flex items-center justify-center bg-muted rounded-xl border-2 border-border">
            <span className="text-4xl font-bold text-foreground">{palletCount}</span>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleIncrement}
            className="h-16 w-16 text-3xl font-bold rounded-xl border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary active:scale-95 transition-transform"
          >
            <Plus className="h-8 w-8" />
          </Button>
        </div>

        {/* Weight Input */}
        <div className="flex items-center justify-between gap-4 bg-muted/50 rounded-xl p-3">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Avg Weight (KG):
          </label>
          {isEditingWeight ? (
            <Input
              type="number"
              value={avgWeight}
              onChange={(e) => onWeightChange(Number(e.target.value) || 0)}
              onBlur={() => setIsEditingWeight(false)}
              autoFocus
              className="w-24 h-10 text-center text-lg font-semibold"
              min={0}
            />
          ) : (
            <button
              onClick={() => setIsEditingWeight(true)}
              className="w-24 h-10 bg-background border-2 border-border rounded-lg text-lg font-semibold text-foreground hover:border-primary transition-colors"
            >
              {avgWeight}
            </button>
          )}
        </div>

        {/* Total Weight Display */}
        <div className="flex items-center justify-between bg-primary/10 rounded-xl p-3 border border-primary/20">
          <span className="text-sm font-medium text-muted-foreground">Total Weight:</span>
          <span className="text-xl font-bold text-primary">{totalWeight.toLocaleString()} KG</span>
        </div>

        {/* Photo button */}
        {onAddPhoto && (
          <Button
            variant="outline"
            size="lg"
            onClick={onAddPhoto}
            className="w-full h-12 gap-2 text-base"
          >
            <Camera className="h-5 w-5" />
            Add Photo
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
