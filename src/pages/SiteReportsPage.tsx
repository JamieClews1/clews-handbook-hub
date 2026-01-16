import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";

const SiteReportsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/portal">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Portal
                </Button>
              </Link>
            </div>
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
              <ClipboardList className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Site Reports</h1>
              <p className="text-muted-foreground">Weekly and monthly site reports for operational compliance</p>
            </div>
          </div>

          {/* Placeholder Content */}
          <div className="bg-card border border-amber-500/30 rounded-lg p-8 text-center">
            <ClipboardList className="h-16 w-16 text-amber-500/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Site Reports Coming Soon</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              This section will house weekly and monthly site reports for operational compliance and monitoring.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SiteReportsPage;
