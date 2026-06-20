import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { StaciReportsDashboard } from "@/components/staci/StaciReportsDashboard";

const StaciReportsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/portal">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-screen-2xl space-y-8">
        {/* Title row */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Package className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">STACI Reports</h1>
            <p className="text-muted-foreground">Pallet costs & recycling breakdown</p>
          </div>
        </div>

        <StaciReportsDashboard />

        {/* Clews branding footer */}
        <div className="flex items-center justify-center gap-3 py-6 opacity-50">
          <img src={clewsLogo} alt="Clews Recycling" className="h-6 w-auto" />
          <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Clews Recycling</span>
        </div>
      </main>
    </div>
  );
};

export default StaciReportsPage;
