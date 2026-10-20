import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";

export function useCompanyPlAccess() {
  const { user } = useAuth();
  const [allowedUser, setAllowedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setAllowedUser(null);
    if (user) {
      withTimeout(supabase.rpc("has_company_pl_access"), 12000, "Private Finance access")
        .then(({ data, error }) => {
          if (!cancelled && !error && data === true) setAllowedUser(user.id);
        })
        .catch(() => { /* Fail closed: never show private finance on an access-check failure. */ })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else if (!cancelled) {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [user?.id]);
  return { canAccessPl: Boolean(user && allowedUser === user.id), loading };
}