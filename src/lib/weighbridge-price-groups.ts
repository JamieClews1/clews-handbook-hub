/**
 * Presentation-only grouping for the WeighOne pricing table.
 * Groups waste types by family (General Waste first) so related prices sit
 * together. Never changes stored display_order or any price.
 */

export interface PriceGroupDef {
  key: string;
  label: string;
  /** Ordered matchers: earlier matcher = earlier position inside the group. */
  match: RegExp[];
}

export const PRICE_GROUPS: PriceGroupDef[] = [
  {
    key: "general",
    label: "General Waste",
    match: [
      /^general waste$/,
      /^general waste.*rdf/,
      /^general waste.*landfill/,
      /^general waste/,
      /^bulky/,
      /^construction & demolition/,
      /mixed construction/,
    ],
  },
  {
    key: "packaging",
    label: "Packaging & Recyclables",
    match: [
      /^mixed packaging|co-?mingled|dmr/,
      /^cardboard/,
      /^paper/,
      /^plastic packaging/,
      /^plastics \(household\)/,
      /^plastics \(construction\)/,
      /plastic/,
      /glass/,
      /textile/,
    ],
  },
  {
    key: "wood",
    label: "Wood",
    match: [
      /^wood.*construction.*c grade/,
      /^wood.*construction.*a grade/,
      /^wood.*(packaging|pallet).*c grade/,
      /^wood.*(packaging|pallet).*a grade/,
      /^wood/,
      /hazardous wood/,
      /wood/,
    ],
  },
  {
    key: "inert",
    label: "Hardcore, Soil & Inert",
    match: [/^hardcore/, /^soil/, /^concrete/, /^brick/, /inert/, /bitumin/, /bottom ash/],
  },
  {
    key: "building",
    label: "Plasterboard & Insulation",
    match: [/plasterboard/, /insulation/],
  },
  {
    key: "green",
    label: "Green Waste",
    match: [/green waste/, /vegetation/],
  },
  {
    key: "metal",
    label: "Metals",
    match: [/^metal/, /non-ferrous|aluminium/, /mixed metal/, /metal/],
  },
  {
    key: "special",
    label: "Special & Hazardous",
    match: [/weee/, /pops/, /batter/, /tyre/],
  },
];

export const OTHER_GROUP = { key: "other", label: "Other" };

export function classifyPriceGroup(name: string): { groupIndex: number; rank: number } {
  const n = name.trim().toLowerCase();
  for (let g = 0; g < PRICE_GROUPS.length; g++) {
    const r = PRICE_GROUPS[g].match.findIndex((re) => re.test(n));
    if (r >= 0) return { groupIndex: g, rank: r };
  }
  return { groupIndex: PRICE_GROUPS.length, rank: 0 };
}

export interface PriceGroupSection<T> {
  key: string;
  label: string;
  items: T[];
}

/** Splits waste types into ordered groups (General Waste first; empty groups omitted). */
export function groupWasteTypesForPricing<T extends { waste_type: string }>(rows: T[]): PriceGroupSection<T>[] {
  const buckets = new Map<number, { row: T; rank: number }[]>();
  for (const row of rows) {
    const { groupIndex, rank } = classifyPriceGroup(row.waste_type);
    if (!buckets.has(groupIndex)) buckets.set(groupIndex, []);
    buckets.get(groupIndex)!.push({ row, rank });
  }
  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((g) => {
      const def = PRICE_GROUPS[g] ?? OTHER_GROUP;
      const items = buckets
        .get(g)!
        .sort((a, b) => a.rank - b.rank || a.row.waste_type.localeCompare(b.row.waste_type))
        .map((x) => x.row);
      return { key: def.key, label: def.label, items };
    });
}
