import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePortalSectionVisibility() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [allowed, setAllowed] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("portal_section_visibility")
      .select("section_key, hidden, allowed_user_ids");
    const s = new Set<string>();
    const a: Record<string, string[]> = {};
    (data ?? []).forEach((r: any) => {
      if (r.hidden) s.add(r.section_key);
      if (r.allowed_user_ids?.length) a[r.section_key] = r.allowed_user_ids;
    });
    setHidden(s);
    setAllowed(a);
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
  /** null = no named-people list; otherwise whether this user is on it. */
  const restrictedAllows = useCallback((key: string): boolean | null => {
    const list = allowed[key];
    if (!list) return null;
    return !!user && list.includes(user.id);
  }, [allowed, user]);
  return { isHidden, hidden, loading, reload: load, restrictedAllows };
}
