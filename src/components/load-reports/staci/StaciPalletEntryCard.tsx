import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StaciWasteBreakdownInput } from "./StaciWasteBreakdownInput";
import {
  StaciPalletEntry,
  StaciWasteBreakdown,
  STACI_COLOUR_CONFIG,
  calculatePalletColour,
  getTotalPercentage,
  getRecyclablePercentage,
  getNonRecyclablePercentage,
} from "./types";

interface StaciPalletEntryCardProps {
  entry: StaciPalletEntry;
  index: number;
  onDescriptionChange: (description: string) => void;
  onWeightChange: (weight: number) => void;
  onBreakdownChange: (breakdown: StaciWasteBreakdown) => void;
  onDelete: () => void;
}

export const StaciPalletEntryCard = ({
  entry,
  index,
  onDescriptionChange,
  onWeightChange,
  onBreakdownChange,
  onDelete,
}: StaciPalletEntryCardProps) => {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(true);
  
  const calculatedColour = calculatePalletColour(entry.weight_kg, entry.waste_breakdown);
  const calculatedConfig = STACI_COLOUR_CONFIG[calculatedColour];
  const totalPct = getTotalPercentage(entry.waste_breakdown);
  const isBreakdownValid = Math.abs(totalPct - 100) < 0.01;
  const recyclablePct = getRecyclablePercentage(entry.waste_breakdown);
  const nonRecyclablePct = getNonRecyclablePercentage(entry.waste_breakdown);

  return (
    <Card className="overflow-hidden border-2 shadow-sm">
      {/* Header with pallet number and delete */}
      <div className="bg-muted px-4 py-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">Pallet #{index + 1}</span>
          {entry.weight_kg > 0 && isBreakdownValid && (
            <div className={`px-2 py-0.5 rounded text-xs font-semibold ${calculatedConfig.bgColor} ${calculatedConfig.textColor}`}>
              {calculatedConfig.label}
            </div>
          )}
        </div>
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
        {/* Description and Weight row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`desc-${entry.id}`} className="text-sm font-medium">
              Description
            </Label>
            <Input
              id={`desc-${entry.id}`}
              value={entry.description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="e.g. Mixed recycling, cardboard..."
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`weight-${entry.id}`} className="text-sm font-medium">
              Est. Weight (KG)
            </Label>
            <Input
              id={`weight-${entry.id}`}
              type="number"
              min={0}
              step={10}
              value={entry.weight_kg || ""}
              onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
              className="h-11 text-lg font-semibold"
              placeholder="0"
            />
          </div>
        </div>

        {/* Waste breakdown collapsible */}
        <Collapsible open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-10 px-3">
              <span className="text-sm font-medium">
                Waste Breakdown
                {isBreakdownValid && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({recyclablePct.toFixed(0)}% recyclable)
                  </span>
                )}
              </span>
              {isBreakdownOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="rounded-lg border p-3 bg-muted/30">
              <StaciWasteBreakdownInput
                breakdown={entry.waste_breakdown}
                onChange={onBreakdownChange}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Auto-calculated colour indicator */}
        {entry.weight_kg > 0 && isBreakdownValid && (
          <div className={`rounded-lg p-3 ${calculatedConfig.bgColor} ${calculatedConfig.textColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Auto-classified as</p>
                <p className="font-bold text-lg">{calculatedConfig.label}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-80">{calculatedConfig.description}</p>
                <p className="text-sm font-medium mt-1">
                  Recyclable: {recyclablePct.toFixed(0)}% | Non-recyclable: {nonRecyclablePct.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warning if breakdown incomplete */}
        {!isBreakdownValid && totalPct > 0 && (
          <div className="rounded-lg p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
            <p className="text-sm">
              Waste breakdown must total 100% (currently {totalPct.toFixed(0)}%)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
