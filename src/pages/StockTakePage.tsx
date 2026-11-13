import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeading } from "@/components/PageHeading";
import { StockCheckTally } from "@/components/stock-check/StockCheckTally";

/**
 * Standalone New Stock Take page — just the tally, without the Stock Check
 * dashboard tabs. Opened from the Office App's Stock Check tile.
 */
const StockTakePage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <Link to="/office" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Office App
          </Link>
          <PageHeading title="New Stock Take" description="Count the skips and RoRos in the yard, plus any runners" />
          <StockCheckTally userId={user.id} onComplete={() => navigate("/office")} />
        </div>
      </main>
    </div>
  );
};

export default StockTakePage;
