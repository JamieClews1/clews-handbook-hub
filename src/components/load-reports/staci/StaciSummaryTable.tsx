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
  cardBalesWeightKg?: number; // per-unit weight
  filmsBaleCount?: number;
  filmsBaleWeightKg?: number; // per-unit weight
  papersDolavCount?: number;
  papersDolavWeightKg?: number; // per-unit weight
  glassDolavCount?: number;
  glassDolavWeightKg?: number; // per-unit weight
  palletWeightKg?: number;
  palletChargeRatePerTonne?: number;
  cardBalesRatePerTonne?: number;
  filmsRatePerTonne?: number;
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
  papersDolavCount = 0,
  papersDolavWeightKg = 0,
  glassDolavCount = 0,
  glassDolavWeightKg = 0,
  palletWeightKg = 20,
  palletChargeRatePerTonne = 0,
  cardBalesRatePerTonne = 0,
  filmsRatePerTonne = 0,
}: StaciSummaryTableProps) => {
  const palletRebate = goodPalletCount * STACI_PALLET_GOOD_REBATE;
  const totalPalletDeductionKg = totalPallets * palletWeightKg;
  const totalNetWeightKg = totalWeightKg - totalPalletDeductionKg;
  const palletChargeValue = palletChargeRatePerTonne !== 0 ? (totalPalletDeductionKg / 1000) * palletChargeRatePerTonne : 0;

  // Calculate gross weights for bales/dolavs (stored value is per-unit)
  const cardBalesGrossKg = cardBalesCount * cardBalesWeightKg;
  const filmsBaleGrossKg = filmsBaleCount * filmsBaleWeightKg;
  const papersDolavGrossKg = papersDolavCount * papersDolavWeightKg;
  const glassDolavGrossKg = glassDolavCount * glassDolavWeightKg;

  // Calculate bale values from rates
  const cardBalesValue = cardBalesRatePerTonne !== 0 ? (cardBalesGrossKg / 1000) * cardBalesRatePerTonne : 0;
  const filmsBaleValue = filmsRatePerTonne !== 0 ? (filmsBaleGrossKg / 1000) * filmsRatePerTonne : 0;

  const netTotal = totalValue - palletRebate + palletChargeValue + cardBalesValue + filmsBaleValue;

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
          {palletChargeRatePerTonne !== 0 && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Pallet charge</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {totalPallets}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">
                {totalPalletDeductionKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">
                £{Math.abs(palletChargeRatePerTonne).toFixed(2)}/tonne
              </TableCell>
              <TableCell className="text-right font-medium">
                {palletChargeValue.toFixed(2)}
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
                {cardBalesGrossKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{cardBalesGrossKg.toLocaleString()}</TableCell>
              <TableCell className="text-right">
                {cardBalesRatePerTonne !== 0 ? `£${Math.abs(cardBalesRatePerTonne).toFixed(2)}/t` : "-"}
              </TableCell>
              <TableCell className={`text-right font-medium ${cardBalesValue < 0 ? "text-green-600" : ""}`}>
                {cardBalesValue !== 0 ? (
                  <>{cardBalesValue < 0 ? "-" : ""}£{Math.abs(cardBalesValue).toFixed(2)}</>
                ) : "-"}
              </TableCell>
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
                {filmsBaleGrossKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{filmsBaleGrossKg.toLocaleString()}</TableCell>
              <TableCell className="text-right">
                {filmsRatePerTonne !== 0 ? `£${Math.abs(filmsRatePerTonne).toFixed(2)}/t` : "-"}
              </TableCell>
              <TableCell className={`text-right font-medium ${filmsBaleValue < 0 ? "text-green-600" : ""}`}>
                {filmsBaleValue !== 0 ? (
                  <>{filmsBaleValue < 0 ? "-" : ""}£{Math.abs(filmsBaleValue).toFixed(2)}</>
                ) : "-"}
              </TableCell>
            </TableRow>
          )}
          {papersDolavCount > 0 && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Papers Dolav</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {papersDolavCount}
              </TableCell>
              <TableCell className="text-right">
                {papersDolavGrossKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{papersDolavGrossKg.toLocaleString()}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right font-medium">-</TableCell>
            </TableRow>
          )}
          {glassDolavCount > 0 && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Glass Dolav</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {glassDolavCount}
              </TableCell>
              <TableCell className="text-right">
                {glassDolavGrossKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">{glassDolavGrossKg.toLocaleString()}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right font-medium">-</TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted font-bold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totalPallets + cardBalesCount + filmsBaleCount + papersDolavCount + glassDolavCount}</TableCell>
            <TableCell className="text-right">{(totalWeightKg + cardBalesGrossKg + filmsBaleGrossKg + papersDolavGrossKg + glassDolavGrossKg).toLocaleString()}</TableCell>
            <TableCell className="text-right">{totalPalletDeductionKg.toLocaleString()}</TableCell>
            <TableCell className="text-right">{(totalNetWeightKg + cardBalesGrossKg + filmsBaleGrossKg + papersDolavGrossKg + glassDolavGrossKg).toLocaleString()}</TableCell>
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
