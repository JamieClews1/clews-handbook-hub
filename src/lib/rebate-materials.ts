export function isPalletWeightCharge(materialName: string): boolean {
  return materialName.trim().toLowerCase() === "pallet weight charge";
}

/**
 * Load-report waste types that should feed a differently-named rebate material.
 * Key = rebate material name, value = load report waste types that count towards it.
 */
const REBATE_MATERIAL_ALIASES: Record<string, string[]> = {
  cans: ["Pallets of Cans"],
};

/**
 * Total tonnage for a rebate material, including any aliased load-report waste types.
 * An alias is only pulled in when it isn't itself a configured rebate line
 * (prevents double counting).
 */
export function getMaterialWeight(
  lineItemWeights: Record<string, number>,
  materialName: string,
  configuredMaterialNames: string[] = [],
): number {
  let weight = lineItemWeights[materialName] ?? 0;
  const aliases = REBATE_MATERIAL_ALIASES[materialName.trim().toLowerCase()] ?? [];
  const configured = new Set(configuredMaterialNames.map((n) => n.trim().toLowerCase()));
  for (const alias of aliases) {
    if (alias.trim().toLowerCase() === materialName.trim().toLowerCase()) continue;
    if (configured.has(alias.trim().toLowerCase())) continue;
    weight += lineItemWeights[alias] ?? 0;
  }
  return weight;
}

/**
 * Rebate report grouping for a material name. Keep in sync with the category
 * buckets used by the rebate report builders.
 */
export const REBATE_CATEGORY_NAMES = [
  "Cardboard",
  "Paper",
  "Plastics",
  "Films",
  "Scrap Metal",
  "Cans",
  "Other",
] as const;

export function rebateCategoryFor(rawName: string): string {
  const key = (rawName ?? "").toLowerCase();
  if (/\bcans?\b/.test(key)) return "Cans";
  if (key.includes("card") || key.includes("cardboard")) return "Cardboard";
  if (key.includes("paper")) return "Paper";
  if (key.includes("plastic")) return "Plastics";
  if (key.includes("film")) return "Films";
  if (key.includes("scrap") || key.includes("ferrous") || key.includes("metal")) return "Scrap Metal";
  return "Other";
}
