import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ClipboardList, Eye, Package } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import MonthlyInspectionForm from "@/components/site-reports/MonthlyInspectionForm";
import InspectionReportsList from "@/components/site-reports/InspectionReportsList";
import StockReportTally from "@/components/site-reports/StockReportTally";
import StockReportsList from "@/components/site-reports/StockReportsList";
import StockReportSettings from "@/components/site-reports/StockReportSettings";

type InspectionView = "list" | "form";
type StockView = "list" | "tally" | "settings";

const SiteReportsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("monthly");
  const [inspectionView, setInspectionView] = useState<InspectionView>("list");
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>();
  const [stockView, setStockView] = useState<StockView>("list");
  const [selectedStockReportId, setSelectedStockReportId] = useState<string | undefined>();

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

  if (!user) return null;

  const handleNewReport = () => {
    setSelectedReportId(undefined);
    setInspectionView("form");
  };

  const handleViewReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setInspectionView("form");
  };

  const handleBackToList = () => {
    setSelectedReportId(undefined);
    setInspectionView("list");
  };

  const showBackToReports = activeTab === "monthly" && inspectionView === "form";
  const showBackToStock = activeTab === "stock" && stockView !== "list";
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {showBackToReports ? (
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4" />
                Back to Reports
              </Button>
            ) : showBackToStock ? (
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setStockView("list")}>
                <ArrowLeft className="h-4 w-4" />
                Back to Stock
              </Button>
            ) : (
              <Link to="/portal">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Portal
                </Button>
              </Link>
            )}
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Site Reports</h1>
              <p className="text-muted-foreground text-sm">Inspections, walkarounds & stock</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setInspectionView("list"); setStockView("list"); setSelectedStockReportId(undefined); }} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="monthly" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <ClipboardList className="h-4 w-4" />
                <span>Monthly</span>
              </TabsTrigger>
              <TabsTrigger value="walkaround" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Eye className="h-4 w-4" />
                <span>Walkaround</span>
              </TabsTrigger>
              <TabsTrigger value="stock" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Package className="h-4 w-4" />
                <span>Stock</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monthly">
              {inspectionView === "list" ? (
                <InspectionReportsList onNewReport={handleNewReport} onViewReport={handleViewReport} />
              ) : (
                <MonthlyInspectionForm reportId={selectedReportId} onSave={handleBackToList} />
              )}
            </TabsContent>

            <TabsContent value="walkaround">
              <div className="text-center py-16 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Daily Walkaround</p>
                <p className="text-sm">Coming soon</p>
              </div>
            </TabsContent>

            <TabsContent value="stock">
              {stockView === "list" ? (
                <StockReportsList
                  onNewReport={() => { setSelectedStockReportId(undefined); setStockView("tally"); }}
                  onSettings={() => setStockView("settings")}
                  onViewReport={(id) => { setSelectedStockReportId(id); setStockView("tally"); }}
                />
              ) : stockView === "tally" ? (
                <StockReportTally reportId={selectedStockReportId} onSaved={() => { setSelectedStockReportId(undefined); setStockView("list"); }} />
              ) : (
                <StockReportSettings />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default SiteReportsPage;
