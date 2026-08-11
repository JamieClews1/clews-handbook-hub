// Staci pallet colour classification (auto-calculated from waste breakdown)
export type StaciPalletColour = "red" | "yellow" | "blue" | "green" | "waste_wood";
export type StaciPalletType = "good" | "scrap";

// Waste breakdown percentages per pallet
export interface StaciWasteBreakdown {
  metal: number;
  scrap_metal: number;
  paper: number;
  card: number;
  pvc: number;
  hard_plastic: number;
  shrink_wrap: number;
  other_films_plastics: number;
  rdf: number;
  wood: number;
  landfill: number;
}

// Default empty breakdown
export const EMPTY_WASTE_BREAKDOWN: StaciWasteBreakdown = {
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

// Waste type labels for display
export const WASTE_TYPE_LABELS: Record<keyof StaciWasteBreakdown, string> = {
  metal: "Metal",
  scrap_metal: "Scrap Metal",
  paper: "Paper",
  card: "Card",
  pvc: "PVC",
  hard_plastic: "Hard Plastic",
  shrink_wrap: "Shrink Wrap",
  other_films_plastics: "Other Films/Plastics",
  rdf: "RDF",
  wood: "Wood",
  landfill: "Landfill",
};

// Define which waste types are recyclable
export const RECYCLABLE_WASTE_TYPES: (keyof StaciWasteBreakdown)[] = [
  "metal",
  "scrap_metal",
  "paper",
  "card",
  "hard_plastic",
  "shrink_wrap",
  "other_films_plastics",
  "wood",
];

// Non-recyclable types split into sub-categories
export const NON_RECYCLABLE_WASTE_TYPES: (keyof StaciWasteBreakdown)[] = [
  "pvc",
  "rdf",
  "landfill",
];

// Waste For Energy (RDF)
export const WASTE_FOR_ENERGY_TYPES: (keyof StaciWasteBreakdown)[] = [
  "rdf",
];

// Landfill types (PVC, landfill)
export const LANDFILL_TYPES: (keyof StaciWasteBreakdown)[] = [
  "pvc",
  "landfill",
];

// Wood is a special case - tracked separately
export const WOOD_TYPE: keyof StaciWasteBreakdown = "wood";

export interface StaciPalletEntry {
  id: string;
  colour: StaciPalletColour;
  weight_kg: number;
  pallet_type: StaciPalletType;
  display_order: number;
  description: string;
  waste_breakdown: StaciWasteBreakdown;
  pallet_count: number; // Number of pallets of this type
}

// Staci 2025 rates per pallet
export const STACI_PALLET_RATES: Record<StaciPalletColour, number> = {
  red: 42.00,       // >150KG non recyclable waste to landfill/RDF
  yellow: 22.00,    // >150KG mixed load with majority recyclables OR 100% non-recyclable <150KG
  blue: 9.00,       // Pure recyclables <300KG OR mixed recyclables <150KG
  green: -18.00,    // (REBATE) Pure recyclables >300KG
  waste_wood: 45.00 // Rate per tonne (Pallet Scrap)
};

// Pallet rebate for good pallets
export const STACI_PALLET_GOOD_REBATE = 0.75; // £0.75 per pallet

// Haulage rates
export const STACI_HAULAGE_ARTIC = 145.00;
export const STACI_HAULAGE_PICKUP = 35.00;

/**
 * Calculate the total percentage from a breakdown
 */
export function getTotalPercentage(breakdown: StaciWasteBreakdown): number {
  return Object.values(breakdown).reduce((sum, val) => sum + val, 0);
}

/**
 * Calculate recyclable percentage from breakdown
 */
export function getRecyclablePercentage(breakdown: StaciWasteBreakdown): number {
  return RECYCLABLE_WASTE_TYPES.reduce((sum, key) => sum + breakdown[key], 0);
}

/**
 * Calculate non-recyclable percentage from breakdown
 */
export function getNonRecyclablePercentage(breakdown: StaciWasteBreakdown): number {
  return NON_RECYCLABLE_WASTE_TYPES.reduce((sum, key) => sum + breakdown[key], 0);
}

/**
 * Auto-calculate pallet colour based on weight and waste breakdown percentages
 *
 * Rules:
 * - Green (rebate): 100% recyclable AND ≥300KG
 * - Blue: 100% recyclable AND <300KG, or mixed majority recyclable ≤150KG
 * - Yellow: mixed (any non-recyclable) majority recyclable >150KG, or ≤150KG majority non-recyclable
 * - Red: >150KG majority non-recyclable
 */
export function calculatePalletColour(weight_kg: number, breakdown: StaciWasteBreakdown): StaciPalletColour {
  const recyclablePct = getRecyclablePercentage(breakdown);
  const nonRecyclablePct = getNonRecyclablePercentage(breakdown);

  // Pure recyclable = zero non-recyclable content (any contamination makes it "mixed")
  const isPureRecyclable = nonRecyclablePct <= 0;
  
  
  // Majority recyclable = recyclable > non-recyclable
  const isMajorityRecyclable = recyclablePct > nonRecyclablePct;
  
  // Majority non-recyclable
  const isMajorityNonRecyclable = nonRecyclablePct > recyclablePct;
  
  // Pure recyclable logic
  if (isPureRecyclable) {
    if (weight_kg >= 300) {
      return "green"; // Rebate: Pure recyclables >300KG
    } else {
      return "blue"; // Pure recyclables <300KG
    }
  }
  
  // Mixed majority recyclable logic
  if (isMajorityRecyclable) {
    if (weight_kg > 150) {
      return "yellow"; // >150KG mixed majority recyclable
    } else {
      return "blue"; // Mixed recyclables <150KG
    }
  }
  
  // Mixed majority non-recyclable or pure non-recyclable logic
  if (isMajorityNonRecyclable || nonRecyclablePct >= 50) {
    if (weight_kg > 150) {
      return "red"; // >150KG with majority non-recyclable
    } else {
      return "yellow"; // <150KG non-recyclable
    }
  }
  
  // Fallback (e.g., 50/50 split)
  return weight_kg > 150 ? "yellow" : "blue";
}

// Colour display configuration
export const STACI_COLOUR_CONFIG: Record<StaciPalletColour, { 
  label: string; 
  bgColor: string; 
  textColor: string;
  description: string;
}> = {
  red: { 
    label: "Red", 
    bgColor: "bg-red-600", 
    textColor: "text-white",
    description: ">150KG, majority non-recyclable"
  },
  yellow: { 
    label: "Yellow", 
    bgColor: "bg-yellow-400", 
    textColor: "text-black",
    description: ">150KG mixed (any contamination), majority recyclable"
  },
  blue: { 
    label: "Blue", 
    bgColor: "bg-blue-600", 
    textColor: "text-white",
    description: "100% recyclable <300KG, or mixed ≤150KG"
  },
  green: { 
    label: "Green", 
    bgColor: "bg-green-600", 
    textColor: "text-white",
    description: "100% recyclable ≥300KG (Rebate)"
  },
  waste_wood: { 
    label: "Pallet Charges", 
    bgColor: "bg-amber-700",
    textColor: "text-white",
    description: "Pallet scrap @ £45/t"
  },
};

// Summary by colour
export interface StaciColourSummary {
  colour: StaciPalletColour;
  palletCount: number;
  totalWeightKg: number;
  ratePerPallet: number;
  totalValue: number;
}
