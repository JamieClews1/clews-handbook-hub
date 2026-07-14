import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePortalSectionVisibility() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("portal_section_visibility")
      .select("section_key, hidden");
    const s = new Set<string>();
    (data ?? []).forEach((r: any) => {
      if (r.hidden) s.add(r.section_key);
    });
    setHidden(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("portal_section_visibility_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_section_visibility" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const isHidden = useCallback((key: string) => hidden.has(key), [hidden]);
  return { isHidden, hidden, loading, reload: load };
}
