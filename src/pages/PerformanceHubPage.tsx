import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3, Database, Radio, Gauge, AlertTriangle } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { useEffect } from "react";

const PerformanceHubPage = () => {
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
            <Link to="/portal">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Portal</span>
              </Button>
            </Link>
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <h1 className="text-4xl font-bold text-center text-foreground mb-12">
            PERFORMANCE HUB
          </h1>

          {/* Section Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Waste KPIs */}
            <Link to="/performance-hub/waste-kpis" className="group">
              <div className="h-full p-8 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Gauge className="h-12 w-12 text-primary-foreground" />
                  <h2 className="text-xl font-bold text-primary-foreground uppercase tracking-wide">
                    Waste KPIs
                  </h2>
                  <p className="text-primary-foreground/80 text-sm">
                    Zero to Landfill and Grade C Wood recovery tracking
                  </p>
                </div>
              </div>
            </Link>

            {/* Business Reports */}
            <Link to="/performance-hub/reports" className="group">
              <div className="h-full p-8 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                <div className="flex flex-col items-center text-center space-y-4">
                  <BarChart3 className="h-12 w-12 text-primary-foreground" />
                  <h2 className="text-xl font-bold text-primary-foreground uppercase tracking-wide">
                    Business Reports
                  </h2>
                  <p className="text-primary-foreground/80 text-sm">
                    Analytics, tracking, and AI-powered insights for business performance
                  </p>
                </div>
              </div>
            </Link>

            {/* Live Jobs */}
            <Link to="/performance-hub/live-jobs" className="group">
              <div className="h-full p-8 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Radio className="h-12 w-12 text-primary-foreground" />
                  <h2 className="text-xl font-bold text-primary-foreground uppercase tracking-wide">
                    Live Jobs
                  </h2>
                  <p className="text-primary-foreground/80 text-sm">
                    Live container tracking — Skips, RoRos and Artics on-site
                  </p>
                </div>
              </div>
            </Link>

            {/* Data Uploads */}
            <Link to="/performance-hub/data" className="group">
              <div className="h-full p-8 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Database className="h-12 w-12 text-primary-foreground" />
                  <h2 className="text-xl font-bold text-primary-foreground uppercase tracking-wide">
                    Data Uploads
                  </h2>
                  <p className="text-primary-foreground/80 text-sm">
                    Upload and manage Skiptrak and Midweigh operational data
                  </p>
                </div>
              </div>
            </Link>

            {/* Contaminations */}
            <Link to="/performance-hub/contaminations" className="group">
              <div className="h-full p-8 rounded-xl bg-destructive hover:bg-destructive/90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                <div className="flex flex-col items-center text-center space-y-4">
                  <AlertTriangle className="h-12 w-12 text-destructive-foreground" />
                  <h2 className="text-xl font-bold text-destructive-foreground uppercase tracking-wide">
                    Contaminations
                  </h2>
                  <p className="text-destructive-foreground/80 text-sm">
                    Track and manage contamination queries, charges and communications
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PerformanceHubPage;
