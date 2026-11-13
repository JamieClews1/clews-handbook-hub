import { cn } from "@/lib/utils";
import { wasteStreamRef, type ResolveInput } from "@/lib/waste-streams";

/** Agreed reference code (e.g. GEN, WOOD-CA) shown as a small code tag beside a waste name. */
export function WasteRefChip({ refCode, className }: { refCode: string | null | undefined; className?: string }) {
  if (!refCode) return null;
  return (
    <span
      title="Agreed reference code"
      className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded border border-border bg-muted px-1.5 py-px font-mono text-[10px] font-semibold uppercase leading-4 text-foreground tabular-nums", className)}
    >
      {refCode}
    </span>
  );
}

/** Reference code tag for a recorded waste name/EWC; renders nothing when the waste is not one agreed stream. */
export function WasteRefFor({ name, ewc, className, ...opts }: { name: string | null | undefined; ewc?: string | null; className?: string } & Omit<ResolveInput, "name" | "ewc">) {
  return <WasteRefChip refCode={wasteStreamRef(name, ewc, opts)} className={className} />;
}
