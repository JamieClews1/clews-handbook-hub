import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/with-timeout";

export function useCompanyPlAccess() {
  const { user } = useAuth();
  const [allowedUser, setAllowedUser] = useState<string | null>(null);
  const [managerUser, setManagerUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setAllowedUser(null);
    setManagerUser(null);
    setLoading(true);
    if (user) {
      withTimeout(Promise.all([supabase.rpc("has_company_pl_access"), supabase.rpc("can_manage_company_pl_access")]), 12000, "Private Finance access")
        .then(([access, manager]) => {
          if (!cancelled && !access.error && access.data === true) setAllowedUser(user.id);
          if (!cancelled && !manager.error && manager.data === true) setManagerUser(user.id);
        })
        .catch(() => { /* Fail closed: never show private finance on an access-check failure. */ })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else if (!cancelled) {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [user?.id]);
  return { canAccessPl: Boolean(user && allowedUser === user.id), canManagePl: Boolean(user && managerUser === user.id), loading };
}