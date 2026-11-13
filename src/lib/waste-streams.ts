/**
 * Agreed waste stream standard (Waste_Stream_Standard_List v5, 13 Nov 2026).
 *
 * One name and one EWC per waste stream, shared by Skiptrak, Midweigh, Route One,
 * WeighOne and Duty of Care. Stored job records keep the wording they were
 * recorded with (rebate rules and past reports depend on it); screens show the
 * standard name through `standardWasteName`, and hazardous codes always show the *.
 */
import standard from "@/data/waste-stream-standard.json";

export type WasteStreamDirection = "incoming" | "outgoing" | "job_type";
export interface WasteStream { ref: string; name: string; ewc: string | null; direction: WasteStreamDirection }
type AliasSystem = "skiptrak" | "midweigh" | "midweigh_code" | "route_one" | "rate_card" | "duty_of_care" | "website";
interface Alias { system: AliasSystem; name: string; ewc: string | null; ref: string }

export const WASTE_STREAM_STANDARD_VERSION: string = standard.version;
export const WASTE_STREAMS: WasteStream[] = standard.streams as WasteStream[];
const ALIASES: Alias[] = standard.aliases as Alias[];
const HAZARDOUS = new Set<string>(standard.hazardous_codes);

/** "Haulage Only" replaces the old "Empty Skip" waste: no waste carried, no EWC. */
export const HAULAGE_ONLY_REF = "HAUL";

const BY_REF = new Map(WASTE_STREAMS.map((s) => [s.ref, s]));
export const wasteStreamByRef = (ref: string | null | undefined) => (ref ? BY_REF.get(ref) ?? null : null);

