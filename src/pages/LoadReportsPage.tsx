import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";
import { getWeighbridgeSource } from "@/lib/weighbridge-source";
import { getTodayLoadReportDate, normalizeLoadReportDate } from "@/lib/load-report-dates";

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

type ViewMode = "customer" | "list" | "all" | "new" | "tally" | "review";

const mapReportTypeToCustomer = (t?: string | null): CustomerType => {
  if (t === "britvic" || t === "staci" || t === "vantiva" || t === "amazon" || t === "evri") return t;
  return "other";
};

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
  const [originView, setOriginView] = useState<"list" | "all">("list");
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
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
  const [reportDate, setReportDate] = useState(getTodayLoadReportDate());
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [weighbridgeWeightKg, setWeighbridgeWeightKg] = useState<number | null>(null);
  const [weighbridgeLoading, setWeighbridgeLoading] = useState(false);
  const [palletsOut, setPalletsOut] = useState(0);
  const [noPalletsOnLoad, setNoPalletsOnLoad] = useState(false);
  const [excludeFromRebate, setExcludeFromRebate] = useState(false);
  const [wetChargePercent, setWetChargePercent] = useState(0);
  const [rebateThresholdTonnes, setRebateThresholdTonnes] = useState(0);

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
  const [staciScrapMetalLooseCount, setStaciScrapMetalLooseCount] = useState(0);
  const [staciScrapMetalLooseWeightKg, setStaciScrapMetalLooseWeightKg] = useState(0);
  const [staciCardBalesOnPallets, setStaciCardBalesOnPallets] = useState(false);
  const [staciFilmsBaleOnPallets, setStaciFilmsBaleOnPallets] = useState(false);
  const [staciPapersDolavOnPallets, setStaciPapersDolavOnPallets] = useState(false);
  const [staciGlassDolavOnPallets, setStaciGlassDolavOnPallets] = useState(false);
  const [staciScrapMetalLooseOnPallets, setStaciScrapMetalLooseOnPallets] = useState(false);
  const [staciPalletChargeRate, setStaciPalletChargeRate] = useState(0);
  const [staciCardBalesRate, setStaciCardBalesRate] = useState(0);
  const [staciFilmsRate, setStaciFilmsRate] = useState(0);
  const [staciGreenRatePerTonne, setStaciGreenRatePerTonne] = useState(0);

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

  // Handle edit/create query parameters from external navigation
  useEffect(() => {
    const editId = searchParams.get("edit");
    const createJob = searchParams.get("job");
    if (editId && user && !loading) {
      setSearchParams({}, { replace: true });
      handleEditReport(editId);
    } else if (createJob && user && !loading) {
      const jobDate = searchParams.get("date") || "";
      const vehicle = searchParams.get("vehicle") || "";
      setSearchParams({}, { replace: true });
      // Open new report form, then pre-fill fields after reset
      handleNewReport().then(() => {
        setJobNumber(createJob);
        if (jobDate) setReportDate(jobDate);
        if (vehicle) setVehicleReg(vehicle);
      });
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
      setStaciCardBalesRate(0);
      setStaciFilmsRate(0);
      return;
    }
    const fetchSiteRates = async () => {
      try {
        // 1. Get the price set for this site
        const { data: priceSetLink } = await supabase
          .from("customer_site_price_sets")
          .select("price_set_id")
          .eq("site_id", selectedSiteId)
          .maybeSingle();

        if (!priceSetLink) {
          setStaciPalletChargeRate(0);
          setStaciCardBalesRate(0);
          setStaciFilmsRate(0);
          return;
        }

        // 2. Get all items in the price set
        const { data: psItems } = await supabase
          .from("rebate_price_set_items")
          .select("rebate_item_id, value_type, set_value, value_type_item_id, adjustment")
          .eq("price_set_id", priceSetLink.price_set_id);

        if (!psItems || psItems.length === 0) {
          setStaciPalletChargeRate(0);
          setStaciCardBalesRate(0);
          setStaciFilmsRate(0);
          return;
        }

        // 3. Resolve all waste type names
        const rebateItemIds = psItems.map(i => i.rebate_item_id).filter(Boolean);
        const { data: materials } = await supabase
          .from("load_waste_types")
          .select("id, waste_type")
          .in("id", rebateItemIds);

        const materialMap = Object.fromEntries((materials ?? []).map(m => [m.id, m.waste_type.toLowerCase()]));

        const resolveRate = async (item: typeof psItems[0]): Promise<number> => {
          let rate = 0;
          if (item.value_type === "set" && item.set_value !== null) {
            rate = Number(item.set_value);
          } else if (item.value_type_item_id) {
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
          if (item.adjustment) {
            rate += Number(item.adjustment);
          }
          return rate;
        };

        let palletRate = 0, cardRate = 0, filmsRate = 0;

        for (const item of psItems) {
          const name = materialMap[item.rebate_item_id] || "";
          if (name.includes("pallet")) {
            palletRate = await resolveRate(item);
          } else if (name.includes("card bale") || name.includes("cardboard")) {
            cardRate = await resolveRate(item);
          } else if (name.includes("film")) {
            filmsRate = await resolveRate(item);
          }
        }

        setStaciPalletChargeRate(palletRate);
        setStaciCardBalesRate(cardRate);
        setStaciFilmsRate(filmsRate);
      } catch {
        setStaciPalletChargeRate(0);
        setStaciCardBalesRate(0);
        setStaciFilmsRate(0);
      }
    };
    fetchSiteRates();
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
      // Standard reports: only show sites that have rebate setup (a price set assigned)
      // and are not tied to a specific customer-type report (britvic/staci/vantiva/amazon/evri)
      const { data: priceSetSites } = await supabase
        .from("customer_site_price_sets")
        .select("site_id");
      const priceSetSiteIds = (priceSetSites || []).map((p: any) => p.site_id);
      if (priceSetSiteIds.length === 0) {
        setSites([]);
        return;
      }
      query = query
        .in("id", priceSetSiteIds)
        .or("load_report_type.is.null,load_report_type.eq.other");
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
      const source = getWeighbridgeSource(selectedCustomer);

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
          setReportDate(normalizeLoadReportDate(data.job_date));
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

  const filterWasteTypesByCustomer = (types: WasteType[]) => {
    return types.filter((wt: any) => {
      const filter = wt.customer_type_filter;
      if (!filter || filter.length === 0) return true;
      return selectedCustomer ? filter.includes(selectedCustomer) : false;
    });
  };

  const initializeLineItems = () => {
    const filtered = filterWasteTypesByCustomer(wasteTypes);
    const items: LineItem[] = filtered.map((wt) => ({
      waste_type: wt.waste_type,
      pallet_count: 0,
      avg_weight_kg: Number(wt.default_avg_weight_kg),
      total_weight_kg: 0,
      display_order: wt.display_order,
      pallet_weight_kg: defaultPalletWeight,
      wet_charge_applied: false,
      rebate_threshold_applied: false,
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
    setExcludeFromRebate(false);
    setWetChargePercent(0);
    setRebateThresholdTonnes(0);
    setReportDate(getTodayLoadReportDate());
    
    // Reset Staci state
    setStaciPalletEntries([]);
    setStaciGoodPalletCount(0);
    setStaciPalletsScrapCount(0);
    setStaciCardBalesCount(0);
    setStaciCardBalesWeightKg(0);
    setStaciFilmsBaleCount(0);
    setStaciFilmsBaleWeightKg(0);
    setStaciGreenRatePerTonne(0);
    
    // Fetch latest waste types to ensure we have current default weights
    const { data, error } = await supabase
      .from("load_waste_types")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (!error && data) {
      setWasteTypes(data);
      const filtered = data.filter((wt: any) => {
        const filter = wt.customer_type_filter;
        if (!filter || filter.length === 0) return true;
        return selectedCustomer ? filter.includes(selectedCustomer) : false;
      });
      const items: LineItem[] = filtered.map((wt) => ({
        waste_type: wt.waste_type,
        pallet_count: 0,
        avg_weight_kg: Number(wt.default_avg_weight_kg),
        total_weight_kg: 0,
        display_order: wt.display_order,
        pallet_weight_kg: defaultPalletWeight,
        wet_charge_applied: false,
        rebate_threshold_applied: false,
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
      // Fetch report, line items, and staci entries in parallel
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
      setReportDate(normalizeLoadReportDate(report.report_date));
      setPalletsOut((report as any).pallets_out || 0);
      setNoPalletsOnLoad((report as any).no_pallets_on_load || false);
      setExcludeFromRebate(report.exclude_from_rebate || false);
      setWetChargePercent((report as any).wet_charge_percent || 0);
      setRebateThresholdTonnes(Number((report as any).rebate_threshold_tonnes) || 0);
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
      setStaciScrapMetalLooseCount((report as any).scrap_metal_loose_count || 0);
      setStaciScrapMetalLooseWeightKg(Number((report as any).scrap_metal_loose_weight_kg) || 0);
      setStaciCardBalesOnPallets((report as any).card_bales_on_pallets || false);
      setStaciFilmsBaleOnPallets((report as any).films_bale_on_pallets || false);
      setStaciPapersDolavOnPallets((report as any).papers_dolav_on_pallets || false);
      setStaciGlassDolavOnPallets((report as any).glass_dolav_on_pallets || false);
      setStaciScrapMetalLooseOnPallets((report as any).scrap_metal_loose_on_pallets || false);
      setStaciGreenRatePerTonne(Number((report as any).staci_green_rate_per_tonne) || 0);

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

      // Detect report type from the site so it works from the combined "all" list
      let detectedType: CustomerType = "other";
      if (report.site_id) {
        const { data: siteData } = await supabase
          .from("customer_sites")
          .select("load_report_type")
          .eq("id", report.site_id)
          .single();
        detectedType = mapReportTypeToCustomer(siteData?.load_report_type);
      }
      let isStaciReport = staciEntries.length > 0 || detectedType === "staci";
      if (isStaciReport) detectedType = "staci";
      setSelectedCustomer(detectedType);
      
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
            rebate_threshold_applied: (item as any).rebate_threshold_applied || false,
          }))
        );
      } else if (staciEntries.length === 0) {
        initializeLineItems();
      }

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
      setReportDate(normalizeLoadReportDate(report.report_date));
      setPalletsOut((report as any).pallets_out || 0);
      setNoPalletsOnLoad((report as any).no_pallets_on_load || false);
      setExcludeFromRebate(report.exclude_from_rebate || false);
      setWetChargePercent((report as any).wet_charge_percent || 0);
      setRebateThresholdTonnes(Number((report as any).rebate_threshold_tonnes) || 0);
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
      setStaciScrapMetalLooseCount((report as any).scrap_metal_loose_count || 0);
      setStaciScrapMetalLooseWeightKg(Number((report as any).scrap_metal_loose_weight_kg) || 0);
      setStaciCardBalesOnPallets((report as any).card_bales_on_pallets || false);
      setStaciFilmsBaleOnPallets((report as any).films_bale_on_pallets || false);
      setStaciPapersDolavOnPallets((report as any).papers_dolav_on_pallets || false);
      setStaciGlassDolavOnPallets((report as any).glass_dolav_on_pallets || false);
      setStaciScrapMetalLooseOnPallets((report as any).scrap_metal_loose_on_pallets || false);

      // Detect report type from the site so editing works from the combined "all" list
      let detectedType: CustomerType = "other";
      if (report.site_id) {
        const { data: siteData } = await supabase
          .from("customer_sites")
          .select("load_report_type")
          .eq("id", report.site_id)
          .single();
        detectedType = mapReportTypeToCustomer(siteData?.load_report_type);
      }
      let isStaciReport = staciEntries.length > 0 || detectedType === "staci";
      if (isStaciReport) detectedType = "staci";
      setSelectedCustomer(detectedType);

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
            rebate_threshold_applied: (item as any).rebate_threshold_applied || false,
          }))
        );
      } else if (staciEntries.length === 0) {
        initializeLineItems();
      }

      if (isStaciReport) {
        setViewMode(report.status === "submitted" ? "review" : "tally");
      } else {
        setViewMode("new");
      }
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
      const staciTotalPallets = staciPalletEntries.reduce((sum, e) => sum + (e.pallet_count || 1), 0)
        + (staciCardBalesOnPallets ? staciCardBalesCount : 0)
        + (staciFilmsBaleOnPallets ? staciFilmsBaleCount : 0)
        + (staciPapersDolavOnPallets ? staciPapersDolavCount : 0)
        + (staciGlassDolavOnPallets ? staciGlassDolavCount : 0)
        + (staciScrapMetalLooseOnPallets ? staciScrapMetalLooseCount : 0);
      const staciTotalWeight = staciPalletEntries.reduce((sum, e) => sum + e.weight_kg * (e.pallet_count || 1), 0);
      
      const { totalPallets, totalWeight } = isStaci 
        ? { totalPallets: staciTotalPallets, totalWeight: staciTotalWeight }
        : calculateTotals();
      const normalizedReportDate = normalizeLoadReportDate(reportDate) || getTodayLoadReportDate();

      // Use offline-first storage for standard flow
      if (!isStaci) {
        const offlineLineItems = lineItems.map((item) => ({
          wasteType: item.waste_type,
          palletCount: item.pallet_count,
          avgWeightKg: item.avg_weight_kg,
          totalWeightKg: item.pallet_count * item.avg_weight_kg,
          displayOrder: item.display_order,
          wetChargeApplied: item.wet_charge_applied || false,
          rebateThresholdApplied: item.rebate_threshold_applied || false,
        }));

        await saveOfflineReport({
          serverId: currentReportId || undefined,
          operatorId: user.id,
          operatorName: operatorName,
          vehicleReg: vehicleReg || null,
          jobNumber: jobNumber || null,
          siteId: selectedSiteId || null,
          reportDate: normalizedReportDate,
          status: submit ? "submitted" : "draft",
          totalPallets: totalPallets,
          totalWeightKg: totalWeight,
          palletsOut: palletsOut,
          noPalletsOnLoad: noPalletsOnLoad,
          excludeFromRebate: excludeFromRebate,
          wetChargePercent: wetChargePercent,
          rebateThresholdTonnes: rebateThresholdTonnes,
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
          report_date: normalizedReportDate,
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
           scrap_metal_loose_count: staciScrapMetalLooseCount,
           scrap_metal_loose_weight_kg: staciScrapMetalLooseWeightKg,
           card_bales_on_pallets: staciCardBalesOnPallets,
           films_bale_on_pallets: staciFilmsBaleOnPallets,
           papers_dolav_on_pallets: staciPapersDolavOnPallets,
           glass_dolav_on_pallets: staciGlassDolavOnPallets,
           scrap_metal_loose_on_pallets: staciScrapMetalLooseOnPallets,
           staci_green_rate_per_tonne: staciGreenRatePerTonne || null,
           exclude_from_rebate: excludeFromRebate,
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
      // Delete child records first (line items, staci entries)
      const [itemsResult, staciResult] = await Promise.all([
        supabase.from("load_line_items").delete().eq("load_report_id", currentReportId),
        supabase.from("staci_pallet_entries").delete().eq("load_report_id", currentReportId),
      ]);
      if (itemsResult.error) throw itemsResult.error;
      if (staciResult.error) throw staciResult.error;

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
      setListRefreshKey((k) => k + 1);
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
      case "all":
        setViewMode("customer");
        setSelectedCustomer(null);
        break;
      case "new":
        setViewMode(originView);
        break;
      case "tally":
        setViewMode(originView === "all" ? "all" : "new");
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
    setOriginView("list");
    setViewMode("list");
  };

  const handleViewAll = () => {
    setSelectedCustomer(null);
    setOriginView("all");
    setViewMode("all");
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
      case "all":
        return "Logged Load Reports";
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
        <div className={`${viewMode === "all" ? "max-w-7xl" : "max-w-5xl"} mx-auto`}>
          {viewMode === "customer" && (
            <CustomerTypeSelector onSelect={handleCustomerSelect} onViewAll={handleViewAll} />
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
                key={listRefreshKey}
                onNewReport={handleNewReport}
                onViewReport={handleViewReport}
                onEditReport={handleEditReport}
                customerType={selectedCustomer}
              />
            </>
          )}

          {viewMode === "all" && (
            <>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Logged Load Reports
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    All load reports across every report type — open and edit any record
                  </p>
                </div>
              </div>
              <LoadReportsList
                key={`all-${listRefreshKey}`}
                onNewReport={handleNewReport}
                onViewReport={handleViewReport}
                onEditReport={handleEditReport}
                customerType={null}
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
              excludeFromRebate={excludeFromRebate}
              onExcludeFromRebateChange={setExcludeFromRebate}
              onStartTally={handleStartTally}
              isValid={operatorName.trim().length > 0}
              isEditing={!!currentReportId}
              onDelete={handleDeleteReport}
              isDeleting={isSaving}
              customerType={selectedCustomer}
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
              scrapMetalLooseCount={staciScrapMetalLooseCount}
              onScrapMetalLooseCountChange={setStaciScrapMetalLooseCount}
              scrapMetalLooseWeightKg={staciScrapMetalLooseWeightKg}
              onScrapMetalLooseWeightKgChange={setStaciScrapMetalLooseWeightKg}
              cardBalesOnPallets={staciCardBalesOnPallets}
              onCardBalesOnPalletsChange={setStaciCardBalesOnPallets}
              filmsBaleOnPallets={staciFilmsBaleOnPallets}
              onFilmsBaleOnPalletsChange={setStaciFilmsBaleOnPallets}
              papersDolavOnPallets={staciPapersDolavOnPallets}
              onPapersDolavOnPalletsChange={setStaciPapersDolavOnPallets}
              glassDolavOnPallets={staciGlassDolavOnPallets}
              onGlassDolavOnPalletsChange={setStaciGlassDolavOnPallets}
              scrapMetalLooseOnPallets={staciScrapMetalLooseOnPallets}
              onScrapMetalLooseOnPalletsChange={setStaciScrapMetalLooseOnPallets}
              palletWeightKg={defaultPalletWeight}
              greenRatePerTonne={staciGreenRatePerTonne}
              onGreenRatePerTonneChange={setStaciGreenRatePerTonne}
            />
          )}

          {viewMode === "tally" && selectedCustomer !== "staci" && (() => {
            const cardboardPallets = lineItems
              .filter((i) => i.waste_type.toLowerCase().includes("card"))
              .reduce((sum, i) => sum + i.pallet_count, 0);
            const evriOverrideTarget =
              selectedCustomer === "evri" && palletsOut > 0 && cardboardPallets > 0
                ? cardboardPallets * 90
                : null;
            return (
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
                rebateThresholdTonnes={rebateThresholdTonnes}
                onRebateThresholdTonnesChange={setRebateThresholdTonnes}
                weighbridgeWeightKg={
                  evriOverrideTarget !== null ? evriOverrideTarget : weighbridgeWeightKg
                }
              />
            );
          })()}

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
              scrapMetalLooseCount={staciScrapMetalLooseCount}
              scrapMetalLooseWeightKg={staciScrapMetalLooseWeightKg}
              palletWeightKg={defaultPalletWeight}
              palletChargeRatePerTonne={staciPalletChargeRate}
              cardBalesRatePerTonne={staciCardBalesRate}
              filmsRatePerTonne={staciFilmsRate}
              weighbridgeWeightKg={weighbridgeWeightKg}
              weighbridgeLoading={weighbridgeLoading}
              onPalletEntriesChange={setStaciPalletEntries}
              onCardBalesWeightKgChange={setStaciCardBalesWeightKg}
              onFilmsBaleWeightKgChange={setStaciFilmsBaleWeightKg}
              onPapersDolavWeightKgChange={setStaciPapersDolavWeightKg}
              onGlassDolavWeightKgChange={setStaciGlassDolavWeightKg}
              onScrapMetalLooseWeightKgChange={setStaciScrapMetalLooseWeightKg}
              onBack={handleBack}
              onSaveDraft={() => saveReport(false)}
              onSubmit={() => saveReport(true)}
              isSaving={isSaving}
              cardBalesOnPallets={staciCardBalesOnPallets}
              filmsBaleOnPallets={staciFilmsBaleOnPallets}
              papersDolavOnPallets={staciPapersDolavOnPallets}
              glassDolavOnPallets={staciGlassDolavOnPallets}
              scrapMetalLooseOnPallets={staciScrapMetalLooseOnPallets}
            />
          )}

          {viewMode === "review" && selectedCustomer !== "staci" && (() => {
            const cardboardPallets = lineItems
              .filter((i) => i.waste_type.toLowerCase().includes("card"))
              .reduce((sum, i) => sum + i.pallet_count, 0);
            const isEvriOverride = selectedCustomer === "evri" && palletsOut > 0 && cardboardPallets > 0;
            const evriOverrideTarget = isEvriOverride
              ? cardboardPallets * 90
              : null;
            return (
              <LoadReviewScreen
                customerType={selectedCustomer}
                operatorName={operatorName}
                vehicleReg={vehicleReg}
                jobNumber={jobNumber}
                weighbridgeWeightKg={
                  evriOverrideTarget !== null ? evriOverrideTarget : weighbridgeWeightKg
                }
                rawWeighbridgeWeightKg={weighbridgeWeightKg}
                palletsOutCount={isEvriOverride ? palletsOut : 0}
                palletsOutAdjustmentKg={isEvriOverride ? palletsOut * 20 : 0}
                cardboardPalletsIn={isEvriOverride ? cardboardPallets : 0}
                cardboardIncomingKg={isEvriOverride ? cardboardPallets * 90 : 0}
                weighbridgeLoading={weighbridgeLoading}
                noPalletsOnLoad={noPalletsOnLoad}
                wetChargePercent={wetChargePercent}
                rebateThresholdTonnes={rebateThresholdTonnes}
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
            );
          })()}
        </div>
      </main>
    </div>
  );
};

export default LoadReportsPage;
