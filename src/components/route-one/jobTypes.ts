import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type JobTypeDef = {
  id?: string;
  key: string;
  label: string;
  color: string;
  display_order: number;
  is_active: boolean;
};

/** Fallback list used before the configured job types load (and if none exist). */
export const DEFAULT_JOB_TYPES: JobTypeDef[] = [
  { key: "delivery", label: "Deliver", color: "emerald", display_order: 1, is_active: true },
  { key: "exchange", label: "Exchange", color: "amber", display_order: 2, is_active: true },
  { key: "tip_return", label: "Tip & Return", color: "violet", display_order: 3, is_active: true },
  { key: "waste_truck", label: "Waste Truck", color: "blue", display_order: 4, is_active: true },
  { key: "pickup", label: "Pickup", color: "orange", display_order: 5, is_active: true },
  { key: "seven_five_tonne", label: "7.5 Tonne", color: "cyan", display_order: 6, is_active: true },
];

export const JOB_TYPE_COLOR_OPTIONS = [
  "emerald", "amber", "orange", "blue", "violet", "cyan", "red", "slate",
];

const SOLID: Record<string, string> = {
  emerald: "bg-emerald-600 border-emerald-700 text-white",
  amber: "bg-amber-500 border-amber-600 text-white",
  orange: "bg-orange-500 border-orange-600 text-white",
  blue: "bg-blue-600 border-blue-700 text-white",
  violet: "bg-violet-600 border-violet-700 text-white",
  cyan: "bg-cyan-600 border-cyan-700 text-white",
  red: "bg-red-600 border-red-700 text-white",
  slate: "bg-slate-600 border-slate-700 text-white",
};

const ACCENT: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  red: "bg-red-500",
  slate: "bg-slate-500",
};

// Module-level registry so plain helper functions (used deep inside render trees)
// can resolve labels/colours without threading props everywhere.
let registry: JobTypeDef[] = DEFAULT_JOB_TYPES;

const prettify = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const find = (key: string) => registry.find((t) => t.key === key);

export const jobTypeLabel = (key: string) => find(key)?.label ?? prettify(key || "");
export const jobTypeSolidClass = (key: string) =>
  SOLID[find(key)?.color ?? "slate"] ?? SOLID.slate;
export const jobTypeAccentClass = (key: string) =>
  ACCENT[find(key)?.color ?? "slate"] ?? ACCENT.slate;
export const colorSolidClass = (color: string) => SOLID[color] ?? SOLID.slate;
export const getJobTypes = () => registry;

/** Load the configured job types (active only unless includeInactive). */
export function useJobTypes(includeInactive = false) {
  const [types, setTypes] = useState<JobTypeDef[]>(registry);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from("route_one_job_types")
      .select("id, key, label, color, display_order, is_active")
      .order("display_order");
    if (!error && data?.length) {
      const all = data as JobTypeDef[];
      registry = all.filter((t) => t.is_active);
      setTypes(includeInactive ? all : registry);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [includeInactive]);

  return { types, loading, refetch: load };
}
