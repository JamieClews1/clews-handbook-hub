import type { VehicleKind } from "@/lib/route-one-vehicle-groups";

// Distinct fleet silhouettes: lifting arms, hook, crane, tipping body and trailer.
const bodies: Record<VehicleKind, React.ReactNode> = {
  "Skip Loader": <><path d="M13 17h15l-3 7H16zM12 23V11l5-3M29 23V11l-5-3" /></>,
  "Ro Ro": <><path d="M13 14h19v10H13zM14 24V9h5l2 3M17 18h12" /></>,
  Grab: <><path d="M14 20h17v4H14zM15 20V9l8-3 5 7-3 3M24 16l-2 4m5-4 2 4" /></>,
  Tipper: <path d="m13 14 17-6 3 10-17 6zM14 25h18" />,
  Flatbed: <path d="M13 23h20v3H13M16 19v4m7-4v4m7-4v4" />,
  Artic: <><path d="M16 10h22v14H16zM13 25h25M15 21v5" /><circle cx="33" cy="28" r="2.5" /></>,
  Van: <path d="M12 12h14l6 8v7H12M26 14v7h6" />,
  Other: <path d="M13 14h19v11H13" />,
};

export function VehicleTypeIcon({ type, className = "h-7 w-9" }: { type: VehicleKind; className?: string }) {
  return (
    <svg viewBox="0 0 42 34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} role="img" aria-label={type}>
      <title>{type}</title>
      <path d="M3 26V17l3-5h6v14M4 18h7M3 26h33" />
      {bodies[type]}
      <circle cx="8" cy="28" r="2.5" /><circle cx="26" cy="28" r="2.5" />
    </svg>
  );
}