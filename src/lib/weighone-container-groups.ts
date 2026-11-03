import { WASTE_OUT_CONTAINERS } from "./weighone-waste-out";

/** One accordion row: the vehicle staff pick, and the container descriptions it offers. */
export type ContainerGroup = { vehicle: string; options: string[] };

/** Waste In and Skip tickets lead with the small vehicles that tip in. */
const INBOUND_SMALL_VEHICLES: ContainerGroup[] = [
  { vehicle: "Van", options: ["Van"] },
  { vehicle: "FEL", options: ["FEL"] },
  { vehicle: "Pickup", options: ["Pickup"] },
];

/** Waste In / Skip picker: Van, FEL, Pickup first, then the shared Skip, Ro Ro and Artic sizes. */
export const INBOUND_CONTAINER_GROUPS: ContainerGroup[] = [
  ...INBOUND_SMALL_VEHICLES,
  ...WASTE_OUT_CONTAINERS.map(g => ({ vehicle: g.vehicle, options: g.options })),
];

/** Chip text for a stored container description: "SKIP · 8 yd" reads as "8 yd". */
export function containerChipLabel(option: string) {
  return option.includes(" · ") ? option.split(" · ")[1] : option;
}

/** True when the picker offers this saved description directly, so "Other vehicle type" can stay closed. */
export function isPickedContainer(value: string | null | undefined) {
  return !!value && INBOUND_CONTAINER_GROUPS.some(g => g.options.includes(value));
}
