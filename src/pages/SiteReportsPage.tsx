import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import MonthlyInspectionForm from "@/components/site-reports/MonthlyInspectionForm";
import InspectionReportsList from "@/components/site-reports/InspectionReportsList";

type View = 'list' | 'form';

const SiteReportsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>();

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

  const handleNewReport = () => {
    setSelectedReportId(undefined);
    setCurrentView('form');
  };

  const handleViewReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setCurrentView('form');
  };

  const handleBackToList = () => {
    setSelectedReportId(undefined);
    setCurrentView('list');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {currentView === 'list' ? (
              <Link to="/portal">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Portal
                </Button>
              </Link>
            ) : (
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4" />
                Back to Reports
              </Button>
            )}
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Monthly Site Inspection</h1>
              <p className="text-muted-foreground text-sm">
                {currentView === 'list' ? 'View and manage inspection reports' : 'Complete the inspection checklist below'}
              </p>
            </div>
          </div>

          {currentView === 'list' ? (
            <InspectionReportsList 
              onNewReport={handleNewReport} 
              onViewReport={handleViewReport} 
            />
          ) : (
            <MonthlyInspectionForm 
              reportId={selectedReportId} 
              onSave={handleBackToList} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default SiteReportsPage;
