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
  palletsScrapCount?: number;
  cardBalesCount?: number;
  cardBalesWeightKg?: number;
  filmsBaleCount?: number;
  filmsBaleWeightKg?: number;
  palletWeightKg?: number;
}

export const StaciSummaryTable = ({
  summaries,
  totalPallets,
  totalWeightKg,
  totalValue,
  goodPalletCount = 0,
  palletsScrapCount = 0,
  cardBalesCount = 0,
  cardBalesWeightKg = 0,
  filmsBaleCount = 0,
  filmsBaleWeightKg = 0,
  palletWeightKg = 20,
}: StaciSummaryTableProps) => {
  const palletRebate = goodPalletCount * STACI_PALLET_GOOD_REBATE;
  const totalPalletDeductionKg = totalPallets * palletWeightKg;
  const totalNetWeightKg = totalWeightKg - totalPalletDeductionKg;
  const netTotal = totalValue - palletRebate;

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Colour</TableHead>
            <TableHead className="text-right">Pallets</TableHead>
            <TableHead className="text-right">Gross Weight (KG)</TableHead>
            <TableHead className="text-right">Pallet Weight (KG)</TableHead>
            <TableHead className="text-right">Net Weight (KG)</TableHead>
            <TableHead className="text-right">Rate/Pallet</TableHead>
            <TableHead className="text-right">Value (£)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((summary) => {
            const config = STACI_COLOUR_CONFIG[summary.colour];
            const isRebate = summary.ratePerPallet < 0;
            const palletDeduction = summary.palletCount * palletWeightKg;
            const netWeight = summary.totalWeightKg - palletDeduction;
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
                <TableCell className="text-right text-muted-foreground">
                  {palletDeduction.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {netWeight.toLocaleString()}
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
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right text-green-600">
                -£{STACI_PALLET_GOOD_REBATE.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-medium text-green-600">
                -£{palletRebate.toFixed(2)}
              </TableCell>
            </TableRow>
          )}
          {palletsScrapCount > 0 && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Pallets Scrap</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {palletsScrapCount}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">Charge</TableCell>
              <TableCell className="text-right font-medium">-</TableCell>
            </TableRow>
          )}
          {cardBalesCount > 0 && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Card Bales</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {cardBalesCount}
              </TableCell>
              <TableCell className="text-right">
                {cardBalesWeightKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{cardBalesWeightKg.toLocaleString()}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right font-medium">-</TableCell>
            </TableRow>
          )}
          {filmsBaleCount > 0 && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Films Bale</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {filmsBaleCount}
              </TableCell>
              <TableCell className="text-right">
                {filmsBaleWeightKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{filmsBaleWeightKg.toLocaleString()}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right font-medium">-</TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted font-bold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totalPallets}</TableCell>
            <TableCell className="text-right">{totalWeightKg.toLocaleString()}</TableCell>
            <TableCell className="text-right">{totalPalletDeductionKg.toLocaleString()}</TableCell>
            <TableCell className="text-right">{totalNetWeightKg.toLocaleString()}</TableCell>
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
