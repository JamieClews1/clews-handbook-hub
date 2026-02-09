import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { StaciColourSummary, STACI_COLOUR_CONFIG, STACI_PALLET_GOOD_REBATE } from "./types";

interface StaciSummaryTableProps {
  summaries: StaciColourSummary[];
  totalPallets: number;
  totalWeightKg: number;
  totalValue: number;
  goodPalletCount?: number;
}

export const StaciSummaryTable = ({
  summaries,
  totalPallets,
  totalWeightKg,
  totalValue,
  goodPalletCount = 0,
}: StaciSummaryTableProps) => {
  const palletRebate = goodPalletCount * STACI_PALLET_GOOD_REBATE;
  const netTotal = totalValue - palletRebate;

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Colour</TableHead>
            <TableHead className="text-right">Pallets</TableHead>
            <TableHead className="text-right">Weight (KG)</TableHead>
            <TableHead className="text-right">Rate/Pallet</TableHead>
            <TableHead className="text-right">Value (£)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((summary) => {
            const config = STACI_COLOUR_CONFIG[summary.colour];
            const isRebate = summary.ratePerPallet < 0;
            return (
              <TableRow key={summary.colour}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${config.bgColor}`} />
                    <span className="font-medium">{config.label}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {summary.palletCount}
                </TableCell>
                <TableCell className="text-right">
                  {summary.totalWeightKg.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {isRebate ? (
                    <span className="text-green-600">-£{Math.abs(summary.ratePerPallet).toFixed(2)}</span>
                  ) : (
                    `£${summary.ratePerPallet.toFixed(2)}`
                  )}
                </TableCell>
                <TableCell className={`text-right font-medium ${summary.totalValue < 0 ? "text-green-600" : ""}`}>
                  {summary.totalValue < 0 ? "-" : ""}£{Math.abs(summary.totalValue).toFixed(2)}
                </TableCell>
              </TableRow>
            );
          })}
          {goodPalletCount > 0 && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Good Pallet Rebate</span>
              </TableCell>
              <TableCell className="text-right font-medium text-green-600">
                {goodPalletCount}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right text-green-600">
                -£{STACI_PALLET_GOOD_REBATE.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-medium text-green-600">
                -£{palletRebate.toFixed(2)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted font-bold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totalPallets}</TableCell>
            <TableCell className="text-right">{totalWeightKg.toLocaleString()}</TableCell>
            <TableCell className="text-right">-</TableCell>
            <TableCell className={`text-right ${netTotal < 0 ? "text-green-600" : ""}`}>
              {netTotal < 0 ? "-" : ""}£{Math.abs(netTotal).toFixed(2)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};
