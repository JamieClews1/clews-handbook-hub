import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  StaciWasteBreakdown,
  WASTE_TYPE_LABELS,
  getTotalPercentage,
  getRecyclablePercentage,
  getNonRecyclablePercentage,
} from "./types";

interface StaciWasteBreakdownInputProps {
  breakdown: StaciWasteBreakdown;
  onChange: (breakdown: StaciWasteBreakdown) => void;
}

export const StaciWasteBreakdownInput = ({
  breakdown,
  onChange,
}: StaciWasteBreakdownInputProps) => {
  const totalPct = getTotalPercentage(breakdown);
  const recyclablePct = getRecyclablePercentage(breakdown);
  const nonRecyclablePct = getNonRecyclablePercentage(breakdown);
  const isValid = Math.abs(totalPct - 100) < 0.01;
  const isOverflow = totalPct > 100;

  const handleChange = (key: keyof StaciWasteBreakdown, value: string) => {
    const numValue = Math.max(0, Math.min(100, parseFloat(value) || 0));
    onChange({ ...breakdown, [key]: numValue });
  };

  // Group waste types for better layout
  const recyclableTypes: (keyof StaciWasteBreakdown)[] = [
    "metal", "paper", "card", "hard_plastic", "shrink_wrap", "other_films_plastics"
  ];
  const otherTypes: (keyof StaciWasteBreakdown)[] = [
    "pvc", "rdf", "wood", "landfill"
  ];

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total:</span>
          <span className={`font-semibold ${isOverflow ? "text-destructive" : isValid ? "text-green-600" : "text-orange-500"}`}>
            {totalPct.toFixed(0)}%
          </span>
        </div>
        <Progress 
          value={Math.min(totalPct, 100)} 
          className={`h-2 ${isOverflow ? "[&>div]:bg-destructive" : isValid ? "[&>div]:bg-green-600" : ""}`}
        />
        {!isValid && (
          <p className={`text-xs ${isOverflow ? "text-destructive" : "text-orange-500"}`}>
            {isOverflow ? `Over by ${(totalPct - 100).toFixed(0)}%` : `${(100 - totalPct).toFixed(0)}% remaining`}
          </p>
        )}
      </div>

      {/* Recyclable summary */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Recyclable: {recyclablePct.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Non-recyclable: {nonRecyclablePct.toFixed(0)}%</span>
        </div>
        {breakdown.wood > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-600" />
            <span>Wood: {breakdown.wood.toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* Recyclable materials */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-green-700 dark:text-green-400">Recyclable Materials</Label>
        <div className="grid grid-cols-3 gap-2">
          {recyclableTypes.map((key) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key} className="text-xs text-muted-foreground">
                {WASTE_TYPE_LABELS[key]}
              </Label>
              <div className="relative">
                <Input
                  id={key}
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={breakdown[key] || ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="h-9 pr-6 text-sm"
                  placeholder="0"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Other materials */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-red-700 dark:text-red-400">Non-Recyclable / Other</Label>
        <div className="grid grid-cols-4 gap-2">
          {otherTypes.map((key) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key} className="text-xs text-muted-foreground">
                {WASTE_TYPE_LABELS[key]}
              </Label>
              <div className="relative">
                <Input
                  id={key}
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={breakdown[key] || ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="h-9 pr-6 text-sm"
                  placeholder="0"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
