import { WasteRefChip } from "@/components/waste/WasteRefChip";
import { containerRef, containerStandardForCode, standardContainerName } from "@/lib/container-standard";

/** Agreed container reference code (e.g. SK08, RO40, ARCS) for recorded wording; nothing when unknown. */
export function ContainerRefFor({ recorded, className }: { recorded: string | null | undefined; className?: string }) {
  return <WasteRefChip refCode={containerRef(recorded)} className={className} />;
}

/** Reference code for a booking size code (e.g. "40yd" → RO40). */
export function ContainerRefForCode({ code, className }: { code: string | null | undefined; className?: string }) {
  return <WasteRefChip refCode={containerStandardForCode(code)?.ref} className={className} />;
}

/** Standard container name with its code; the recorded wording shows as a tooltip when it differs. */
export function StandardContainer({ recorded, fallback = "No container recorded", className }: { recorded: string | null | undefined; fallback?: string; className?: string }) {
  const raw = String(recorded ?? "").trim();
  const name = raw ? standardContainerName(raw) : fallback;
  return (
    <span className={className} title={raw && name !== raw ? `Recorded as: ${raw}` : undefined}>
      <span className="inline-flex items-center gap-1 align-middle">{name}<ContainerRefFor recorded={raw} /></span>
    </span>
  );
}
