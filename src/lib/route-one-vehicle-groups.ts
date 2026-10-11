export const VISIBLE_DRIVER_COLUMNS = 6;
export const DRIVER_ACCORDION_THRESHOLD = 8;
export const VEHICLE_TYPES = ["Skip Loader", "Ro Ro", "Grab", "Tipper", "Flatbed", "Artic", "Van", "Other"] as const;
export type VehicleKind = typeof VEHICLE_TYPES[number];

export function vehicleKind(value?: string | null): VehicleKind {
  const text = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (text.includes("skip")) return "Skip Loader";
  if (text.includes("roro") || text.includes("hook")) return "Ro Ro";
  if (text.includes("grab")) return "Grab";
  if (text.includes("tipper")) return "Tipper";
  if (text.includes("flat")) return "Flatbed";
  if (text.includes("artic")) return "Artic";
  if (text.includes("van")) return "Van";
  return "Other";
}

export function groupDriversByVehicle<T>(drivers: T[], getType: (driver: T) => string | null | undefined) {
  return VEHICLE_TYPES.map(type => ({ type, drivers: drivers.filter(driver => vehicleKind(getType(driver)) === type) }))
    .filter(group => group.drivers.length > 0);
}

export function useDriverAccordion(driverCount: number) {
  return driverCount > DRIVER_ACCORDION_THRESHOLD;
}