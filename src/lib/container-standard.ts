/**
 * Agreed container standard (Container_Types_Standard v2, 13 Nov 2026).
 *
 * One name and one reference code per container across Skiptrak, Midweigh, Route One,
 * WeighOne and Stock Check. Stored records keep the wording they were recorded with
 * (rebate rules, standing bins and over-rental marks match on it); screens show the
 * standard name and code through `standardContainer`.
 */
import standard from "@/data/container-standard.json";
import { CONTAINER_GROUPS } from "./container-taxonomy";
import { recordedContainerBooking } from "./recorded-container-booking";

/**
 * standard: priced booking choice · bespoke: bookable, no price line · other: recorded, not a
 * Route One booking choice · history: past records only, never offered for new bookings.
 */
export type ContainerStatus = "standard" | "bespoke" | "other" | "history" | "job_type" | "retired" | "not_recorded";
export interface ContainerStandard {
  ref: string; name: string; category: string; status: ContainerStatus;
  /** Route One / pricing size code when it is a booking choice. */
  size_code: string | null;
  /** Stock Check type it counts towards, if any. */
  stock_type: string | null;
  note: string | null;
}

export const CONTAINER_STANDARD_VERSION: string = standard.version;
export const CONTAINER_STANDARDS = standard.standards as ContainerStandard[];
const ALIASES = standard.aliases as Record<string, string>;
const BY_REF = new Map(CONTAINER_STANDARDS.map(s => [s.ref, s]));
const BY_CODE = new Map(CONTAINER_STANDARDS.filter(s => s.size_code).map(s => [s.size_code as string, s]));
const NOT_RECORDED = BY_REF.get("NOTC")!;

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Shared booking labels ("SKIP · 8 yd", "8 yd Skip", "35 / 40 yd Ro Ro") resolve to their size code. */
const TAXONOMY_ALIASES = new Map<string, string>();
for (const g of CONTAINER_GROUPS) for (const s of g.sizes) {
  for (const label of [`${g.label} · ${s.label}`, `${s.label} ${g.value}`, `${g.value} ${s.label}`, s.code]) TAXONOMY_ALIASES.set(key(label), s.code);
}

export const containerStandardByRef = (ref: string | null | undefined) => (ref ? BY_REF.get(ref) ?? null : null);
export const containerStandardForCode = (code: string | null | undefined) => (code ? BY_CODE.get(code) ?? null : null);

/**
 * The agreed container for any recorded wording. Blank, '*' and bare job or trailer numbers read
 * as "Not recorded"; wording the standard does not know returns null so the original text shows.
 */
export function standardContainer(recorded: string | null | undefined): ContainerStandard | null {
  const raw = String(recorded ?? "").trim();
  const k = key(raw);
  if (!k || /^\d+$/.test(k)) return NOT_RECORDED;
  const alias = ALIASES[k];
  if (alias) return BY_REF.get(alias) ?? null;
  const code = TAXONOMY_ALIASES.get(k);
  if (code) return BY_CODE.get(code) ?? null;
  const booking = recordedContainerBooking(raw).container_size;
  return booking ? BY_CODE.get(booking) ?? null : null;
}

/** Standard name for display, falling back to the recorded wording when it is not recognised. */
export function standardContainerName(recorded: string | null | undefined): string {
  const s = standardContainer(recorded);
  if (s) return s.name;
  return String(recorded ?? "").trim();
}

/** Reference code (e.g. SK08, RO40, ARCS) for display beside a container, or null. */
export function containerRef(recorded: string | null | undefined): string | null {
  const s = standardContainer(recorded);
  return s && s.status !== "not_recorded" ? s.ref : null;
}

/** Containers kept for old records only; Setup lists them so staff know why they are not offered. */
export const HISTORY_ONLY_CONTAINERS = CONTAINER_STANDARDS.filter(s => s.status === "history");
