import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  StaciPalletEntry,
  StaciWasteBreakdown,
  WASTE_TYPE_LABELS,
  getTotalPercentage,
} from "./types";

interface StaciWasteTypeBreakdownTableProps {
  palletEntries: StaciPalletEntry[];
  palletWeightKg?: number;
  goodPalletCount?: number;
  palletsScrapCount?: number;
}

/**
 * Calculates a waste type breakdown across all pallet entries.
 * Each pallet's waste breakdown percentages are applied to the NET weight
 * (gross weight minus pallet tare). The pallet wood (tare) is then shown
 * as a separate "Wood (Pallet Tare)" line.
 */
export const StaciWasteTypeBreakdownTable = ({
  palletEntries,
  palletWeightKg = 20,
  goodPalletCount = 0,
  palletsScrapCount = 0,
}: StaciWasteTypeBreakdownTableProps) => {
  // Accumulate kg per waste type across all valid pallet entries
  const wasteTypeKg: Record<keyof StaciWasteBreakdown, number> = {
    metal: 0,
    scrap_metal: 0,
    paper: 0,
    card: 0,
    pvc: 0,
    hard_plastic: 0,
    shrink_wrap: 0,
    other_films_plastics: 0,
    rdf: 0,
    wood: 0,
    landfill: 0,
  };

  let totalNetMaterialKg = 0;
  let totalPalletTareKg = 0;

  for (const entry of palletEntries) {
    const breakdownTotal = getTotalPercentage(entry.waste_breakdown);
    const isValid = Math.abs(breakdownTotal - 100) < 0.01 && entry.weight_kg > 0;
    if (!isValid) continue;

    const palletCount = entry.pallet_count || 1;
    const grossWeightKg = entry.weight_kg * palletCount;
    const palletTareKg = palletCount * palletWeightKg;
    const netWeightKg = grossWeightKg - palletTareKg;

    totalPalletTareKg += palletTareKg;
    totalNetMaterialKg += netWeightKg;

    // Apply breakdown percentages to net weight
    for (const key of Object.keys(entry.waste_breakdown) as (keyof StaciWasteBreakdown)[]) {
      const pct = entry.waste_breakdown[key];
      if (pct > 0) {
        wasteTypeKg[key] += (pct / 100) * netWeightKg;
      }
    }
  }

  // Add good pallet and scrap pallet wood weight
  const goodPalletWoodKg = goodPalletCount * palletWeightKg;
  const scrapPalletWoodKg = palletsScrapCount * palletWeightKg;
  const totalPalletWoodKg = totalPalletTareKg + goodPalletWoodKg + scrapPalletWoodKg;

  // Build rows for display — only waste types with weight > 0
  const rows: { label: string; weightKg: number; isWood?: boolean }[] = [];

  for (const key of Object.keys(WASTE_TYPE_LABELS) as (keyof StaciWasteBreakdown)[]) {
    if (key === "wood") continue; // We'll handle wood separately
    const kg = wasteTypeKg[key];
    if (kg > 0.5) {
      rows.push({ label: WASTE_TYPE_LABELS[key], weightKg: Math.round(kg) });
    }
  }

  // Wood row = waste breakdown wood + all pallet tare wood
  const totalWoodKg = wasteTypeKg.wood + totalPalletWoodKg;
  if (totalWoodKg > 0.5) {
    rows.push({
      label: "Wood",
      weightKg: Math.round(totalWoodKg),
      isWood: true,
    });
  }

  const grandTotalKg = rows.reduce((sum, r) => sum + r.weightKg, 0);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Waste Type</TableHead>
            <TableHead className="text-right">Weight (KG)</TableHead>
            <TableHead className="text-right">% of Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>
                <span className="font-medium">{row.label}</span>
                {row.isWood && totalPalletWoodKg > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (incl. {Math.round(totalPalletWoodKg).toLocaleString()} kg pallet tare)
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-medium">
                {row.weightKg.toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {grandTotalKg > 0 ? ((row.weightKg / grandTotalKg) * 100).toFixed(1) : "0.0"}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-muted font-bold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{grandTotalKg.toLocaleString()}</TableCell>
            <TableCell className="text-right">100%</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};
