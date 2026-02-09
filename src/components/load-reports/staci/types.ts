// Staci pallet colour classification
export type StaciPalletColour = "red" | "yellow" | "blue" | "green" | "waste_wood";
export type StaciPalletType = "good" | "scrap";

export interface StaciPalletEntry {
  id: string;
  colour: StaciPalletColour;
  weight_kg: number;
  pallet_type: StaciPalletType;
  display_order: number;
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
