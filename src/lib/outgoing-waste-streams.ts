/** Groups outgoing (WASTEOUT) loads into reporting streams by EWC code, falling back to description. */
/** Residual-family codes (19 12 12 etc.) are split by destination: landfill destinations are trommel fines, the rest are residual. */
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

export function outgoingStream(ewc: string | null | undefined, description?: string | null, destination?: string | null): string {
  const code = (ewc ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
  if (RESIDUAL_CODES.has(code)) {
    return /landfill/i.test(destination ?? "") ? "Trommel fines (landfill)" : "Residual";
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
