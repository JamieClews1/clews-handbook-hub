import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
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

      <main className="container mx-auto px-4 py-8 max-w-screen-2xl space-y-8">
        {/* Title row */}
        <PageHeading title="STACI Reports" description="Pallet costs and recycling breakdown" />

        <StaciReportsDashboard />

        {/* Clews branding footer */}
      </main>
    </div>
  );
};

export default StaciReportsPage;
