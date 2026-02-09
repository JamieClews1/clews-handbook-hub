import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { StaciPalletEntry, STACI_COLOUR_CONFIG } from "./types";

interface StaciPalletEntryCardProps {
  entry: StaciPalletEntry;
  index: number;
  onWeightChange: (weight: number) => void;
  onDelete: () => void;
}

export const StaciPalletEntryCard = ({
  entry,
  index,
  onWeightChange,
  onDelete,
}: StaciPalletEntryCardProps) => {
  const config = STACI_COLOUR_CONFIG[entry.colour];

  return (
    <Card className="overflow-hidden border shadow-sm">
      <div className={`${config.bgColor} px-3 py-2 flex items-center justify-between`}>
        <span className={`font-bold ${config.textColor}`}>
          #{index + 1} {config.label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className={`h-8 w-8 ${config.textColor} hover:bg-white/20`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Weight (KG):
          </label>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={entry.weight_kg || ""}
            onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
            className="h-12 text-lg font-semibold text-center flex-1"
            placeholder="0"
          />
        </div>
      </CardContent>
    </Card>
  );
};
