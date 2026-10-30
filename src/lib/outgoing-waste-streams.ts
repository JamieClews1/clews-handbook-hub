/** Groups outgoing loads by recorded product for residual codes, then EWC and description. */
const RESIDUAL_CODES = new Set(["19 12 12", "20 03 01", "20 03 07"]);

const EWC_STREAM: Record<string, string> = {
  "19 12 10": "Waste RDF",
  "19 12 07": "Wood",
  "19 12 06": "Wood",
  "15 01 03": "Wood",
  "17 02 01": "Wood",
  "20 01 38": "Wood",
  "19 12 01": "Paper / Card",
  "15 01 01": "Paper / Card",
  "20 01 01": "Paper / Card",
  "19 12 04": "Plastics",
  "15 01 02": "Plastics",
  "20 01 39": "Plastics",
  "17 02 03": "Plastics",
  "19 12 02": "Ferrous metal",
  "16 01 17": "Ferrous metal",
  "19 12 03": "Non-ferrous metal",
  "20 01 40": "Metals (mixed)",
  "17 04 07": "Metals (mixed)",
  "16 01 03": "Tyres",
  "17 08 02": "Plasterboard",
  "19 12 09": "Hardcore / Aggregates",
  "17 01 07": "Hardcore / Aggregates",
  "17 05 04": "Hardcore / Aggregates",
  "17 09 04": "Hardcore / Aggregates",
  "20 02 01": "Green waste",
  "20 01 35": "WEEE",
  "20 01 36": "WEEE",
  "16 02 13": "WEEE",
  "16 02 14": "WEEE",
  "20 01 37": "Wood",
};

export function outgoingStream(ewc: string | null | undefined, description?: string | null, product?: string | null): string {
  const code = (ewc ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
  if (RESIDUAL_CODES.has(code)) {
    const recordedProduct = (product ?? "").replace(/\s+/g, " ").trim().toUpperCase();
    if (/\bTROMMEL\b/.test(recordedProduct)) return "Trommel";
    if (code === "19 12 12" && recordedProduct === "WASTE OUT") return "Landfill";
    return "Residual";
  }
  if (EWC_STREAM[code]) return EWC_STREAM[code];
  const d = (description ?? "").toLowerCase();
  if (/paper|card/.test(d)) return "Paper / Card";
  if (/wood/.test(d)) return "Wood";
  if (/plastic/.test(d)) return "Plastics";
  if (/metal/.test(d)) return "Metals (mixed)";
  if (/rdf|refuse derived/.test(d)) return "Waste RDF";
  return "Other";
}

/** Midweigh weighbridge weights are stored in kilograms. */
export const midweighRowTonnes = (row: { weight_t?: number | null }) => (row.weight_t ?? 0) / 1000;

/** A missing/zero denominator cannot establish a meaningful percentage. */
export const outgoingPercentage = (out: number, incoming: number): number | null =>
  incoming > 0 ? (out / incoming) * 100 : null;

export const outgoingYearChange = (current: number, previous: number): number | null =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

export const LANDFILL_STREAM = "Landfill";
export const RDF_STREAM = "Waste RDF";

export type OutgoingStreamRow = {
  ewc?: string | null;
  waste_description?: string | null;
  product?: string | null;
  weight_t?: number | null;
};

/**
 * Headline outgoing totals.
 * zeroToLandfill = everything except landfill-bound loads.
 * recycling = everything except landfill-bound loads and RDF.
 */
export function outgoingHeadlineTotals(rows: OutgoingStreamRow[]) {
  let total = 0;
  let landfill = 0;
  let rdf = 0;
  for (const row of rows) {
    const tonnes = midweighRowTonnes(row);
    const stream = outgoingStream(row.ewc, row.waste_description, row.product);
    total += tonnes;
    if (stream === LANDFILL_STREAM) landfill += tonnes;
    else if (stream === RDF_STREAM) rdf += tonnes;
  }
  return {
    total,
    landfill,
    rdf,
    zeroToLandfill: total - landfill,
    recycling: total - landfill - rdf,
  };
}

