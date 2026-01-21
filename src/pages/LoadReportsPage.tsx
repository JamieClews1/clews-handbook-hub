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

type ViewMode = "customer" | "list" | "new" | "tally" | "review";

interface WasteType {
  id: string;
  waste_type: string;
  default_avg_weight_kg: number;
  display_order: number;
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

  // Form state
  const [operatorName, setOperatorName] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [notes, setNotes] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchWasteTypes();
  }, []);

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
  };

  const initializeLineItems = () => {
    const items: LineItem[] = wasteTypes.map((wt) => ({
      waste_type: wt.waste_type,
      pallet_count: 0,
      avg_weight_kg: Number(wt.default_avg_weight_kg),
      total_weight_kg: 0,
      display_order: wt.display_order,
    }));
    setLineItems(items);
  };

  const handleNewReport = () => {
    setCurrentReportId(null);
    setOperatorName("");
    setVehicleReg("");
    setNotes("");
    setReportDate(new Date().toISOString().split("T")[0]);
    initializeLineItems();
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
      setNotes(report.notes || "");
      setReportDate(report.report_date);
      
      if (items && items.length > 0) {
        setLineItems(
          items.map((item) => ({
            waste_type: item.waste_type,
            pallet_count: item.pallet_count,
            avg_weight_kg: Number(item.avg_weight_kg),
            total_weight_kg: Number(item.total_weight_kg),
            display_order: item.display_order,
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

      const reportPayload = {
        operator_id: user.id,
        operator_name: operatorName,
        vehicle_reg: vehicleReg || null,
        notes: notes || null,
        report_date: reportDate,
        total_pallets: totalPallets,
        total_weight_kg: totalWeight,
        status: submit ? "submitted" : "draft",
        submitted_at: submit ? new Date().toISOString() : null,
      };

      let reportId = currentReportId;

      if (currentReportId) {
        // Update existing
        const { error } = await supabase
          .from("load_reports")
          .update(reportPayload)
          .eq("id", currentReportId);
        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("load_reports")
          .insert(reportPayload)
          .select()
          .single();
        if (error) throw error;
        reportId = data.id;
        setCurrentReportId(data.id);
      }

      // Delete existing line items and re-insert
      if (reportId) {
        await supabase.from("load_line_items").delete().eq("load_report_id", reportId);

        const lineItemsPayload = lineItems.map((item) => ({
          load_report_id: reportId,
          waste_type: item.waste_type,
          pallet_count: item.pallet_count,
          avg_weight_kg: item.avg_weight_kg,
          total_weight_kg: item.pallet_count * item.avg_weight_kg,
          display_order: item.display_order,
        }));

        const { error: itemsError } = await supabase
          .from("load_line_items")
          .insert(lineItemsPayload);
        if (itemsError) throw itemsError;
      }

      toast({
        title: submit ? "Load Submitted" : "Draft Saved",
        description: submit
          ? "Your load report has been submitted successfully."
          : "Your draft has been saved.",
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
                <span className="font-semibold text-foreground">{getHeaderTitle()}</span>
              </div>
            </div>
            <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto" />
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
              <LoadReportsList onNewReport={handleNewReport} onViewReport={handleViewReport} />
            </>
          )}

          {viewMode === "new" && (
            <NewLoadForm
              operatorName={operatorName}
              vehicleReg={vehicleReg}
              notes={notes}
              onOperatorNameChange={setOperatorName}
              onVehicleRegChange={setVehicleReg}
              onNotesChange={setNotes}
              onStartTally={handleStartTally}
              isValid={operatorName.trim().length > 0}
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
              notes={notes}
              reportDate={reportDate}
              lineItems={lineItems}
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
