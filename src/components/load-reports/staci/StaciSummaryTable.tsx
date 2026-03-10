import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { StaciColourSummary, STACI_COLOUR_CONFIG, STACI_PALLET_GOOD_REBATE, STACI_PALLET_RATES } from "./types";

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
  scrapMetalLooseCount?: number;
  scrapMetalLooseWeightKg?: number; // per-unit weight
  palletWeightKg?: number;
  palletChargeRatePerTonne?: number;
  cardBalesRatePerTonne?: number;
  filmsRatePerTonne?: number;
  cardBalesOnPallets?: boolean;
  filmsBaleOnPallets?: boolean;
  papersDolavOnPallets?: boolean;
  glassDolavOnPallets?: boolean;
  scrapMetalLooseOnPallets?: boolean;
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
  scrapMetalLooseCount = 0,
  scrapMetalLooseWeightKg = 0,
  palletWeightKg = 20,
  palletChargeRatePerTonne = 0,
  cardBalesRatePerTonne = 0,
  filmsRatePerTonne = 0,
  cardBalesOnPallets = false,
  filmsBaleOnPallets = false,
  papersDolavOnPallets = false,
  glassDolavOnPallets = false,
  scrapMetalLooseOnPallets = false,
}: StaciSummaryTableProps) => {
  const palletRebate = goodPalletCount * STACI_PALLET_GOOD_REBATE;
  
  // Pallet weight from bale/dolav items marked "on pallets"
  const baleDolavPalletWeightKg = 
    (cardBalesOnPallets ? cardBalesCount * palletWeightKg : 0) +
    (filmsBaleOnPallets ? filmsBaleCount * palletWeightKg : 0) +
    (papersDolavOnPallets ? papersDolavCount * palletWeightKg : 0) +
    (glassDolavOnPallets ? glassDolavCount * palletWeightKg : 0) +
    (scrapMetalLooseOnPallets ? scrapMetalLooseCount * palletWeightKg : 0);
  
  const totalPalletDeductionKg = (totalPallets * palletWeightKg) + baleDolavPalletWeightKg;
  const totalNetWeightKg = totalWeightKg - (totalPallets * palletWeightKg);
  const palletChargeValue = palletChargeRatePerTonne !== 0 ? (totalPalletDeductionKg / 1000) * palletChargeRatePerTonne : 0;

  // Calculate gross weights for bales/dolavs (stored value is per-unit)
  const cardBalesGrossKg = cardBalesCount * cardBalesWeightKg;
  const filmsBaleGrossKg = filmsBaleCount * filmsBaleWeightKg;
  const papersDolavGrossKg = papersDolavCount * papersDolavWeightKg;
  const glassDolavGrossKg = glassDolavCount * glassDolavWeightKg;
  const scrapMetalLooseGrossKg = scrapMetalLooseCount * scrapMetalLooseWeightKg;

  // Net weights for bale/dolav items (deduct pallet weight if on pallets)
  const cardBalesNetKg = cardBalesGrossKg - (cardBalesOnPallets ? cardBalesCount * palletWeightKg : 0);
  const filmsBaleNetKg = filmsBaleGrossKg - (filmsBaleOnPallets ? filmsBaleCount * palletWeightKg : 0);
  const papersDolavNetKg = papersDolavGrossKg - (papersDolavOnPallets ? papersDolavCount * palletWeightKg : 0);
  const glassDolavNetKg = glassDolavGrossKg - (glassDolavOnPallets ? glassDolavCount * palletWeightKg : 0);
  const scrapMetalLooseNetKg = scrapMetalLooseGrossKg - (scrapMetalLooseOnPallets ? scrapMetalLooseCount * palletWeightKg : 0);

  // Calculate bale values from rates (using net weight for value calculation)
  const cardBalesValue = cardBalesRatePerTonne !== 0 ? (cardBalesNetKg / 1000) * cardBalesRatePerTonne : 0;
  const filmsBaleValue = filmsRatePerTonne !== 0 ? (filmsBaleNetKg / 1000) * filmsRatePerTonne : 0;

  // Scrap pallet charge (weight × pallet charge rate per tonne)
  const scrapPalletsWeightKg = palletsScrapCount * palletWeightKg;
  const scrapPalletChargeRate = Math.abs(palletChargeRatePerTonne !== 0 ? palletChargeRatePerTonne : STACI_PALLET_RATES["waste_wood"]);
  const scrapPalletChargeValue = (scrapPalletsWeightKg / 1000) * scrapPalletChargeRate;

  const netTotal = totalValue - palletRebate + palletChargeValue + cardBalesValue + filmsBaleValue + scrapPalletChargeValue;

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
              <TableCell className="text-right">
                {(goodPalletCount * palletWeightKg).toLocaleString()}
              </TableCell>
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
          {(palletChargeRatePerTonne !== 0 || baleDolavPalletWeightKg > 0) && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Pallet charge</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {totalPallets + (cardBalesOnPallets ? cardBalesCount : 0) + (filmsBaleOnPallets ? filmsBaleCount : 0) + (papersDolavOnPallets ? papersDolavCount : 0) + (glassDolavOnPallets ? glassDolavCount : 0) + (scrapMetalLooseOnPallets ? scrapMetalLooseCount : 0)}
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
              <TableCell className="text-right">
                {(palletsScrapCount * palletWeightKg).toLocaleString()}
              </TableCell>
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
              <TableCell className="text-right">{cardBalesOnPallets ? (cardBalesCount * palletWeightKg).toLocaleString() : "-"}</TableCell>
              <TableCell className="text-right">{cardBalesNetKg.toLocaleString()}</TableCell>
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
              <TableCell className="text-right">{filmsBaleOnPallets ? (filmsBaleCount * palletWeightKg).toLocaleString() : "-"}</TableCell>
              <TableCell className="text-right">{filmsBaleNetKg.toLocaleString()}</TableCell>
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
              <TableCell className="text-right">{papersDolavOnPallets ? (papersDolavCount * palletWeightKg).toLocaleString() : "-"}</TableCell>
              <TableCell className="text-right">{papersDolavNetKg.toLocaleString()}</TableCell>
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
              <TableCell className="text-right">{glassDolavOnPallets ? (glassDolavCount * palletWeightKg).toLocaleString() : "-"}</TableCell>
              <TableCell className="text-right">{glassDolavNetKg.toLocaleString()}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right font-medium">-</TableCell>
            </TableRow>
          )}
          {scrapMetalLooseCount > 0 && (
            <TableRow>
              <TableCell>
                <span className="text-muted-foreground">Scrap Metal Loose</span>
              </TableCell>
              <TableCell className="text-right font-medium">
                {scrapMetalLooseCount}
              </TableCell>
              <TableCell className="text-right">
                {scrapMetalLooseGrossKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">{scrapMetalLooseOnPallets ? (scrapMetalLooseCount * palletWeightKg).toLocaleString() : "-"}</TableCell>
              <TableCell className="text-right">{scrapMetalLooseNetKg.toLocaleString()}</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right font-medium">-</TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted font-bold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totalPallets + cardBalesCount + filmsBaleCount + papersDolavCount + glassDolavCount + scrapMetalLooseCount}</TableCell>
            <TableCell className="text-right">{(totalWeightKg + cardBalesGrossKg + filmsBaleGrossKg + papersDolavGrossKg + glassDolavGrossKg + scrapMetalLooseGrossKg).toLocaleString()}</TableCell>
            <TableCell className="text-right">{totalPalletDeductionKg.toLocaleString()}</TableCell>
            <TableCell className="text-right">{(totalNetWeightKg + cardBalesNetKg + filmsBaleNetKg + papersDolavNetKg + glassDolavNetKg + scrapMetalLooseNetKg).toLocaleString()}</TableCell>
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