const nameKey = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/** Six-digit EWC key ("17 02 01", "170201", "17 02 01*" all become "170201"); null when not a code. */
export function ewcKey(code: string | null | undefined): string | null {
  const digits = (code ?? "").replace(/\*/g, "").replace(/\s+/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

const STANDARD_BY_NAME = new Map(WASTE_STREAMS.map((s) => [nameKey(s.name), s]));
const ALIASES_BY_NAME = new Map<string, Alias[]>();
for (const a of ALIASES) {
  const k = nameKey(a.name);
  if (!k) continue;
  const list = ALIASES_BY_NAME.get(k) ?? [];
  list.push(a);
  ALIASES_BY_NAME.set(k, list);
}

export type WasteSource = "skiptrak" | "midweigh" | "route_one" | "weighone" | "duty_of_care" | string | null | undefined;

export interface ResolveInput {
  name?: string | null;
  ewc?: string | null;
  source?: WasteSource;
  /** Midweigh product code (raw "Product"), used when the description is blank or unknown. */
  productCode?: string | null;
  /** Load direction; settles names used for both an incoming and an outgoing stream. */
  direction?: "incoming" | "outgoing" | null;
}

const sourceSystems = (source: WasteSource): AliasSystem[] => {
  switch (source) {
    case "skiptrak": return ["skiptrak"];
    case "midweigh": return ["midweigh", "midweigh_code"];
    case "route_one": return ["route_one", "skiptrak"];
    case "weighone": return ["rate_card", "midweigh"];
    case "duty_of_care": return ["duty_of_care"];
    default: return [];
  }
};

function pick(cands: Alias[], input: ResolveInput): WasteStream | null {
  if (cands.length === 0) return null;
  let pool = cands;
  if (input.direction) {
    const dir = pool.filter((a) => wasteStreamByRef(a.ref)?.direction === input.direction);
    if (dir.length) pool = dir;
  }
  const preferred = sourceSystems(input.source);
  if (preferred.length) {
    const own = pool.filter((a) => preferred.includes(a.system));
    if (own.length) pool = own;
  }
  const refs = new Set(pool.map((a) => a.ref));
  return refs.size === 1 ? wasteStreamByRef([...refs][0]) : null;
}

/** The agreed standard stream for a recorded waste name/EWC, or null when it cannot be told apart safely. */
export function resolveWasteStream(input: ResolveInput): WasteStream | null {
  const key = nameKey(input.name);
  const ewc = ewcKey(input.ewc);
  if (key) {
    const exact = STANDARD_BY_NAME.get(key);
    if (exact && (!ewc || !exact.ewc || ewcKey(exact.ewc) === ewc || exact.ref === HAULAGE_ONLY_REF)) return exact;
    const named = ALIASES_BY_NAME.get(key) ?? [];
    // Name + recorded EWC is the reliable match ("Plastics" on 17 02 03 vs 20 01 39).
    const withEwc = named.filter((a) => (ewc ? ewcKey(a.ewc) === ewc : !a.ewc));
    const hit = pick(withEwc, input);
    if (hit) return hit;
  }
  const code = nameKey(input.productCode);
  if (code) {
    const byCode = ALIASES.filter((a) => a.system === "midweigh_code" && nameKey(a.name) === code);
    const hit = pick(byCode, input);
    if (hit) return hit;
  }
  if (key) {
    // Name alone only when every known use of that name points to one stream.
    const hit = pick(ALIASES_BY_NAME.get(key) ?? [], { ...input, source: null });
    if (hit) return hit;
  }
  return null;
}

/** Standard name to show for a recorded waste; falls back to the recorded wording. */
export function standardWasteName(
  name: string | null | undefined,
  ewc?: string | null,
  opts: Omit<ResolveInput, "name" | "ewc"> = {},
): string {
  const stream = resolveWasteStream({ ...opts, name, ewc });
  return stream?.name ?? (name ?? "").trim();
}

/** True when the code is hazardous in the EWC register (or already carries a *). */
export function isHazardousEwc(code: string | null | undefined): boolean {
  if ((code ?? "").includes("*")) return true;
  const k = ewcKey(code);
  return !!k && HAZARDOUS.has(`${k.slice(0, 2)} ${k.slice(2, 4)} ${k.slice(4)}`);
}

/**
 * EWC as shown in the portal: spaced "17 02 01" form with the hazardous * added
 * where the register marks the code hazardous. Text that is not a code is returned as-is.
 */
export function formatEwc(code: string | null | undefined): string {
  const raw = (code ?? "").trim();
  if (!raw) return "";
  const k = ewcKey(raw);
  if (!k) return raw;
  const spaced = `${k.slice(0, 2)} ${k.slice(2, 4)} ${k.slice(4)}`;
  return isHazardousEwc(raw) ? `${spaced}*` : spaced;
}

/** Streams offered when booking or weighing, in list order. */
export function pickableWasteStreams(direction: "incoming" | "outgoing" | "all" = "incoming", includeHaulage = true): WasteStream[] {
  return WASTE_STREAMS.filter((s) =>
    (s.ref === HAULAGE_ONLY_REF ? includeHaulage : direction === "all" || s.direction === direction),
  );
}

const ALIAS_TEXT = new Map<string, string>();
for (const a of ALIASES) ALIAS_TEXT.set(a.ref, `${ALIAS_TEXT.get(a.ref) ?? ""} ${a.name}`);

/** Search the standard list by name, code or any old wording (e.g. "municipal"), without changing its order. */
export function searchWasteStreams(list: WasteStream[], q: string): WasteStream[] {
  const needle = nameKey(q);
  if (!needle) return list;
  return list.filter((s) => nameKey(`${s.name} ${s.ewc ?? ""} ${s.ref} ${ALIAS_TEXT.get(s.ref) ?? ""}`).includes(needle));
}

/**
 * Find the list entry for a recorded waste: exact name first, then the entry
 * whose name/EWC resolves to the same standard stream (so a booking saying
 * "Mixed Municipal Waste" finds the "General Waste" price line).
 */
export function findSameWasteStream<T>(
  list: T[],
  get: (item: T) => { name: string | null | undefined; ewc?: string | null },
  name: string | null | undefined,
  ewc?: string | null,
  opts: Omit<ResolveInput, "name" | "ewc"> = {},
): T | undefined {
  const key = nameKey(name);
  if (!key) return undefined;
  const exact = list.find((item) => nameKey(get(item).name) === key);
  if (exact) return exact;
  const target = resolveWasteStream({ ...opts, name, ewc });
  if (!target) return undefined;
  return list.find((item) => {
    const g = get(item);
    return resolveWasteStream({ name: g.name, ewc: g.ewc, source: "weighone" })?.ref === target.ref;
  });
}
