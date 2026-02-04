import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";

import { CustomerTypeSelector, CustomerType } from "@/components/load-reports/CustomerTypeSelector";
import { NewLoadForm } from "@/components/load-reports/NewLoadForm";
import { TallyScreen, LineItem } from "@/components/load-reports/TallyScreen";
import { LoadReviewScreen } from "@/components/load-reports/LoadReviewScreen";
import { LoadReportsList } from "@/components/load-reports/LoadReportsList";
import { OfflineIndicator } from "@/components/load-reports/OfflineIndicator";
import { useOfflineLoadReports } from "@/hooks/useOfflineLoadReports";
import { initAutoSync } from "@/lib/sync-service";
import { cacheWasteTypes, cacheSites } from "@/lib/offline-db";

type ViewMode = "customer" | "list" | "new" | "tally" | "review";

interface WasteType {
  id: string;
  waste_type: string;
  default_avg_weight_kg: number;
  display_order: number;
  pallet_weight_kg: number;
}

const LoadReportsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>("customer");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerType | null>(null);
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [defaultPalletWeight, setDefaultPalletWeight] = useState(20);

  // Sites state
  interface SiteOption {
    id: string;
    site_name: string;
  }
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

  // Form state
  const [operatorName, setOperatorName] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [weighbridgeWeightKg, setWeighbridgeWeightKg] = useState<number | null>(null);
  const [weighbridgeLoading, setWeighbridgeLoading] = useState(false);

  // Offline support
  const {
    isOnline,
    pendingCount,
    syncNow,
    saveReport: saveOfflineReport,
    refreshData: refreshOfflineData,
  } = useOfflineLoadReports(user?.id);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Initialize auto-sync on mount
    const cleanup = initAutoSync();
    return cleanup;
  }, []);

  useEffect(() => {
    fetchWasteTypes();
    fetchDefaultPalletWeight();
    fetchSites();
  }, []);

  const fetchSites = async () => {
    const { data, error } = await supabase
      .from("customer_sites")
      .select("id, site_name")
      .order("site_name");

    if (!error && data) {
      setSites(data);
      // Cache for offline use
      await cacheSites(data);
    }
  };

  const fetchDefaultPalletWeight = async () => {
    const { data, error } = await supabase
      .from("load_report_settings")
      .select("setting_value")
      .eq("setting_key", "default_pallet_weight_kg")
      .single();
    
    if (!error && data) {
      setDefaultPalletWeight(Number(data.setting_value) || 20);
    }
  };

  useEffect(() => {
    // Prefill operator name from profile
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (data?.full_name) {
      setOperatorName(data.full_name);
    }
  };

  const fetchWasteTypes = async () => {
    const { data, error } = await supabase
      .from("load_waste_types")
      .select("*")
      .order("display_order");

    if (error) {
      console.error("Error fetching waste types:", error);
      return;
    }

    setWasteTypes(data || []);
    // Cache for offline use
    if (data) {
      await cacheWasteTypes(data);
    }
  };

  const fetchWeighbridgeWeightKg = async (ticketOrJobNumber: string) => {
    const ticket = ticketOrJobNumber.trim();
    if (!ticket) {
      setWeighbridgeWeightKg(null);
      return;
    }

    setWeighbridgeLoading(true);
    try {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("weight_t, job_date")
        .eq("job_number", ticket)
        .maybeSingle();

      if (error) throw error;

      const weightT = data?.weight_t;
      const weightKg = typeof weightT === "number" ? weightT * 1000 : null;
      setWeighbridgeWeightKg(weightKg);

      // Update report date to match the job date if available
      if (data?.job_date) {
        setReportDate(data.job_date);
      }
    } catch {
      // If the user can't access Data Hub rows (RLS) or the record doesn't exist,
      // just hide the value rather than blocking the load report flow.
      setWeighbridgeWeightKg(null);
    } finally {
      setWeighbridgeLoading(false);
    }
  };

  const handleJobNumberChange = (value: string) => {
    setJobNumber(value);

    // Lightweight debounce to avoid hammering queries while typing
    window.clearTimeout((handleJobNumberChange as any)._t);
    (handleJobNumberChange as any)._t = window.setTimeout(() => {
      fetchWeighbridgeWeightKg(value);
    }, 300);
  };

  const initializeLineItems = () => {
    const items: LineItem[] = wasteTypes.map((wt) => ({
      waste_type: wt.waste_type,
      pallet_count: 0,
      avg_weight_kg: Number(wt.default_avg_weight_kg),
      total_weight_kg: 0,
      display_order: wt.display_order,
      pallet_weight_kg: defaultPalletWeight,
    }));
    setLineItems(items);
  };

  const handleNewReport = async () => {
    setCurrentReportId(null);
    setOperatorName("");
    setVehicleReg("");
    setJobNumber("");
    setSelectedSiteId("");
    setReportDate(new Date().toISOString().split("T")[0]);
    
    // Fetch latest waste types to ensure we have current default weights
    const { data, error } = await supabase
      .from("load_waste_types")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (!error && data) {
      setWasteTypes(data);
      const items: LineItem[] = data.map((wt) => ({
        waste_type: wt.waste_type,
        pallet_count: 0,
        avg_weight_kg: Number(wt.default_avg_weight_kg),
        total_weight_kg: 0,
        display_order: wt.display_order,
        pallet_weight_kg: defaultPalletWeight,
      }));
      setLineItems(items);
    } else {
      initializeLineItems();
    }
    
    fetchUserProfile();
    setViewMode("new");
  };

  const handleViewReport = async (reportId: string) => {
    setIsSaving(true);
    try {
      // Fetch report
      const { data: report, error: reportError } = await supabase
        .from("load_reports")
        .select("*")
        .eq("id", reportId)
        .single();

      if (reportError) throw reportError;

      // Fetch line items
      const { data: items, error: itemsError } = await supabase
        .from("load_line_items")
        .select("*")
        .eq("load_report_id", reportId)
        .order("display_order");

      if (itemsError) throw itemsError;

      setCurrentReportId(reportId);
      setOperatorName(report.operator_name);
      setVehicleReg(report.vehicle_reg || "");
      setJobNumber(report.notes || ""); // Using notes field for job number temporarily
      setSelectedSiteId(report.site_id || "");
      setReportDate(report.report_date);
      fetchWeighbridgeWeightKg(report.notes || "");
      
      if (items && items.length > 0) {
        setLineItems(
          items.map((item) => ({
            waste_type: item.waste_type,
            pallet_count: item.pallet_count,
            avg_weight_kg: Number(item.avg_weight_kg),
            total_weight_kg: Number(item.total_weight_kg),
            display_order: item.display_order,
            pallet_weight_kg: defaultPalletWeight,
          }))
        );
      } else {
        initializeLineItems();
      }

      // Go to review for submitted reports, tally for drafts
      setViewMode(report.status === "submitted" ? "review" : "tally");
    } catch (error: any) {
      toast({
        title: "Error loading report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditReport = async (reportId: string) => {
    setIsSaving(true);
    try {
      // Fetch report
      const { data: report, error: reportError } = await supabase
        .from("load_reports")
        .select("*")
        .eq("id", reportId)
        .single();

      if (reportError) throw reportError;

      // Fetch line items
      const { data: items, error: itemsError } = await supabase
        .from("load_line_items")
        .select("*")
        .eq("load_report_id", reportId)
        .order("display_order");

      if (itemsError) throw itemsError;

      setCurrentReportId(reportId);
      setOperatorName(report.operator_name);
      setVehicleReg(report.vehicle_reg || "");
      setJobNumber(report.notes || ""); // Using notes field for job number temporarily
      setSelectedSiteId(report.site_id || "");
      setReportDate(report.report_date);
      fetchWeighbridgeWeightKg(report.notes || "");

      if (items && items.length > 0) {
        setLineItems(
          items.map((item) => ({
            waste_type: item.waste_type,
            pallet_count: item.pallet_count,
            avg_weight_kg: Number(item.avg_weight_kg),
            total_weight_kg: Number(item.total_weight_kg),
            display_order: item.display_order,
            pallet_weight_kg: defaultPalletWeight,
          }))
        );
      } else {
        initializeLineItems();
      }

      // Always open the editable form view
      setViewMode("new");
    } catch (error: any) {
      toast({
        title: "Error loading report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTally = () => {
    if (lineItems.length === 0) {
      initializeLineItems();
    }
    setViewMode("tally");
  };

  const handleLineItemChange = (index: number, updates: Partial<LineItem>) => {
    setLineItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], ...updates };
      return newItems;
    });
  };

  const calculateTotals = () => {
    const totalPallets = lineItems.reduce((sum, item) => sum + item.pallet_count, 0);
    const totalWeight = lineItems.reduce(
      (sum, item) => sum + item.pallet_count * item.avg_weight_kg,
      0
    );
    return { totalPallets, totalWeight };
  };

  const saveReport = async (submit: boolean) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { totalPallets, totalWeight } = calculateTotals();

      // Use offline-first storage
      const offlineLineItems = lineItems.map((item) => ({
        wasteType: item.waste_type,
        palletCount: item.pallet_count,
        avgWeightKg: item.avg_weight_kg,
        totalWeightKg: item.pallet_count * item.avg_weight_kg,
        displayOrder: item.display_order,
      }));

      await saveOfflineReport({
        serverId: currentReportId || undefined,
        operatorId: user.id,
        operatorName: operatorName,
        vehicleReg: vehicleReg || null,
        jobNumber: jobNumber || null,
        siteId: selectedSiteId || null,
        reportDate: reportDate,
        status: submit ? "submitted" : "draft",
        totalPallets: totalPallets,
        totalWeightKg: totalWeight,
        lineItems: offlineLineItems,
      });

      toast({
        title: submit ? "Load Submitted" : "Draft Saved",
        description: isOnline
          ? submit
            ? "Your load report has been submitted successfully."
            : "Your draft has been saved."
          : "Saved locally. Will sync when online.",
      });

      if (submit) {
        setViewMode("list");
      }
    } catch (error: any) {
      toast({
        title: "Error saving report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!currentReportId) return;
    setIsSaving(true);

    try {
      // Delete from server if it exists there
      const { error: itemsError } = await supabase
        .from("load_line_items")
        .delete()
        .eq("load_report_id", currentReportId);
      if (itemsError) throw itemsError;

      const { error } = await supabase
        .from("load_reports")
        .delete()
        .eq("id", currentReportId);
      if (error) throw error;

      toast({
        title: "Report Deleted",
        description: "The load report has been deleted.",
      });

      setCurrentReportId(null);
      setViewMode("list");
    } catch (error: any) {
      toast({
        title: "Error deleting report",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    switch (viewMode) {
      case "list":
        setViewMode("customer");
        setSelectedCustomer(null);
        break;
      case "new":
        setViewMode("list");
        break;
      case "tally":
        setViewMode("new");
        break;
      case "review":
        setViewMode("tally");
        break;
      default:
        setViewMode("customer");
    }
  };

  const handleCustomerSelect = (customer: CustomerType) => {
    setSelectedCustomer(customer);
    setViewMode("list");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getHeaderTitle = () => {
    switch (viewMode) {
      case "customer":
        return "Load Reports";
      case "list":
        return selectedCustomer ? `${selectedCustomer.toUpperCase()} Reports` : "Load Reports";
      case "new":
        return "New Load";
      case "tally":
        return "Tally Pallets";
      case "review":
        return "Review Load";
      default:
        return "Load Reports";
    }
  };

  const handleManualSync = async () => {
    setIsSyncingManual(true);
    try {
      const { synced, errors } = await syncNow();
      if (synced > 0) {
        toast({
          title: "Synced",
          description: `${synced} report(s) uploaded successfully`,
        });
      }
      if (errors > 0) {
        toast({
          title: "Sync errors",
          description: `${errors} report(s) failed to sync`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSyncingManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {viewMode === "customer" ? (
                <Link to="/portal">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Portal</span>
                  </Button>
                </Link>
              ) : (
                <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-amber-500" />
                <span className="font-semibold text-foreground hidden sm:inline">{getHeaderTitle()}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <OfflineIndicator
                isOnline={isOnline}
                pendingCount={pendingCount}
                isSyncing={isSyncingManual}
                onSyncNow={handleManualSync}
              />
              <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto hidden sm:block" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto">
          {viewMode === "customer" && (
            <CustomerTypeSelector onSelect={handleCustomerSelect} />
          )}

          {viewMode === "list" && (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {selectedCustomer?.toUpperCase()} Load Reports
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Track pallet loads and weights for recyclables
                  </p>
                </div>
              </div>
              <LoadReportsList
                onNewReport={handleNewReport}
                onViewReport={handleViewReport}
                onEditReport={handleEditReport}
              />
            </>
          )}

          {viewMode === "new" && (
            <NewLoadForm
              operatorName={operatorName}
              vehicleReg={vehicleReg}
              jobNumber={jobNumber}
              selectedSiteId={selectedSiteId}
              sites={sites}
              onOperatorNameChange={setOperatorName}
              onVehicleRegChange={setVehicleReg}
              onJobNumberChange={handleJobNumberChange}
              onSiteChange={setSelectedSiteId}
              weighbridgeWeightKg={weighbridgeWeightKg}
              weighbridgeLoading={weighbridgeLoading}
              onLookupWeighbridgeWeight={() => fetchWeighbridgeWeightKg(jobNumber)}
              onStartTally={handleStartTally}
              isValid={operatorName.trim().length > 0}
              isEditing={!!currentReportId}
              onDelete={handleDeleteReport}
              isDeleting={isSaving}
            />
          )}

          {viewMode === "tally" && (
            <TallyScreen
              lineItems={lineItems}
              onLineItemChange={handleLineItemChange}
              onBack={handleBack}
              onReview={() => setViewMode("review")}
            />
          )}

          {viewMode === "review" && (
            <LoadReviewScreen
              operatorName={operatorName}
              vehicleReg={vehicleReg}
              jobNumber={jobNumber}
              weighbridgeWeightKg={weighbridgeWeightKg}
              weighbridgeLoading={weighbridgeLoading}
              reportDate={reportDate}
              lineItems={lineItems}
              onAcceptReconciled={(items) => {
                setLineItems(items);
                toast({
                  title: "Reconciled applied",
                  description: "Reconciled average weights have been applied to match the weighbridge weight.",
                });
              }}
              onBack={handleBack}
              onSaveDraft={() => saveReport(false)}
              onSubmit={() => saveReport(true)}
              isSaving={isSaving}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default LoadReportsPage;
