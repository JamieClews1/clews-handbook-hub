import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MatrixPostcode } from "@/lib/matrix-postcode-zone";

/** Loads every postcode listed on the pricing matrix (read-only). */
export function useMatrixPostcodes() {
  const [rows, setRows] = useState<MatrixPostcode[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("pricing_zone_postcodes")
      .select("postcode_prefix, zone_code, area")
      .order("postcode_prefix")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Failed to load matrix postcodes", error);
        setRows((data ?? []) as MatrixPostcode[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  return { rows, loading };
}
