/**
 * Determines the data source (skiptrak or midweigh) for weighbridge data
 * based on customer name or site's load_report_type.
 * 
 * Mapping:
 * - Britvic, Staci, Standard (other) → skiptrak (weight in tonnes)
 * - Vantiva, Amazon, Evri → midweigh (weight in KG, needs conversion)
 */

// Customer types that use Midweigh for weighbridge data
const MIDWEIGH_CUSTOMERS = ["vantiva", "evri"];

// Customer types that use Skiptrak for weighbridge data
const SKIPTRAK_CUSTOMERS = ["britvic", "staci", "amazon", "other"];

export function getWeighbridgeSource(customerType: string | null | undefined): "skiptrak" | "midweigh" {
  if (!customerType) return "skiptrak"; // Default to skiptrak
  
  const normalized = customerType.toLowerCase();
  
  if (MIDWEIGH_CUSTOMERS.includes(normalized)) {
    return "midweigh";
  }
  
  // Default to skiptrak for all others (including britvic, staci, other/standard)
  return "skiptrak";
}

/**
 * Converts raw weight from data source to tonnes.
 * - Skiptrak: weight is already in tonnes
 * - Midweigh: weight is in KG, divide by 1000
 */
export function convertWeightToTonnes(weight: number | null | undefined, source: "skiptrak" | "midweigh"): number | null {
  if (weight == null) return null;
  
  if (source === "midweigh") {
    return weight / 1000; // Convert KG to tonnes
  }
  
  return weight; // Skiptrak is already in tonnes
}

/**
 * Given a customer name, determines the weighbridge source
 */
export function getWeighbridgeSourceByCustomerName(customerName: string | null | undefined): "skiptrak" | "midweigh" {
  if (!customerName) return "skiptrak";
  
  const normalized = customerName.toLowerCase();
  
  // Check if customer name contains any of the midweigh customer identifiers
  for (const midweighCustomer of MIDWEIGH_CUSTOMERS) {
    if (normalized.includes(midweighCustomer)) {
      return "midweigh";
    }
  }
  
  return "skiptrak";
}