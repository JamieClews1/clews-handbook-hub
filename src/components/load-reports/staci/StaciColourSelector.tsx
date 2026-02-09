import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StaciPalletColour, STACI_COLOUR_CONFIG, STACI_PALLET_RATES } from "./types";

interface StaciColourSelectorProps {
  onAddPallet: (colour: StaciPalletColour) => void;
}

export const StaciColourSelector = ({ onAddPallet }: StaciColourSelectorProps) => {
  const colours: StaciPalletColour[] = ["red", "yellow", "blue", "green", "waste_wood"];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Tap to add a pallet:</h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {colours.map((colour) => {
          const config = STACI_COLOUR_CONFIG[colour];
          const rate = STACI_PALLET_RATES[colour];
          const isRebate = rate < 0;

          return (
            <Button
              key={colour}
              onClick={() => onAddPallet(colour)}
              className={`h-auto py-4 flex flex-col items-center gap-1 ${config.bgColor} ${config.textColor} hover:opacity-90 active:scale-[0.98] transition-transform`}
            >
              <Plus className="h-5 w-5" />
              <span className="font-bold">{config.label}</span>
              <span className="text-xs opacity-80">
                {isRebate ? `-£${Math.abs(rate).toFixed(2)}` : `£${rate.toFixed(2)}`}/pallet
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
