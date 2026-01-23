import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, ArrowRight, RefreshCw } from "lucide-react";

interface NewLoadFormProps {
  operatorName: string;
  vehicleReg: string;
  jobNumber: string;
  onOperatorNameChange: (value: string) => void;
  onVehicleRegChange: (value: string) => void;
  onJobNumberChange: (value: string) => void;
  weighbridgeWeightKg?: number | null;
  weighbridgeLoading?: boolean;
  onLookupWeighbridgeWeight?: () => void;
  onStartTally: () => void;
  isValid: boolean;
}

export const NewLoadForm = ({
  operatorName,
  vehicleReg,
  jobNumber,
  onOperatorNameChange,
  onVehicleRegChange,
  onJobNumberChange,
  weighbridgeWeightKg,
  weighbridgeLoading,
  onLookupWeighbridgeWeight,
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
            <Label htmlFor="jobNumber" className="text-base font-medium">
              Job Number
            </Label>
            <Input
              id="jobNumber"
              value={jobNumber}
              onChange={(e) => onJobNumberChange(e.target.value)}
              placeholder="Enter job number"
              className="h-14 text-lg"
              autoComplete="off"
            />

            {jobNumber.trim().length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Weighbridge Weight (kg)</span>
                  <span className="font-medium text-foreground">
                    {weighbridgeLoading ? (
                      <span className="text-muted-foreground">Looking up…</span>
                    ) : typeof weighbridgeWeightKg === "number" ? (
                      `${Math.round(weighbridgeWeightKg).toLocaleString()} kg`
                    ) : (
                      <span className="text-muted-foreground">Not found</span>
                    )}
                  </span>
                </div>

                {!!onLookupWeighbridgeWeight && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onLookupWeighbridgeWeight}
                      disabled={!jobNumber.trim() || !!weighbridgeLoading}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh weight
                    </Button>
                  </div>
                )}
              </div>
            )}
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
