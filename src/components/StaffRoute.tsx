import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { withTimeout } from "@/lib/with-timeout";
import { isOfficeLocked, isOfficeMode, OFFICE_APP_PATH } from "@/lib/office-app";
import { launchScope, LOAD_REPORTS_SIGN_IN_PATH } from "@/lib/load-reports-app";

interface StaffRouteProps {
  children: React.ReactNode;
}

const STAFF_CHECK_TIMEOUT_MS = 12000;

/**
 * Route guard that ensures only Clews staff (users with a role in user_roles)
 * can access the wrapped route. Portal-only customers are redirected to /my-portal.
 * A failed or stalled role check shows a retry screen instead of spinning forever.
 */
export const StaffRoute = ({ children }: StaffRouteProps) => {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const userId = user?.id ?? null;
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [checkError, setCheckError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) {
      setIsStaff(null);
      setCheckError(false);
      return;
    }

    let cancelled = false;
    setCheckError(false);

    const checkStaff = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.from("user_roles").select("id").eq("user_id", userId).limit(1),
          STAFF_CHECK_TIMEOUT_MS,
          "Staff check",
        );
        if (cancelled) return;
        if (error) throw error;
        setIsStaff(!!data && data.length > 0);
      } catch (err) {
        console.error("Error checking staff role:", err);
        if (!cancelled) setCheckError(true);
      }
    };

    checkStaff();
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  if (checkError && isStaff === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-lg font-semibold text-foreground">The portal couldn't load</h1>
          <p className="text-sm text-muted-foreground">
            We couldn't confirm your account just now — usually a brief connection issue.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
            <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  // Still loading auth
  if (loading || (user && isStaff === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Office App devices go back to the Office App sign-in; everyone else to the portal sign-in.
  if (!user) {
    if (isOfficeMode()) return <Navigate to={OFFICE_APP_PATH} replace />;
    // Load Reports links keep the Load Reports app details through sign-in, then return there.
    const fromLoadReports = launchScope(location.pathname, location.search) === "load-reports";
    return <Navigate to={fromLoadReports ? LOAD_REPORTS_SIGN_IN_PATH : "/auth"} replace />;
  }

  // A locked Office App keeps sessions on the device but no page opens until someone enters their PIN.
  if (isOfficeLocked()) {
    return <Navigate to={OFFICE_APP_PATH} replace />;
  }

  // Logged in but not staff — redirect to customer portal
  if (!isStaff) {
    return <Navigate to="/my-portal" replace />;
  }

  return <>{children}</>;
};
