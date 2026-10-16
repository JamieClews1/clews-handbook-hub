// Distinct colour per staff user, shared by every screen that shows who wrote
// or owns a record — rental chases, notes, activity logs. Colours are stable
// per key (hashed from the user id or name), so the same person always keeps
// the same colour across the portal.
export const USER_COLOURS = [
  "#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
];

export function userColour(key: string | null | undefined): string {
  if (!key) return USER_COLOURS[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return USER_COLOURS[hash % USER_COLOURS.length];
}
