// Staci pallet colour classification (auto-calculated)
export type StaciPalletColour = "red" | "yellow" | "blue" | "green" | "waste_wood";
export type StaciPalletType = "good" | "scrap";

// Waste composition type
export type StaciWasteComposition = "pure_recyclable" | "mixed_majority_recyclable" | "mixed_majority_non_recyclable" | "non_recyclable";

export interface StaciPalletEntry {
  id: string;
  colour: StaciPalletColour;
  weight_kg: number;
  pallet_type: StaciPalletType;
  display_order: number;
  // New fields for description-first approach
  description: string;
  waste_composition: StaciWasteComposition;
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

// Waste composition options for the form
export const STACI_WASTE_COMPOSITION_OPTIONS: { value: StaciWasteComposition; label: string; description: string }[] = [
  { value: "pure_recyclable", label: "Pure Recyclable", description: "100% recyclable materials" },
  { value: "mixed_majority_recyclable", label: "Mixed (Majority Recyclable)", description: "Mixed load, >50% recyclable" },
  { value: "mixed_majority_non_recyclable", label: "Mixed (Majority Non-Recyclable)", description: "Mixed load, >50% non-recyclable" },
  { value: "non_recyclable", label: "Non-Recyclable", description: "100% non-recyclable materials" },
];

/**
 * Auto-calculate pallet colour based on weight and waste composition
 * 
 * Rules:
 * - Red (£42): >150KG non-recyclable waste
 * - Yellow (£22): >150KG mixed majority recyclable OR <150KG non-recyclable
 * - Blue (£9): Pure recyclables <300KG OR mixed <150KG
 * - Green (-£18 rebate): Pure recyclables >300KG
 */
export function calculatePalletColour(weight_kg: number, composition: StaciWasteComposition): StaciPalletColour {
  // Pure recyclable logic
  if (composition === "pure_recyclable") {
    if (weight_kg >= 300) {
      return "green"; // Rebate: Pure recyclables >300KG
    } else {
      return "blue"; // Pure recyclables <300KG
    }
  }
  
  // Mixed majority recyclable logic
  if (composition === "mixed_majority_recyclable") {
    if (weight_kg > 150) {
      return "yellow"; // >150KG mixed majority recyclable
    } else {
      return "blue"; // Mixed recyclables <150KG
    }
  }
  
  // Mixed majority non-recyclable logic
  if (composition === "mixed_majority_non_recyclable") {
    if (weight_kg > 150) {
      return "red"; // >150KG with majority non-recyclable = non-recyclable
    } else {
      return "blue"; // Mixed <150KG
    }
  }
  
  // Non-recyclable logic
  if (composition === "non_recyclable") {
    if (weight_kg > 150) {
      return "red"; // >150KG non-recyclable
    } else {
      return "yellow"; // <150KG non-recyclable
    }
  }
  
  // Fallback
  return "blue";
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
    description: ">150KG non recyclable waste"
  },
  yellow: { 
    label: "Yellow", 
    bgColor: "bg-yellow-400", 
    textColor: "text-black",
    description: ">150KG mixed majority recyclable"
  },
  blue: { 
    label: "Blue", 
    bgColor: "bg-blue-600", 
    textColor: "text-white",
    description: "Pure recyclables <300KG"
  },
  green: { 
    label: "Green", 
    bgColor: "bg-green-600", 
    textColor: "text-white",
    description: "Pure recyclables >300KG (Rebate)"
  },
  waste_wood: { 
    label: "Waste Wood", 
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
