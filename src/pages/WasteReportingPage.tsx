import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Recycle } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { FacilityRecyclingForm } from "@/components/waste-reporting/FacilityRecyclingForm";
import { FormsList } from "@/components/waste-reporting/FormsList";

type ViewMode = 'list' | 'create' | 'edit' | 'view';

const WasteReportingPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

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

  const handleCreateNew = () => {
    setSelectedFormId(null);
    setViewMode('create');
  };

  const handleEditForm = (formId: string) => {
    setSelectedFormId(formId);
    setViewMode('edit');
  };

  const handleViewForm = (formId: string) => {
    setSelectedFormId(formId);
    setViewMode('view');
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedFormId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {viewMode === 'list' ? (
                <Link to="/portal">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Back to Portal</span>
                  </Button>
                </Link>
              ) : (
                <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Forms</span>
                </Button>
              )}
              <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {viewMode === 'list' && (
            <>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
                  <Recycle className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Waste Reporting</h1>
                  <p className="text-muted-foreground">Manage facility recycling forms and waste tracking</p>
                </div>
              </div>
              <FormsList
                onCreateNew={handleCreateNew}
                onEditForm={handleEditForm}
                onViewForm={handleViewForm}
              />
            </>
          )}

          {viewMode === 'create' && (
            <FacilityRecyclingForm onSave={handleBack} />
          )}

          {viewMode === 'edit' && selectedFormId && (
            <FacilityRecyclingForm formId={selectedFormId} onSave={handleBack} />
          )}

          {viewMode === 'view' && selectedFormId && (
            <FacilityRecyclingForm formId={selectedFormId} readOnly />
          )}
        </div>
      </main>
    </div>
  );
};

export default WasteReportingPage;
