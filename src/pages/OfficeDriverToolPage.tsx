import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DriverSkipTracker from "@/components/driver/DriverSkipTracker";
import DriverContaminationsHub from "@/components/driver/DriverContaminationsHub";
import { emailToUsername } from "@/lib/auth-utils";

/**
 * The Driver App's Skip Tracker and Contaminations, opened from the Office App by staff signed in
 * with their own portal account (reporter type "office"), so reports land in the same records.
 */
const OfficeDriverToolPage = ({ tool }: { tool: "skip-tracker" | "contaminations" }) => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fallback = user.email ? emailToUsername(user.email) : "Office";
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setName(data?.full_name?.trim() || fallback));
  }, [user]);

  if (loading || !user || !name) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  const reporter = { id: user.id, name, type: "office" as const };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl">
        <Link to="/office" className="inline-flex items-center gap-1.5 px-4 pt-4 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Office App
        </Link>
        {tool === "skip-tracker" ? (
          <DriverSkipTracker reporter={reporter} userName={name} />
        ) : (
          <DriverContaminationsHub reporter={reporter} userName={name} />
        )}
      </div>
    </div>
  );
};

export default OfficeDriverToolPage;
