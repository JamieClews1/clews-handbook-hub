/** Shared helpers for the Stock Check "filter by size" control. */

export interface SizeFilterOption {
  id: string;
  name: string;
  group?: string;
}

/**
 * Empty selection means "no filter" so the stock tables stay unchanged by default.
 * Unknown ids are ignored, and the original display order is preserved.
 */
export function filterTypesBySize<T extends { id: string }>(types: T[], selected: string[]): T[] {
  if (selected.length === 0) return types;
  const set = new Set(selected);
  return types.filter((t) => set.has(t.id));
}

/** Distinct, non-blank size values (e.g. free-text inventory sizes) in numeric order. */
export function sizeOptionsFromValues(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = (value ?? "").trim();
    if (trimmed) set.add(trimmed);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
