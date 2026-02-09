import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StaciPalletEntry,
  StaciWasteComposition,
  STACI_COLOUR_CONFIG,
  STACI_WASTE_COMPOSITION_OPTIONS,
  calculatePalletColour,
} from "./types";

interface StaciPalletEntryCardProps {
  entry: StaciPalletEntry;
  index: number;
  onDescriptionChange: (description: string) => void;
  onWeightChange: (weight: number) => void;
  onCompositionChange: (composition: StaciWasteComposition) => void;
  onDelete: () => void;
}

export const StaciPalletEntryCard = ({
  entry,
  index,
  onDescriptionChange,
  onWeightChange,
  onCompositionChange,
  onDelete,
}: StaciPalletEntryCardProps) => {
  const config = STACI_COLOUR_CONFIG[entry.colour];
  const calculatedColour = calculatePalletColour(entry.weight_kg, entry.waste_composition);
  const calculatedConfig = STACI_COLOUR_CONFIG[calculatedColour];

  return (
    <Card className="overflow-hidden border-2 shadow-sm">
      {/* Header with pallet number and delete */}
      <div className="bg-muted px-4 py-3 flex items-center justify-between border-b">
        <span className="font-bold text-lg">Pallet #{index + 1}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Description field */}
        <div className="space-y-2">
          <Label htmlFor={`desc-${entry.id}`} className="text-sm font-medium">
            Description / Contents
          </Label>
          <Input
            id={`desc-${entry.id}`}
            value={entry.description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="e.g. Cardboard, plastic film, shrink wrap..."
            className="h-11"
          />
        </div>

        {/* Weight and Composition in a row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`weight-${entry.id}`} className="text-sm font-medium">
              Weight (KG)
            </Label>
            <Input
              id={`weight-${entry.id}`}
              type="number"
              min={0}
              step={1}
              value={entry.weight_kg || ""}
              onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
              className="h-12 text-lg font-semibold text-center"
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Waste Composition</Label>
            <Select
              value={entry.waste_composition}
              onValueChange={(value) => onCompositionChange(value as StaciWasteComposition)}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {STACI_WASTE_COMPOSITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Auto-calculated colour indicator */}
        {entry.weight_kg > 0 && (
          <div className={`rounded-lg p-3 ${calculatedConfig.bgColor} ${calculatedConfig.textColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Auto-classified as</p>
                <p className="font-bold text-lg">{calculatedConfig.label}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-80">{calculatedConfig.description}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
