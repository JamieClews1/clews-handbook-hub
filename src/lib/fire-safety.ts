export const FIRE_ROLES: { value: string; label: string }[] = [
  { value: "responsible_person", label: "Responsible Person" },
  { value: "deputy_responsible_person", label: "Deputy Responsible Person" },
  { value: "fire_warden", label: "Fire Warden / Marshal" },
  { value: "assembly_point_marshal", label: "Assembly Point Marshal" },
  { value: "first_aider", label: "First Aider" },
  { value: "other", label: "Other" },
];

export const fireRoleLabel = (value: string) =>
  FIRE_ROLES.find((r) => r.value === value)?.label ?? value;

export interface FirePerson {
  id: string;
  full_name: string;
  role: string;
  area: string | null;
  phone: string | null;
  email: string | null;
  appointed_on: string | null;
  training_expiry: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
}

export const ASSEMBLY_POINT = "Main gate, adjacent to the weighbridge — Unit 17, Hunters Lane, Rugby CV21 1EA";

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

export const daysUntil = (date: Date) =>
  Math.floor((date.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);

export const fmt = (iso?: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB") : "—";
