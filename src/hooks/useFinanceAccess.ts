import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Finance module access: admin, management or the dedicated `finance` role.
 * Mirrors the server-side public.is_finance_user() used by RLS.
 */
export function useFinanceAccess() {
  const { user } = useAuth();
  const [canAccess, setCanAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) {
          setCanAccess(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map((r: any) => String(r.role));
      if (!cancelled) {
        setCanAccess(roles.some((r) => ["admin", "management", "finance"].includes(r)));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { canAccess, loading };
}
