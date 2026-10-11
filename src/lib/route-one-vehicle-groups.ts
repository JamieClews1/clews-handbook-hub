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

export function boardVehicleKind(type: string | null | undefined, registration: string | null | undefined, articRegistrations: string[]): VehicleKind {
  const normalise = (value: string) => value.toUpperCase().replace(/\s/g, "");
  if (registration && articRegistrations.some(reg => normalise(reg) === normalise(registration))) return "Artic";
  return vehicleKind(type);
}

interface BoardVehicle { registration: string; vehicle_type: string }
interface DayVehicleJob { registration?: string | null; containerType?: string | null }
export function dailyBoardVehicle(jobs: DayVehicleJob[], usualVehicle: BoardVehicle | null | undefined, vehicles: BoardVehicle[], articRegistrations: string[]) {
  const normalise = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const counts = new Map<string, { registration: string; count: number }>();
  for (const job of jobs) {
    if (!job.registration?.trim()) continue;
    const key = normalise(job.registration);
    const entry = counts.get(key);
    counts.set(key, { registration: job.registration.trim(), count: (entry?.count ?? 0) + 1 });
  }
  const registration = [...counts.values()].sort((a, b) => b.count - a.count)[0]?.registration;
  if (!registration) return { registration: usualVehicle?.registration ?? null, type: boardVehicleKind(usualVehicle?.vehicle_type, usualVehicle?.registration, articRegistrations) };
  const vehicle = vehicles.find(v => normalise(v.registration) === normalise(registration));
  let type = boardVehicleKind(vehicle?.vehicle_type, registration, articRegistrations);
  const containers = jobs.filter(j => j.registration && normalise(j.registration) === normalise(registration)).map(j => j.containerType ?? "").join(" ");
  // Imported catalog types can be stale: the day's specialist equipment is stronger evidence.
  if (type !== "Artic" && /ro\s*-?\s*ro|roll on|roll off/i.test(containers)) type = "Ro Ro";
  else if (/curtain|walking floor/i.test(containers)) type = "Artic";
  else if (type === "Other") type = vehicleKind(containers);
  return { registration, type };
}