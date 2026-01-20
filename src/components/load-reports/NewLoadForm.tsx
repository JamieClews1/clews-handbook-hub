import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Truck, ArrowRight } from "lucide-react";

interface NewLoadFormProps {
  operatorName: string;
  vehicleReg: string;
  notes: string;
  onOperatorNameChange: (value: string) => void;
  onVehicleRegChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onStartTally: () => void;
  isValid: boolean;
}

export const NewLoadForm = ({
  operatorName,
  vehicleReg,
  notes,
  onOperatorNameChange,
  onVehicleRegChange,
  onNotesChange,
  onStartTally,
  isValid,
}: NewLoadFormProps) => {
  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-xl">New Load Report</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="operator" className="text-base font-medium">
              Operator Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="operator"
              value={operatorName}
              onChange={(e) => onOperatorNameChange(e.target.value)}
              placeholder="Enter your name"
              className="h-14 text-lg"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle" className="text-base font-medium">
              Vehicle Registration
            </Label>
            <Input
              id="vehicle"
              value={vehicleReg}
              onChange={(e) => onVehicleRegChange(e.target.value.toUpperCase())}
              placeholder="e.g. AB12 CDE"
              className="h-14 text-lg uppercase"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-base font-medium">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Any additional notes about this load..."
              className="min-h-[100px] text-base"
            />
          </div>

          <Button
            onClick={onStartTally}
            disabled={!isValid}
            size="lg"
            className="w-full h-16 text-xl gap-3 mt-4"
          >
            Start Tally
            <ArrowRight className="h-6 w-6" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
