// Distinct colour per staff user, shared by every screen that shows who wrote
// or owns a record — rental chases, notes, activity logs. Colours are stable
// per key (hashed from the user id or name), so the same person always keeps
// the same colour across the portal.
export const USER_COLOURS = [
  "#2563eb", "#dc2626", "#059669", "#d97706",
  "#7c3aed", "#0891b2", "#db2777", "#65a30d",
  "#ea580c", "#4f46e5", "#0d9488", "#be185d",
  "#9333ea", "#0284c7", "#b45309", "#15803d",
];

// FNV-1a hash — spreads similar keys (e.g. sequential uuids) across the
// palette far better than a simple multiply-add hash, so two staff members
// are very unlikely to share a colour.
export function userColour(key: string | null | undefined): string {
  if (!key) return USER_COLOURS[0];
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return USER_COLOURS[hash % USER_COLOURS.length];
}

// Gives each id in a known set (e.g. the office staff list) its own palette
// colour, so two people on the same screen never share one. Stable as long as
// the set is sorted the same way — sort by name before calling.
export function assignUserColours(ids: string[]): Map<string, string> {
  const map = new Map<string, string>();
  ids.forEach((id, i) => map.set(id, USER_COLOURS[i % USER_COLOURS.length]));
  return map;
}
