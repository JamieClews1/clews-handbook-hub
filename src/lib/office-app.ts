import { QUICK_LINKS, STAFF_NAV_GROUPS, navigationAllowed, type NavigationAccess, type StaffNavItem } from "@/lib/staff-navigation";

/**
 * Office App: a launcher for office staff. Tiles point at existing staff pages and reuse the
 * staff-navigation registry entries, so the same section-visibility and role gates apply.
 */
export const OFFICE_APP_PATH = "/office";
export const STARTING_PIN = "1234";

export type OfficeTile = { label: string; description: string; path: string; navPath: string };

export const OFFICE_APP_TILES: OfficeTile[] = [
  { label: "Diary", description: "Office diary and week notes", path: "/diary", navPath: "/diary" },
  { label: "Load Reports Input", description: "Tally and submit load reports", path: "/load-reports", navPath: "/load-reports" },
  { label: "Stock Check", description: "Live yard stock and inventory", path: "/performance-hub/stock-check", navPath: "/performance-hub/stock-check" },
  { label: "Weighbridge App", description: "WeighOne tablet view", path: "/weigh-one?tablet=1", navPath: "/weigh-one" },
  { label: "Near Misses", description: "Report and review near misses", path: "/near-miss", navPath: "/near-miss" },
  { label: "Toolbox Talks", description: "Read and sign toolbox talks", path: "/toolbox-talks", navPath: "/toolbox-talks" },
  { label: "RAMS", description: "Risk assessments and method statements", path: "/rams", navPath: "/rams" },
  { label: "Walk Around Checks", description: "Site inspections and job list", path: "/walk-around-checks", navPath: "/walk-around-checks" },
];

const ALL_NAV: StaffNavItem[] = [...QUICK_LINKS, ...STAFF_NAV_GROUPS.flatMap((g) => g.items)];

export function officeTileNavItem(tile: OfficeTile): StaffNavItem | undefined {
  return ALL_NAV.find((item) => item.path === tile.navPath);
}

/** Tiles this person may open, using the same gates as the sidebar. */
export function visibleOfficeTiles(access: NavigationAccess, hidden: Set<string>, isSuperAdmin: boolean): OfficeTile[] {
  return OFFICE_APP_TILES.filter((tile) => {
    const item = officeTileNavItem(tile);
    if (!item) return false;
    if (item.key && hidden.has(item.key) && !isSuperAdmin) return false;
    return navigationAllowed(item, access);
  });
}

/** Same rule the server applies when someone chooses their own PIN. */
export function newPinProblem(pin: string, confirm?: string): string | null {
  if (!/^\d{4}$/.test(pin)) return "Your new PIN must be 4 digits.";
  if (pin === STARTING_PIN) return "Pick a PIN that isn't 1234.";
  if (/^(\d)\1{3}$/.test(pin)) return "Pick a PIN that isn't the same digit four times.";
  if (confirm !== undefined && confirm !== pin) return "The two PINs don't match.";
  return null;
}

/** Username typed into the Office App: the part of the work email before the @. */
export function normaliseOfficeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/* ─── Device state ───────────────────────────────────────────────────────────
 * Each person signs in once per device with their portal password. The device then remembers
 * their session so their PIN can unlock it later. "Locked" keeps sessions on the device but
 * sends every staff page back to the Office App until someone enters their PIN.
 */
const MODE_KEY = "office-app-mode";
const LOCK_KEY = "office-app-locked";
const PEOPLE_KEY = "office-app-people";

export type RememberedPerson = { userId: string; username: string; name: string | null; refreshToken: string };

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage unavailable */ }
};

export const isOfficeMode = () => read(MODE_KEY) === "1";
export const setOfficeMode = (on: boolean) => write(MODE_KEY, on ? "1" : null);
export const isOfficeLocked = () => read(LOCK_KEY) === "1";
export const setOfficeLocked = (on: boolean) => {
  write(LOCK_KEY, on ? "1" : null);
  window.dispatchEvent(new Event("office-app-lock"));
};

export function rememberedPeople(): RememberedPerson[] {
  try {
    const parsed = JSON.parse(read(PEOPLE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.userId === "string" && typeof p.refreshToken === "string") : [];
  } catch { return []; }
}

export function rememberPerson(person: RememberedPerson) {
  const others = rememberedPeople().filter((p) => p.userId !== person.userId);
  write(PEOPLE_KEY, JSON.stringify([...others, person]));
}

export function forgetPerson(userId: string) {
  write(PEOPLE_KEY, JSON.stringify(rememberedPeople().filter((p) => p.userId !== userId)));
}

/** Keeps a remembered person's saved session current when the portal refreshes it. */
export function updateRememberedToken(userId: string, refreshToken: string) {
  const people = rememberedPeople();
  const match = people.find((p) => p.userId === userId);
  if (!match || match.refreshToken === refreshToken) return;
  match.refreshToken = refreshToken;
  write(PEOPLE_KEY, JSON.stringify(people));
}
