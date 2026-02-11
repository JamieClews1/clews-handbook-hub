import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
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

// Staci-specific components
import { StaciTallyScreen, StaciReviewScreen, StaciPalletEntry } from "@/components/load-reports/staci";

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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [palletsOut, setPalletsOut] = useState(0);
  const [noPalletsOnLoad, setNoPalletsOnLoad] = useState(false);
  const [wetChargePercent, setWetChargePercent] = useState(0);

  // Staci-specific state
  const [staciPalletEntries, setStaciPalletEntries] = useState<StaciPalletEntry[]>([]);
  const [staciGoodPalletCount, setStaciGoodPalletCount] = useState(0);
  const [staciPalletsScrapCount, setStaciPalletsScrapCount] = useState(0);
  const [staciCardBalesCount, setStaciCardBalesCount] = useState(0);
  const [staciCardBalesWeightKg, setStaciCardBalesWeightKg] = useState(0);
  const [staciFilmsBaleCount, setStaciFilmsBaleCount] = useState(0);
  const [staciFilmsBaleWeightKg, setStaciFilmsBaleWeightKg] = useState(0);
  const [staciPapersDolavCount, setStaciPapersDolavCount] = useState(0);
  const [staciPapersDolavWeightKg, setStaciPapersDolavWeightKg] = useState(0);
  const [staciGlassDolavCount, setStaciGlassDolavCount] = useState(0);
  const [staciGlassDolavWeightKg, setStaciGlassDolavWeightKg] = useState(0);
  const [staciPalletChargeRate, setStaciPalletChargeRate] = useState(0);

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
  }, []);

  // Handle edit query parameter from external navigation
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && user && !loading) {
      // Clear the query param to prevent re-triggering
      setSearchParams({}, { replace: true });
      handleEditReport(editId);
    }
  }, [searchParams, user, loading]);

  // Fetch sites when customer type changes
  useEffect(() => {
    if (selectedCustomer) {
      fetchSites();
    }
  }, [selectedCustomer]);

  // Fetch pallet charge rate from the site's price set (for Staci)
  useEffect(() => {
    if (selectedCustomer !== "staci" || !selectedSiteId) {
      setStaciPalletChargeRate(0);
      return;
    }
    const fetchPalletChargeRate = async () => {
      try {
        // 1. Get the price set for this site
        const { data: priceSetLink } = await supabase
          .from("customer_site_price_sets")
          .select("price_set_id")
          .eq("site_id", selectedSiteId)
          .maybeSingle();

        if (!priceSetLink) {
          setStaciPalletChargeRate(0);
          return;
        }

        // 2. Get all items in the price set
        const { data: psItems } = await supabase
          .from("rebate_price_set_items")
          .select("rebate_item_id, value_type, set_value, value_type_item_id, adjustment")
          .eq("price_set_id", priceSetLink.price_set_id);

        if (!psItems || psItems.length === 0) {
          setStaciPalletChargeRate(0);
          return;
        }

        // 3. Find the pallet weight charge item
        for (const item of psItems) {
          const { data: material } = await supabase
            .from("load_waste_types")
            .select("waste_type")
            .eq("id", item.rebate_item_id)
            .single();

          if (material && material.waste_type.toLowerCase().includes("pallet")) {
            let rate = 0;
            if (item.value_type === "set" && item.set_value !== null) {
              rate = Number(item.set_value);
            } else if (item.value_type_item_id) {
              // Look up monthly value for current month
              const monthStart = new Date();
              monthStart.setDate(1);
              const monthStr = monthStart.toISOString().split("T")[0];
              const { data: monthVal } = await supabase
                .from("rebate_monthly_values")
                .select("lower_range, higher_range")
                .eq("item_id", item.value_type_item_id)
                .eq("month_start", monthStr)
                .maybeSingle();
              if (monthVal) {
                rate = item.value_type === "higher"
                  ? Number(monthVal.higher_range ?? 0)
                  : Number(monthVal.lower_range ?? 0);
              }
            }
            // Apply adjustment
            if (item.adjustment) {
              rate += Number(item.adjustment);
            }
            setStaciPalletChargeRate(rate);
            return;
          }
        }
        setStaciPalletChargeRate(0);
      } catch {
        setStaciPalletChargeRate(0);
      }
    };
    fetchPalletChargeRate();
  }, [selectedCustomer, selectedSiteId]);

  const fetchSites = async () => {
    // Map customer type to load_report_type value
    // "other" maps to null/empty (Standard sites) or any site without a specific type
    const reportTypeMap: Record<CustomerType, string | null> = {
      britvic: "britvic",
      staci: "staci",
      vantiva: "vantiva",
      amazon: "amazon",
      evri: "evri",
      other: null, // Standard - sites without a specific load_report_type
    };

    let query = supabase
      .from("customer_sites")
      .select("id, site_name, load_report_type")
      .order("site_name");

    // Filter by load_report_type based on selected customer
    if (selectedCustomer && selectedCustomer !== "other") {
      query = query.eq("load_report_type", reportTypeMap[selectedCustomer]);
    } else if (selectedCustomer === "other") {
      // Standard reports: sites with null/empty load_report_type or explicitly "other"
      query = query.or("load_report_type.is.null,load_report_type.eq.,load_report_type.eq.other");
    }

    const { data, error } = await query;

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
      // Determine which source to use based on customer type
      // Britvic, Staci, Standard (other) use Skiptrak; Vantiva, Amazon, Evri use Midweigh
      const usesMidweigh = selectedCustomer && ["vantiva", "amazon", "evri"].includes(selectedCustomer);
      const source = usesMidweigh ? "midweigh" : "skiptrak";

      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("weight_t, job_date, source")
        .eq("job_number", ticket)
        .eq("source", source)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Midweigh stores weight in KG, Skiptrak stores in tonnes
        const weightKg = data.source === "midweigh" 
          ? (data.weight_t ?? 0) 
          : (data.weight_t ?? 0) * 1000;
        setWeighbridgeWeightKg(weightKg);

        // Update report date to match the job date if available
        if (data.job_date) {
          setReportDate(data.job_date);
        }
      } else {
        setWeighbridgeWeightKg(null);
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
      wet_charge_applied: false,
    }));
    setLineItems(items);
  };

  const handleNewReport = async () => {
    setCurrentReportId(null);
    setOperatorName("");
    setVehicleReg("");
    setJobNumber("");
    setSelectedSiteId("");
    setPalletsOut(0);
    setNoPalletsOnLoad(false);
    setWetChargePercent(0);
    setReportDate(new Date().toISOString().split("T")[0]);
    
    // Reset Staci state
    setStaciPalletEntries([]);
    setStaciGoodPalletCount(0);
    setStaciPalletsScrapCount(0);
    setStaciCardBalesCount(0);
    setStaciCardBalesWeightKg(0);
    setStaciFilmsBaleCount(0);
    setStaciFilmsBaleWeightKg(0);
    
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
        wet_charge_applied: false,
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
      setPalletsOut((report as any).pallets_out || 0);
      setNoPalletsOnLoad((report as any).no_pallets_on_load || false);
      setWetChargePercent((report as any).wet_charge_percent || 0);
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
            wet_charge_applied: (item as any).wet_charge_applied || false,
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
      // Fetch report and staci entries in parallel
      const [reportResult, itemsResult, staciResult] = await Promise.all([
        supabase.from("load_reports").select("*").eq("id", reportId).single(),
        supabase.from("load_line_items").select("*").eq("load_report_id", reportId).order("display_order"),
        supabase.from("staci_pallet_entries").select("*").eq("load_report_id", reportId).order("display_order"),
      ]);

      if (reportResult.error) throw reportResult.error;
      if (itemsResult.error) throw itemsResult.error;

      const report = reportResult.data;
      const items = itemsResult.data;
      const staciEntries = staciResult.data || [];

      setCurrentReportId(reportId);
      setOperatorName(report.operator_name);
      setVehicleReg(report.vehicle_reg || "");
      setJobNumber(report.notes || "");
      setSelectedSiteId(report.site_id || "");
      setReportDate(report.report_date);
      setPalletsOut((report as any).pallets_out || 0);
      setNoPalletsOnLoad((report as any).no_pallets_on_load || false);
      setWetChargePercent((report as any).wet_charge_percent || 0);
      fetchWeighbridgeWeightKg(report.notes || "");

      // Load Staci extra fields
      setStaciGoodPalletCount((report as any).pallets_out || 0);
      setStaciPalletsScrapCount((report as any).pallets_scrap_count || 0);
      setStaciCardBalesCount((report as any).card_bales_count || 0);
      setStaciCardBalesWeightKg(Number((report as any).card_bales_weight_kg) || 0);
      setStaciFilmsBaleCount((report as any).films_bale_count || 0);
      setStaciFilmsBaleWeightKg(Number((report as any).films_bale_weight_kg) || 0);
      setStaciPapersDolavCount((report as any).papers_dolav_count || 0);
      setStaciPapersDolavWeightKg(Number((report as any).papers_dolav_weight_kg) || 0);
      setStaciGlassDolavCount((report as any).glass_dolav_count || 0);
      setStaciGlassDolavWeightKg(Number((report as any).glass_dolav_weight_kg) || 0);

      // Load Staci pallet entries if present
      if (staciEntries.length > 0) {
        setStaciPalletEntries(
          staciEntries.map((e: any) => ({
            id: e.id,
            colour: e.colour,
            weight_kg: Number(e.weight_kg),
            pallet_type: e.pallet_type || "good",
            display_order: e.display_order,
            description: e.description || "",
            waste_breakdown: e.waste_breakdown || {},
            pallet_count: e.pallet_count || 1,
          }))
        );
      }

      if (items && items.length > 0) {
        setLineItems(
          items.map((item) => ({
            waste_type: item.waste_type,
            pallet_count: item.pallet_count,
            avg_weight_kg: Number(item.avg_weight_kg),
            total_weight_kg: Number(item.total_weight_kg),
            display_order: item.display_order,
            pallet_weight_kg: defaultPalletWeight,
            wet_charge_applied: (item as any).wet_charge_applied || false,
          }))
        );
      } else if (staciEntries.length === 0) {
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
      const isStaci = selectedCustomer === "staci";
      
      // For Staci, calculate totals from pallet entries (accounting for pallet_count multiplier)
      const staciTotalPallets = staciPalletEntries.reduce((sum, e) => sum + (e.pallet_count || 1), 0);
      const staciTotalWeight = staciPalletEntries.reduce((sum, e) => sum + e.weight_kg * (e.pallet_count || 1), 0);
      
      const { totalPallets, totalWeight } = isStaci 
        ? { totalPallets: staciTotalPallets, totalWeight: staciTotalWeight }
        : calculateTotals();

      // Use offline-first storage for standard flow
      if (!isStaci) {
        const offlineLineItems = lineItems.map((item) => ({
          wasteType: item.waste_type,
          palletCount: item.pallet_count,
          avgWeightKg: item.avg_weight_kg,
          totalWeightKg: item.pallet_count * item.avg_weight_kg,
          displayOrder: item.display_order,
          wetChargeApplied: item.wet_charge_applied || false,
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
          palletsOut: palletsOut,
          noPalletsOnLoad: noPalletsOnLoad,
          wetChargePercent: wetChargePercent,
          lineItems: offlineLineItems,
        });
      } else {
        // For Staci, save directly to Supabase (online-only for now)
        const reportPayload = {
          operator_id: user.id,
          operator_name: operatorName,
          vehicle_reg: vehicleReg || null,
          notes: jobNumber || null,
          site_id: selectedSiteId || null,
          report_date: reportDate,
          status: submit ? "submitted" : "draft",
          total_pallets: totalPallets,
          total_weight_kg: totalWeight,
          pallets_out: staciGoodPalletCount,
          pallets_scrap_count: staciPalletsScrapCount,
           card_bales_count: staciCardBalesCount,
           card_bales_weight_kg: staciCardBalesWeightKg,
           films_bale_count: staciFilmsBaleCount,
           films_bale_weight_kg: staciFilmsBaleWeightKg,
           papers_dolav_count: staciPapersDolavCount,
           papers_dolav_weight_kg: staciPapersDolavWeightKg,
           glass_dolav_count: staciGlassDolavCount,
           glass_dolav_weight_kg: staciGlassDolavWeightKg,
           submitted_at: submit ? new Date().toISOString() : null,
        };

        let reportId = currentReportId;

        if (reportId) {
          // Update existing report
          const { error: updateError } = await supabase
            .from("load_reports")
            .update(reportPayload)
            .eq("id", reportId);
          if (updateError) throw updateError;

          // Delete existing pallet entries
          await supabase
            .from("staci_pallet_entries")
            .delete()
            .eq("load_report_id", reportId);
        } else {
          // Create new report
          const { data: newReport, error: createError } = await supabase
            .from("load_reports")
            .insert(reportPayload)
            .select("id")
            .single();
          if (createError) throw createError;
          reportId = newReport.id;
        }

        // Insert Staci pallet entries
        if (staciPalletEntries.length > 0) {
          const entries = staciPalletEntries.map((entry, idx) => ({
            load_report_id: reportId,
            colour: entry.colour,
            weight_kg: entry.weight_kg,
            pallet_type: entry.pallet_type,
            display_order: idx,
            description: entry.description || null,
            waste_breakdown: entry.waste_breakdown || {},
            pallet_count: entry.pallet_count || 1,
          }));

          const { error: entriesError } = await supabase
            .from("staci_pallet_entries")
            .insert(entries);
          if (entriesError) throw entriesError;
        }
      }

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
                customerType={selectedCustomer}
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
              noPalletsOnLoad={noPalletsOnLoad}
              onNoPalletsOnLoadChange={setNoPalletsOnLoad}
              onStartTally={handleStartTally}
              isValid={operatorName.trim().length > 0}
              isEditing={!!currentReportId}
              onDelete={handleDeleteReport}
              isDeleting={isSaving}
            />
          )}

          {viewMode === "tally" && selectedCustomer === "staci" && (
            <StaciTallyScreen
              palletEntries={staciPalletEntries}
              onPalletEntriesChange={setStaciPalletEntries}
              onBack={handleBack}
              onReview={() => setViewMode("review")}
              goodPalletCount={staciGoodPalletCount}
              onGoodPalletCountChange={setStaciGoodPalletCount}
              palletsScrapCount={staciPalletsScrapCount}
              onPalletsScrapCountChange={setStaciPalletsScrapCount}
              cardBalesCount={staciCardBalesCount}
              onCardBalesCountChange={setStaciCardBalesCount}
              cardBalesWeightKg={staciCardBalesWeightKg}
              onCardBalesWeightKgChange={setStaciCardBalesWeightKg}
              filmsBaleCount={staciFilmsBaleCount}
              onFilmsBaleCountChange={setStaciFilmsBaleCount}
              filmsBaleWeightKg={staciFilmsBaleWeightKg}
              onFilmsBaleWeightKgChange={setStaciFilmsBaleWeightKg}
              papersDolavCount={staciPapersDolavCount}
              onPapersDolavCountChange={setStaciPapersDolavCount}
              papersDolavWeightKg={staciPapersDolavWeightKg}
              onPapersDolavWeightKgChange={setStaciPapersDolavWeightKg}
              glassDolavCount={staciGlassDolavCount}
              onGlassDolavCountChange={setStaciGlassDolavCount}
              glassDolavWeightKg={staciGlassDolavWeightKg}
              onGlassDolavWeightKgChange={setStaciGlassDolavWeightKg}
              palletWeightKg={defaultPalletWeight}
            />
          )}

          {viewMode === "tally" && selectedCustomer !== "staci" && (
            <TallyScreen
              lineItems={lineItems}
              onLineItemChange={handleLineItemChange}
              onBack={handleBack}
              onReview={() => setViewMode("review")}
              customerType={selectedCustomer}
              palletsOut={palletsOut}
              onPalletsOutChange={setPalletsOut}
              wetChargePercent={wetChargePercent}
              onWetChargePercentChange={setWetChargePercent}
              weighbridgeWeightKg={weighbridgeWeightKg}
            />
          )}

          {viewMode === "review" && selectedCustomer === "staci" && (
            <StaciReviewScreen
              operatorName={operatorName}
              vehicleReg={vehicleReg}
              jobNumber={jobNumber}
              reportDate={reportDate}
              palletEntries={staciPalletEntries}
              goodPalletCount={staciGoodPalletCount}
              palletsScrapCount={staciPalletsScrapCount}
              cardBalesCount={staciCardBalesCount}
              cardBalesWeightKg={staciCardBalesWeightKg}
              filmsBaleCount={staciFilmsBaleCount}
              filmsBaleWeightKg={staciFilmsBaleWeightKg}
              papersDolavCount={staciPapersDolavCount}
              papersDolavWeightKg={staciPapersDolavWeightKg}
              glassDolavCount={staciGlassDolavCount}
              glassDolavWeightKg={staciGlassDolavWeightKg}
              palletWeightKg={defaultPalletWeight}
              palletChargeRatePerTonne={staciPalletChargeRate}
              weighbridgeWeightKg={weighbridgeWeightKg}
              weighbridgeLoading={weighbridgeLoading}
              onPalletEntriesChange={setStaciPalletEntries}
              onBack={handleBack}
              onSaveDraft={() => saveReport(false)}
              onSubmit={() => saveReport(true)}
              isSaving={isSaving}
            />
          )}

          {viewMode === "review" && selectedCustomer !== "staci" && (
            <LoadReviewScreen
              operatorName={operatorName}
              vehicleReg={vehicleReg}
              jobNumber={jobNumber}
              weighbridgeWeightKg={weighbridgeWeightKg}
              weighbridgeLoading={weighbridgeLoading}
              noPalletsOnLoad={noPalletsOnLoad}
              wetChargePercent={wetChargePercent}
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
