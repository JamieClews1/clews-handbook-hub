import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type ZoneRow = { zone_name: string; postcodes: string[] };

/** Build match candidates: full postcode, outward + first inward digit, outward only. */
function candidates(input: string): string[] {
  const pc = (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (pc.length < 2) return [];
  const out: string[] = [];
  if (pc.length >= 5) {
    const outward = pc.slice(0, -3);
    const inward = pc.slice(-3);
    out.push(`${outward}${inward}`, `${outward} ${inward}`, `${outward} ${inward[0]}`, `${outward}${inward[0]}`, outward);
  } else {
    out.push(pc);
  }
  return out;
}

/** Look up which configured postcode zone a postcode falls into. */
export function usePostcodeZoneLookup() {
  const [zones, setZones] = useState<ZoneRow[]>([]);

  useEffect(() => {
    supabase
      .from("postcode_zones")
      .select("zone_name, postcodes")
      .order("display_order")
      .then(({ data }) => setZones((data ?? []) as ZoneRow[]));
  }, []);

  const zoneFor = useCallback(
    (postcode: string | null | undefined): string | null => {
      if (!postcode || zones.length === 0) return null;
      const vars = candidates(postcode);
      if (vars.length === 0) return null;
      // Prefer the most specific match (longest candidate first)
      for (const v of vars) {
        for (const z of zones) {
          const set = new Set((z.postcodes || []).map((p) => p.toUpperCase().replace(/\s+/g, "")));
          if (set.has(v.replace(/\s+/g, ""))) return z.zone_name;
        }
      }
      return null;
    },
    [zones]
  );

  return { zoneFor, zonesLoaded: zones.length > 0 };
}
