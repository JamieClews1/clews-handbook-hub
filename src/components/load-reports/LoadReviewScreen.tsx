import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Save, Send, Truck } from "lucide-react";
import { LineItem } from "./TallyScreen";

interface LoadReviewScreenProps {
  operatorName: string;
  vehicleReg: string;
  notes: string;
  reportDate: string;
  lineItems: LineItem[];
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  isReadOnly?: boolean;
}

export const LoadReviewScreen = ({
  operatorName,
  vehicleReg,
  notes,
  reportDate,
  lineItems,
  onBack,
  onSaveDraft,
  onSubmit,
  isSaving,
  isReadOnly = false,
}: LoadReviewScreenProps) => {
  const totalPallets = lineItems.reduce((sum, item) => sum + item.pallet_count, 0);
  const totalWeight = lineItems.reduce(
    (sum, item) => sum + item.pallet_count * item.avg_weight_kg,
    0
  );

  const getRowBgColor = (wasteType: string) => {
    const colors: Record<string, string> = {
      "Waste": "bg-red-100 dark:bg-red-950/30",
      "Wood": "bg-amber-100 dark:bg-amber-950/30",
    };
    return colors[wasteType] || "";
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Report Info Card */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Load Report Summary</CardTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(reportDate).toLocaleDateString("en-GB", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Operator:</span>
            <span className="font-medium">{operatorName}</span>
          </div>
          {vehicleReg && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle:</span>
              <span className="font-medium">{vehicleReg}</span>
            </div>
          )}
          {notes && (
            <div className="pt-2 border-t">
              <span className="text-muted-foreground">Notes:</span>
              <p className="mt-1 text-foreground">{notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tally Table */}
      <Card className="border-2 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold text-foreground">
                  Recyclable / Waste Type
                </TableHead>
                <TableHead className="text-center font-bold text-foreground">
                  Number of Pallets
                </TableHead>
                <TableHead className="text-center font-bold text-foreground">
                  Av Weight (KG)
                </TableHead>
                <TableHead className="text-right font-bold text-foreground">
                  Total Weight (KG)
                </TableHead>
                <TableHead className="text-right font-bold text-foreground">
                  Total Pallet Weight (KG)
                </TableHead>
                <TableHead className="text-right font-bold text-foreground">
                  Actual Recyclable/ Waste Weight (KG)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item) => {
                const totalPalletWeight = item.pallet_count * item.avg_weight_kg;
                const palletDeduction = item.pallet_count * (item.pallet_weight_kg || 0);
                const actualWeight = totalPalletWeight - palletDeduction;
                return (
                  <TableRow key={item.waste_type} className={getRowBgColor(item.waste_type)}>
                    <TableCell className="font-medium">{item.waste_type}</TableCell>
                    <TableCell className="text-center text-lg font-semibold">
                      {item.pallet_count}
                    </TableCell>
                    <TableCell className="text-center">{item.avg_weight_kg}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {totalPalletWeight.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {totalPalletWeight.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {actualWeight.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Total Row */}
              <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                <TableCell className="font-bold text-primary">TOTAL</TableCell>
                <TableCell className="text-center text-xl font-bold text-primary">
                  {totalPallets}
                </TableCell>
                <TableCell />
                <TableCell className="text-right text-xl font-bold text-primary">
                  {totalWeight.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-xl font-bold text-primary">
                  {lineItems.reduce((sum, item) => sum + item.pallet_count * (item.pallet_weight_kg || 0), 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-xl font-bold text-primary">
                  {lineItems.reduce((sum, item) => sum + (item.pallet_count * item.avg_weight_kg) - (item.pallet_count * (item.pallet_weight_kg || 0)), 0).toLocaleString()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Action Buttons */}
      {!isReadOnly && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-14 text-base gap-2 flex-1"
            disabled={isSaving}
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Tally
          </Button>
          <Button
            variant="secondary"
            onClick={onSaveDraft}
            className="h-14 text-base gap-2 flex-1"
            disabled={isSaving}
          >
            <Save className="h-5 w-5" />
            Save Draft
          </Button>
          <Button
            onClick={onSubmit}
            className="h-14 text-base gap-2 flex-1"
            disabled={isSaving}
          >
            <Send className="h-5 w-5" />
            Submit Load
          </Button>
        </div>
      )}
    </div>
  );
};
