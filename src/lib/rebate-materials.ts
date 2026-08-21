export function isPalletWeightCharge(materialName: string): boolean {
  return materialName.trim().toLowerCase() === "pallet weight charge";
}