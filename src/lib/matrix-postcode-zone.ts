/**
 * Postcode → pricing-matrix zone matching.
 *
 * Only postcodes listed on the pricing matrix (pricing_zone_postcodes) are
 * priced. Matching goes from most to least specific — full postcode, sector
 * ("CV23 0"), district ("CV21") — and never guesses: a postcode the matrix
 * doesn't list returns "none", and a sector the matrix splits between zones
 * (e.g. NN6 7: Crick in Zone 1, elsewhere Zone 3) returns "ambiguous" so staff
 * must choose.
 */

export type MatrixPostcode = {
  postcode_prefix: string;
  zone_code: string; // zone label on the matrix, e.g. "Zone 1", "Zone 3 RoRo Only"
  area: string | null;
};

export type MatrixMatch =
  | { status: "matched"; zone: string; matches: MatrixPostcode[] }
  | { status: "ambiguous"; zone: null; matches: MatrixPostcode[] }
  | { status: "none"; zone: null; matches: [] };

/** Rate-card zone codes keyed by the zone label on the matrix. */
export const MATRIX_ZONE_TO_CODE: Record<string, string> = {
  "Zone 1": "Z1",
  "Zone 2": "Z2",
  "Zone 3": "Z3",
  "Zone 3 RoRo Only": "Z3R",
  "Zone 4 RoRo Only": "Z4R",
  "Zone 4": "Z4",
};

type Parts = { outward: string; sector: string | null; inward: string | null };

/** Split "CV23 7DT" / "CV237DT" / "CV23 7" / "CV21" into outward, sector and inward parts. */
export function parsePostcodeParts(raw: string | null | undefined): Parts | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  // With a space the outward code is unambiguous.
  let m = s.match(/^([A-Z]{1,2}\d[A-Z\d]?) (\d)([A-Z]{2})?$/);
  if (m) return { outward: m[1], sector: m[2], inward: m[3] ?? null };
  // Without a space, a full postcode always ends in digit + two letters.
  m = s.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d)([A-Z]{2})$/);
  if (m) return { outward: m[1], sector: m[2], inward: m[3] };
  m = s.match(/^([A-Z]{1,2}\d[A-Z\d]?)$/);
  if (m) return { outward: m[1], sector: null, inward: null };
  return null;
}

const key = (p: Parts, level: "full" | "sector" | "district") =>
  level === "district" ? p.outward : level === "sector" ? `${p.outward} ${p.sector}` : `${p.outward} ${p.sector}${p.inward}`;

export function matchMatrixPostcode(postcode: string | null | undefined, rows: MatrixPostcode[]): MatrixMatch {
  const pc = parsePostcodeParts(postcode);
  if (!pc) return { status: "none", zone: null, matches: [] };
  const levels: ("full" | "sector" | "district")[] = [];
  if (pc.sector && pc.inward) levels.push("full");
  if (pc.sector) levels.push("sector");
  levels.push("district");

  const indexed = rows
    .map((r) => ({ row: r, parts: parsePostcodeParts(r.postcode_prefix) }))
    .filter((x): x is { row: MatrixPostcode; parts: Parts } => !!x.parts);

  for (const level of levels) {
    const want = key(pc, level);
    const hits = indexed
      .filter(({ parts }) => {
        const rowLevel = parts.inward ? "full" : parts.sector ? "sector" : "district";
        return rowLevel === level && key(parts, level) === want;
      })
      .map((x) => x.row);
    if (!hits.length) continue;
    const zonesHit = [...new Set(hits.map((h) => h.zone_code))];
    if (zonesHit.length === 1) return { status: "matched", zone: zonesHit[0], matches: hits };
    return { status: "ambiguous", zone: null, matches: hits };
  }
  return { status: "none", zone: null, matches: [] };
}
