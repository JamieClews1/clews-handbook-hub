import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface StaffRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that ensures only Clews staff (users with a role in user_roles)
 * can access the wrapped route. Portal-only customers are redirected to /my-portal.
 */
export const StaffRoute = ({ children }: StaffRouteProps) => {
  const { user, loading } = useAuth();
  const [isStaff, setIsStaff] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsStaff(null);
      return;
    }

    const checkStaff = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (error) {
        console.error("Error checking staff role:", error);
        setIsStaff(false);
        return;
      }

      setIsStaff(data && data.length > 0);
    };

    checkStaff();
  }, [user]);

  // Still loading auth
  if (loading || (user && isStaff === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Not logged in — redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Logged in but not staff — redirect to customer portal
  if (!isStaff) {
    return <Navigate to="/my-portal" replace />;
  }

  return <>{children}</>;
};
