import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, DollarSign, Loader2, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { exportCustomerRebateReport } from "@/lib/customer-rebate-export";
import { ReportingPeriodQuickSelect } from "./ReportingPeriodQuickSelect";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LoadReportCards, LoadReportCardData } from "./LoadReportCards";
import { SkipRoroRebateTab } from "./SkipRoroRebateTab";
import { useSkipRoroRebates } from "@/hooks/useSkipRoroRebates";
import { computeThresholdReductions } from "@/lib/rebate-threshold";
import { DateRange } from "react-day-picker";
import { getWeighbridgeSource, convertWeightToTonnes } from "@/lib/weighbridge-source";
import { useLockedRebateReport } from "@/hooks/useLockedRebateReport";
import { RebateReportLockControls } from "./RebateReportLockControls";
import { fetchActivePriceSetLink } from "@/lib/rebate-price-set";

type Customer = {
  id: string;
  customer_name: string;
  customer_code: string;
  data_hub_customer: string | null;
};

type Site = {
  id: string;
  site_name: string;
  data_hub_customer: string | null;
  data_hub_site: string | null;
  data_hub_site_2: string | null;
  data_hub_site_3: string | null;
  data_hub_site_4: string | null;
  data_hub_site_5: string | null;
  load_report_type: string | null;
};

type RebateConfig = {
  material_id: string;
  material_name: string;
  value_type_item_id: string | null;
  value_type_name: string | null;
  range_type: "lower" | "higher" | "set";
  set_value: number | null;
  adjustment: number;
  rebate_category: string;
};

type RebateReportRow = {
  material_name: string;
  weight_tonnes: number;
  rate_per_tonne: number;
  rebate_value: number;
  rate_source: string;
  has_wet_charge?: boolean;
  wet_charge_summary?: string;
};

export function SiteRebateReportGenerator() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [dateMode, setDateMode] = useState<"month" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<RebateReportRow[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [priceSetName, setPriceSetName] = useState("");
  const [individualReports, setIndividualReports] = useState<LoadReportCardData[]>([]);
  const [palletWeightKgState, setPalletWeightKgState] = useState(20);
  const rebateValuesSnapshotRef = useRef<Record<string, { lower: number; higher: number; name: string }>>({});

  // Check if "Customer Midweigh" virtual option is selected
  const isCustomerMidweighMode = selectedSiteId === "__CUSTOMER_MIDWEIGH__";
  
  // Get site data hub mappings for Skip/RoRo calculation
  const selectedSite = isCustomerMidweighMode ? null : sites.find((s) => s.id === selectedSiteId);
  const siteDataHubMappings = selectedSite
    ? [
        selectedSite.data_hub_site,
        selectedSite.data_hub_site_2,
        selectedSite.data_hub_site_3,
        selectedSite.data_hub_site_4,
        selectedSite.data_hub_site_5,
      ].filter((s): s is string => !!s)
    : [];

  // Get customer for customer-level data_hub_customer mapping
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  // In Customer Midweigh mode, use customer-level mapping only; otherwise prefer site-level
  const effectiveDataHubCustomer = isCustomerMidweighMode 
    ? selectedCustomer?.data_hub_customer 
    : (selectedSite?.data_hub_customer ?? selectedCustomer?.data_hub_customer ?? undefined);

  // Use the hook to get Skip/RoRo rebate totals
  // In Customer Midweigh mode, pass empty siteId to skip site-level lookups
  const {
    loading: skipRoroLoading,
    summaries: skipRoroSummaries,
    totalRebate: skipRoroTotalRebate,
    totalWeight: skipRoroTotalWeight,
  } = useSkipRoroRebates(
    reportGenerated && !isCustomerMidweighMode ? selectedSiteId : "",
    reportGenerated ? dateRange : undefined,
    isCustomerMidweighMode ? [] : siteDataHubMappings,
    reportGenerated ? selectedCustomerId : undefined,
    effectiveDataHubCustomer
  );

  // Lock mechanism
  const effectiveSiteIdForLock = isCustomerMidweighMode ? null : (selectedSiteId || null);
  const {
    lockedReport,
    valueChanges,
    loading: lockLoading,
    lockReport,
    unlockReport,
    dismissChanges,
    refreshLock,
  } = useLockedRebateReport(
    effectiveSiteIdForLock,
    selectedCustomerId,
    dateRange?.from,
    dateRange?.to,
    "site_rebate"
  );

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadSites(selectedCustomerId);
      setSelectedSiteId("");
      setReportData([]);
      setReportGenerated(false);
    }
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, customer_name, customer_code, data_hub_customer")
      .order("customer_name");
    setCustomers(data ?? []);
  };

  const loadSites = async (customerId: string) => {
    const { data } = await supabase
      .from("customer_sites")
      .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, load_report_type")
      .eq("customer_id", customerId)
      .order("site_name");
    setSites(data ?? []);
  };

  const generateReport = async () => {
    // Allow generation if we have a customer and either:
    // 1. A site is selected, or
    // 2. Customer Midweigh mode is selected, or
    // 3. No sites exist for this customer (customer-level Midweigh report)
    const hasNoSites = sites.length === 0;
    if (!selectedCustomerId) return;
    if (!isCustomerMidweighMode && !hasNoSites && !selectedSiteId) return;

    setLoading(true);
    setReportGenerated(false);

    try {
      const site = isCustomerMidweighMode ? null : (selectedSiteId ? sites.find((s) => s.id === selectedSiteId) : null);

      // Get the site's price set active for the reporting period (optional - may
      // not exist for Midweigh-only sites). Effective-dated: a report uses the
      // charging model in force at the end of its period.
      let priceSetLink = null;
      if (selectedSiteId) {
        const periodRef = format(dateRange?.to ?? dateRange?.from ?? new Date(), "yyyy-MM-dd");
        priceSetLink = await fetchActivePriceSetLink(selectedSiteId, periodRef, true);
      }

      // Check if there are customer-level skip rebates configured
      const { data: customerSkipRebates } = await supabase
        .from("customer_skip_rebates")
        .select("id")
        .eq("customer_id", selectedCustomerId)
        .limit(1);

      // Check if there are site-level skip rebates configured
      let siteSkipRebates = null;
      if (selectedSiteId) {
        const { data } = await supabase
          .from("customer_site_skip_rebates")
          .select("id")
          .eq("site_id", selectedSiteId)
          .limit(1);
        siteSkipRebates = data;
      }

      const hasSkipRebates = (customerSkipRebates && customerSkipRebates.length > 0) || 
                             (siteSkipRebates && siteSkipRebates.length > 0);

      if (!priceSetLink && !hasSkipRebates) {
        toast({
          title: "No Rebate Set",
          description: hasNoSites 
            ? "This customer doesn't have skip/RoRo rebates configured. Please set them up in Customer Setup."
            : "This site doesn't have a rebate set or skip/RoRo rebates configured. Please set one up in Customer Setup.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Initialize variables
      const rebateConfigs: RebateConfig[] = [];
      const monthlyValueMap: Record<string, { lower: number; higher: number }> = {};
      let loadReportsWithItems: LoadReportCardData[] = [];
      let lineItemWeights: Record<string, number> = {};
      let overrideWeights: Record<string, Record<string, number>> = {};
      let overrideMeta: Record<string, { rate: number; start_date: string; end_date: string; notes: string | null }> = {};
      let palletWeightKg = 20;

      // Only process price set if one exists
      if (priceSetLink) {
        setPriceSetName((priceSetLink.rebate_price_sets as any)?.name || "Unknown");

        // Get rebate configuration for this price set
        const { data: rebateItems } = await supabase
          .from("rebate_price_set_items")
          .select("rebate_item_id, value_type, set_value")
          .eq("price_set_id", priceSetLink.price_set_id);

        if (rebateItems && rebateItems.length > 0) {
          for (const item of rebateItems) {
            // Get full item with new column
            const { data: fullItem } = await supabase
              .from("rebate_price_set_items")
              .select("*")
              .eq("rebate_item_id", item.rebate_item_id)
              .eq("price_set_id", priceSetLink.price_set_id)
              .single();

            // Get material name
            const { data: material } = await supabase
              .from("load_waste_types")
              .select("waste_type, rebate_category")
              .eq("id", item.rebate_item_id)
              .single();

            // Get value type name if applicable
            let valueTypeName = null;
            const valueTypeItemId = (fullItem as any)?.value_type_item_id;
            if (valueTypeItemId) {
              const { data: valueType } = await supabase
                .from("rebate_items")
                .select("name")
                .eq("id", valueTypeItemId)
                .single();
              valueTypeName = valueType?.name || null;
            }

            rebateConfigs.push({
              material_id: item.rebate_item_id,
              material_name: material?.waste_type || "Unknown",
              value_type_item_id: valueTypeItemId || null,
              value_type_name: valueTypeName,
              range_type: item.value_type as "lower" | "higher" | "set",
              set_value: item.set_value,
              adjustment: (fullItem as any)?.adjustment ?? 0,
              rebate_category: material?.rebate_category ?? "rebate",
            });
          }

          // Get monthly values for all months in the selected range and average them
          const rangeStart = dateRange?.from ?? new Date();
          const rangeEnd = dateRange?.to ?? rangeStart;
          const monthsInRange = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
          
          // Fetch monthly values for all months in the range
          const monthStarts = monthsInRange.map(m => format(startOfMonth(m), "yyyy-MM-dd"));
          const { data: monthlyValues } = await supabase
            .from("rebate_monthly_values")
            .select("item_id, lower_range, higher_range, month_start")
            .in("month_start", monthStarts);

          // Use the latest month's values when spanning multiple months
          const sortedMonthStarts = [...monthStarts].sort();
          const latestMonthStart = sortedMonthStarts[sortedMonthStarts.length - 1];
          
          for (const mv of monthlyValues ?? []) {
            // Only use values from the latest month in the range
            if (mv.month_start !== latestMonthStart) continue;
            monthlyValueMap[mv.item_id] = {
              lower: mv.lower_range ?? 0,
              higher: mv.higher_range ?? 0,
            };
          }
          
          // Fallback: if latest month has no values for an item, use the most recent available
          for (const mv of monthlyValues ?? []) {
            if (!monthlyValueMap[mv.item_id]) {
              monthlyValueMap[mv.item_id] = {
                lower: mv.lower_range ?? 0,
                higher: mv.higher_range ?? 0,
              };
            }
          }

          // Build rebate values snapshot for locking
          const valSnapshot: Record<string, { lower: number; higher: number; name: string }> = {};
          // Get rebate item names for the snapshot
          const allValueTypeItemIds = rebateConfigs
            .map(c => c.value_type_item_id)
            .filter((id): id is string => !!id);
          
          if (allValueTypeItemIds.length > 0) {
            const { data: rebateItemsForSnapshot } = await supabase
              .from("rebate_items")
              .select("id, name")
              .in("id", allValueTypeItemIds);
            
            for (const [itemId, vals] of Object.entries(monthlyValueMap)) {
              const itemName = rebateItemsForSnapshot?.find(ri => ri.id === itemId)?.name || itemId;
              valSnapshot[itemId] = { ...vals, name: itemName };
            }
          }
          rebateValuesSnapshotRef.current = valSnapshot;


          // Get Load Report data for this site within the date range
          const periodStart = format(rangeStart, "yyyy-MM-dd");
          const periodEnd = format(rangeEnd, "yyyy-MM-dd");
          
          // Fetch load reports for this site in the selected date range
          const { data: loadReports } = await supabase
            .from("load_reports")
            .select("id, report_date, status, total_pallets, no_pallets_on_load, wet_charge_percent, rebate_threshold_tonnes, operator_name, vehicle_reg, total_weight_kg, notes")
            .eq("site_id", selectedSiteId)
            .gte("report_date", periodStart)
            .lte("report_date", periodEnd)
            .eq("status", "submitted")
            .eq("exclude_from_rebate", false)
            .order("report_date", { ascending: false });

          // Get pallet weight setting
          const { data: palletWeightSetting } = await supabase
            .from("load_report_settings")
            .select("setting_value")
            .eq("setting_key", "default_pallet_weight_kg")
            .single();

          palletWeightKg = palletWeightSetting ? Number(palletWeightSetting.setting_value) : 20;

          // Get all line items from matching load reports
          const loadReportIds = (loadReports ?? []).map((r) => r.id);
          const noPalletsByReportId: Record<string, boolean> = {};
          const reportDateById: Record<string, string> = {};
          for (const r of loadReports ?? []) {
            noPalletsByReportId[r.id] = Boolean((r as any).no_pallets_on_load);
            reportDateById[r.id] = (r as any).report_date;
          }

          // Fetch active rebate overrides for this site that overlap the report period
          const overrideRebateItemIds = rebateConfigs
            .map((c) => c.value_type_item_id)
            .filter((id): id is string => !!id);
          let siteOverrides: Array<{
            id: string;
            rebate_item_id: string;
            start_date: string;
            end_date: string;
            set_value: number;
            notes: string | null;
            waste_type: string | null;
          }> = [];
          if (overrideRebateItemIds.length > 0) {
            const { data: ovs } = await supabase
              .from("customer_site_rebate_overrides")
              .select("id, rebate_item_id, start_date, end_date, set_value, notes, waste_type")
              .eq("site_id", selectedSiteId)
              .in("rebate_item_id", overrideRebateItemIds)
              .lte("start_date", periodEnd)
              .gte("end_date", periodStart);
            siteOverrides = (ovs ?? []) as any;
          }
          // Map material_name (load waste_type) -> list of overrides applicable to that waste type.
          // An override applies to a waste type if:
          //   - it targets the same rebate item AND
          //   - either has no waste_type filter (applies to all waste types on this rebate item)
          //     or its waste_type matches this material exactly.
          const overridesByMaterialName: Record<string, typeof siteOverrides> = {};
          for (const cfg of rebateConfigs) {
            if (!cfg.value_type_item_id) continue;
            const matches = siteOverrides.filter(
              (o) =>
                o.rebate_item_id === cfg.value_type_item_id &&
                (!o.waste_type || o.waste_type === cfg.material_name)
            );
            if (matches.length > 0) overridesByMaterialName[cfg.material_name] = matches;
          }
          // (overrideWeights & overrideMeta hoisted to outer scope above)

          if (loadReportIds.length > 0) {
            const { data: lineItems } = await supabase
              .from("load_line_items")
              .select("load_report_id, waste_type, pallet_count, total_weight_kg, wet_charge_applied, rebate_threshold_applied")
              .in("load_report_id", loadReportIds);

            // Fetch weighbridge weights from data_hub_jobs by matching notes (job number)
            const jobNumbers = (loadReports ?? [])
              .map((r) => (r as any).notes)
              .filter((n): n is string => !!n && n.trim() !== "");

            let weighbridgeMap: Record<string, number> = {};
            if (jobNumbers.length > 0) {
              // Determine source based on site's load_report_type
              const source = getWeighbridgeSource(site.load_report_type);

              const { data: dataHubJobs } = await supabase
                .from("data_hub_jobs")
                .select("job_number, weight_t")
                .eq("source", source)
                .in("job_number", jobNumbers);

              for (const job of dataHubJobs ?? []) {
                const weightInTonnes = convertWeightToTonnes(job.weight_t, source);
                if (weightInTonnes != null) {
                  weighbridgeMap[job.job_number] = weightInTonnes * 1000; // Convert tonnes to kg for display
                }
              }
            }

            // Build individual report data
            for (const report of loadReports ?? []) {
              const reportLineItems = (lineItems ?? []).filter((li) => li.load_report_id === report.id);
              const jobNumber = (report as any).notes;
              const weighbridgeWeightKg = jobNumber ? weighbridgeMap[jobNumber] ?? null : null;

              loadReportsWithItems.push({
                id: report.id,
                report_date: (report as any).report_date,
                operator_name: (report as any).operator_name || "Unknown",
                vehicle_reg: (report as any).vehicle_reg || null,
                total_pallets: report.total_pallets ?? 0,
                total_weight_kg: (report as any).total_weight_kg ?? 0,
                notes: (report as any).notes || null,
                no_pallets_on_load: (report as any).no_pallets_on_load ?? null,
                wet_charge_percent: (report as any).wet_charge_percent ?? null,
                line_items: reportLineItems.map((li) => ({
                  waste_type: li.waste_type,
                  pallet_count: li.pallet_count,
                  total_weight_kg: Number(li.total_weight_kg),
                  wet_charge_applied: (li as any).wet_charge_applied ?? false,
                  rebate_threshold_applied: (li as any).rebate_threshold_applied ?? false,
                })),
                rebate_threshold_tonnes: (report as any).rebate_threshold_tonnes ?? 0,
                calculated_rebate: 0, // Will be calculated by the component
                weighbridge_weight_kg: weighbridgeWeightKg,
              });
            }

            // Aggregate NET weights by waste type (gross minus pallet weight per line item)
            // Also track total pallet weight across all load reports
            // AND track wet charge discounts per material
            let totalPalletWeightTonnes = 0;
            const wetChargeDiscounts: Record<string, { affectedWeight: number; discountPercent: number }[]> = {};
            // Per-material tonnes removed from rebate by per-load weight rebate thresholds
            const thresholdReductionsByMaterial: Record<string, number> = {};

            // Build a map of report id to wet_charge_percent
            const wetChargePercentByReportId: Record<string, number> = {};
            for (const r of loadReports ?? []) {
              wetChargePercentByReportId[r.id] = (r as any).wet_charge_percent ?? 0;
            }

            // Compute per-load threshold reductions (deduct first N tonnes of selected materials)
            for (const report of loadReports ?? []) {
              const threshold = Number((report as any).rebate_threshold_tonnes) || 0;
              if (threshold <= 0) continue;
              const reportItems = (lineItems ?? []).filter((li) => li.load_report_id === report.id);
              const noPallets = noPalletsByReportId[report.id] ?? false;
              const lines = reportItems
                .filter((li) => !li.waste_type.toLowerCase().includes("pallet weight"))
                .map((li, idx) => {
                  const grossKg = Number(li.total_weight_kg) || 0;
                  const palletKg = noPallets ? 0 : (Number(li.pallet_count) || 0) * palletWeightKg;
                  return {
                    id: String(idx),
                    wasteType: li.waste_type,
                    netTonnes: Math.max(0, grossKg - palletKg) / 1000,
                    thresholdApplied: (li as any).rebate_threshold_applied ?? false,
                  };
                });
              const reductions = computeThresholdReductions(lines, threshold);
              for (const line of lines) {
                const r = reductions[line.id] ?? 0;
                if (r > 0) {
                  thresholdReductionsByMaterial[line.wasteType] =
                    (thresholdReductionsByMaterial[line.wasteType] ?? 0) + r;
                }
              }
            }

            
            for (const item of lineItems ?? []) {
              const wasteType = item.waste_type;
              if (wasteType.toLowerCase().includes("pallet weight")) continue;

              const grossKg = Number(item.total_weight_kg) || 0;
              const palletCount = Number(item.pallet_count) || 0;
              const noPallets = noPalletsByReportId[item.load_report_id] ?? false;
              const palletKg = noPallets ? 0 : palletCount * palletWeightKg;
              const actualKg = Math.max(0, grossKg - palletKg);
              const actualTonnes = actualKg / 1000;

              // Check for an active override matching this line's report date + material
              const reportDate = reportDateById[item.load_report_id];
              const materialOverrides = overridesByMaterialName[wasteType] ?? [];
              const matchedOverride = materialOverrides.find(
                (o) => reportDate && reportDate >= o.start_date && reportDate <= o.end_date
              );

              if (matchedOverride) {
                // Bucket this weight under the override; subtract from normal weight
                if (!overrideWeights[wasteType]) overrideWeights[wasteType] = {};
                overrideWeights[wasteType][matchedOverride.id] =
                  (overrideWeights[wasteType][matchedOverride.id] ?? 0) + actualTonnes;
                overrideMeta[matchedOverride.id] = {
                  rate: Number(matchedOverride.set_value),
                  start_date: matchedOverride.start_date,
                  end_date: matchedOverride.end_date,
                  notes: matchedOverride.notes,
                };
              } else {
                lineItemWeights[wasteType] = (lineItemWeights[wasteType] ?? 0) + actualTonnes;
              }
              totalPalletWeightTonnes += palletKg / 1000;
              
              // Track wet charge discount for this item
              const wetChargeApplied = (item as any).wet_charge_applied ?? false;
              const wetChargePercent = wetChargePercentByReportId[item.load_report_id] ?? 0;
              if (wetChargeApplied && wetChargePercent > 0) {
                if (!wetChargeDiscounts[wasteType]) {
                  wetChargeDiscounts[wasteType] = [];
                }
                wetChargeDiscounts[wasteType].push({
                  affectedWeight: actualTonnes,
                  discountPercent: wetChargePercent,
                });
              }
            }
            
            // Store total pallet weight for later use - this is the key for pallet charge
            lineItemWeights["__PALLET_WEIGHT__"] = (lineItemWeights["__PALLET_WEIGHT__"] ?? 0) + totalPalletWeightTonnes;
            // Store wet charge discounts for rebate calculation
            (lineItemWeights as any).__WET_CHARGE_DISCOUNTS__ = wetChargeDiscounts;
            // Store weight rebate threshold reductions for rebate calculation
            (lineItemWeights as any).__THRESHOLD_REDUCTIONS__ = thresholdReductionsByMaterial;
          }
        }
      } else {
        // No price set, set empty price set name
        setPriceSetName("");
      }

      // Build report rows
      const reportRows: RebateReportRow[] = [];
      let palletChargeRate = 0;
      let palletChargeRateSource = "";
      
      // Get wet charge discounts (if any)
      const wetChargeDiscounts = (lineItemWeights as any).__WET_CHARGE_DISCOUNTS__ as Record<string, { affectedWeight: number; discountPercent: number }[]> | undefined;
      // Get weight rebate threshold reductions (if any)
      const thresholdReductions = (lineItemWeights as any).__THRESHOLD_REDUCTIONS__ as Record<string, number> | undefined;

      for (const config of rebateConfigs) {
        // Determine the base rate
        let rate = 0;
        let rateSource = "";

        if (config.range_type === "set" && config.set_value !== null) {
          rate = config.set_value;
          rateSource = "Custom";
        } else if (config.value_type_item_id) {
          const monthVal = monthlyValueMap[config.value_type_item_id];
          if (monthVal) {
            rate = config.range_type === "higher" ? monthVal.higher : monthVal.lower;
            rateSource = `${config.value_type_name} (${config.range_type})`;
          } else {
            rateSource = "No monthly value";
          }
        } else {
          rateSource = "Not configured";
        }

        // Apply rate adjustment (can be positive or negative)
        if (config.adjustment !== 0) {
          rate += config.adjustment;
          rateSource += ` ${config.adjustment > 0 ? "+" : ""}${config.adjustment}`;
        }

        // Check if this is the pallet weight charge config - use the aggregated pallet weight
        const isPalletCharge = config.material_name.toLowerCase().includes("pallet");
        const totalPalletWeight = lineItemWeights["__PALLET_WEIGHT__"] ?? 0;
        
        // Get weight: for pallet charge use the aggregated total, otherwise use material weight
        const weight_tonnes = isPalletCharge ? totalPalletWeight : (lineItemWeights[config.material_name] ?? 0);

        // Calculate rebate value with wet charge discount and weight threshold applied
        // For cost items (rebate_category === "cost"), negate the value
        const isCostItem = config.rebate_category === "cost";
        const thresholdReductionT = isPalletCharge ? 0 : (thresholdReductions?.[config.material_name] ?? 0);
        const rebatableWeight = Math.max(0, weight_tonnes - thresholdReductionT);
        let rebate_value = rebatableWeight * rate;
        if (isCostItem) rebate_value = -Math.abs(rebate_value);
        let hasWetCharge = false;
        let wetChargeSummary = "";

        // Apply wet charge discounts for this material
        const materialDiscounts = wetChargeDiscounts?.[config.material_name];
        if (materialDiscounts && materialDiscounts.length > 0 && !isPalletCharge) {
          hasWetCharge = true;
          // Calculate the discounted rebate:
          // Full weight at full rate, minus the discount amount for affected portions
          const totalWeight = lineItemWeights[config.material_name] ?? 0;
          const totalAffectedWeight = materialDiscounts.reduce((sum, d) => sum + d.affectedWeight, 0);
          let unaffectedWeight = totalWeight - totalAffectedWeight;

          // Remove the threshold from unaffected weight first, then from affected
          let remainingThreshold = thresholdReductionT;
          const unaffApplied = Math.min(unaffectedWeight, remainingThreshold);
          unaffectedWeight -= unaffApplied;
          remainingThreshold -= unaffApplied;
          const affectedForRebate = Math.max(0, totalAffectedWeight - remainingThreshold);
          const affScale = totalAffectedWeight > 0 ? affectedForRebate / totalAffectedWeight : 0;

          // Get unique discount percentages for summary
          const uniqueDiscounts = [...new Set(materialDiscounts.map(d => d.discountPercent))];
          wetChargeSummary = `${totalAffectedWeight.toFixed(2)}t @ ${uniqueDiscounts.map(d => `-${d}%`).join(", ")}`;

           // Rebate = (unaffected weight * rate) + sum of (scaled affected weight * rate * (1 - discount%))
           rebate_value = unaffectedWeight * rate;
           for (const discount of materialDiscounts) {
             rebate_value += discount.affectedWeight * affScale * rate * (1 - discount.discountPercent / 100);
           }
           if (isCostItem) rebate_value = -Math.abs(rebate_value);
         }


        reportRows.push({
          material_name: config.material_name,
          weight_tonnes,
          rate_per_tonne: rate,
          rebate_value,
          rate_source: rateSource,
          has_wet_charge: hasWetCharge,
          wet_charge_summary: wetChargeSummary,
        });
      }

      // Add extra report rows for any overridden weight (one row per active override)
      for (const config of rebateConfigs) {
        const matBuckets = overrideWeights[config.material_name];
        if (!matBuckets) continue;
        const isCostItem = config.rebate_category === "cost";
        for (const [overrideId, weight_tonnes] of Object.entries(matBuckets)) {
          const meta = overrideMeta[overrideId];
          if (!meta || weight_tonnes <= 0) continue;
          let rebate_value = weight_tonnes * meta.rate;
          if (isCostItem) rebate_value = -Math.abs(rebate_value);
          const fmt = (d: string) => format(new Date(d + "T00:00:00"), "d MMM");
          reportRows.push({
            material_name: `${config.material_name} (Override)`,
            weight_tonnes,
            rate_per_tonne: meta.rate,
            rebate_value,
            rate_source: `Override ${fmt(meta.start_date)}–${fmt(meta.end_date)}${meta.notes ? ` · ${meta.notes}` : ""}`,
          });
        }
      }

      setReportData(reportRows);
      setIndividualReports(loadReportsWithItems);
      setPalletWeightKgState(palletWeightKg);
      setReportGenerated(true);
      refreshLock();
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate rebate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load Reports totals
  // Total rebate includes all materials + pallet charge (which is typically negative)
  const loadReportsTotalRebate = reportData.reduce((sum, r) => sum + r.rebate_value, 0);
  // Total weight = material net weight + pallet weight (to show gross total)
  // This gives the full weight picture: net material weight + pallet weight = gross weight
  const materialNetWeight = reportData
    .filter((r) => !r.material_name.toLowerCase().includes("pallet"))
    .reduce((sum, r) => sum + r.weight_tonnes, 0);
  const palletWeight = reportData
    .filter((r) => r.material_name.toLowerCase().includes("pallet"))
    .reduce((sum, r) => sum + r.weight_tonnes, 0);
  const loadReportsTotalWeight = materialNetWeight + palletWeight;

  // Combined totals (Load Reports + Skip/RoRo)
  const combinedTotalRebate = loadReportsTotalRebate + skipRoroTotalRebate;
  const combinedTotalWeight = loadReportsTotalWeight + skipRoroTotalWeight;

  // Consolidate materials into categories for the Total tab
  // Categories: Cardboard, Films, Scrap Metal, Other
  const consolidatedData = (() => {
    // Note: Pallet Weight Charge weight is excluded from category weight totals
    // but its rebate value is still included in the "Other" category rebate
    const categories: Record<string, { 
      weight: number; 
      rebate: number; 
      sources: { name: string; weight: number; rate: number; rebate: number; source: string }[] 
    }> = {
      "Cardboard": { weight: 0, rebate: 0, sources: [] },
      "Paper": { weight: 0, rebate: 0, sources: [] },
      "Films": { weight: 0, rebate: 0, sources: [] },
      "Scrap Metal": { weight: 0, rebate: 0, sources: [] },
      "Other": { weight: 0, rebate: 0, sources: [] },
    };

    // Categorize Load Reports materials
    for (const row of reportData) {
      const name = row.material_name.toLowerCase();
      const isPalletWeightCharge = name.includes("pallet weight charge");
      let category = "Other";
      
      if (name.includes("card") || name.includes("cardboard")) {
        category = "Cardboard";
      } else if (name.includes("paper")) {
        category = "Paper";
      } else if (name.includes("film")) {
        category = "Films";
      } else if (name.includes("scrap") || name.includes("ferrous") || name.includes("metal")) {
        category = "Scrap Metal";
      }

      // Pallet Weight Charge: include rebate value but NOT weight in totals
      if (!isPalletWeightCharge) {
        categories[category].weight += row.weight_tonnes;
      }
      categories[category].rebate += row.rebate_value;
      categories[category].sources.push({
        name: `${row.material_name} (Load Reports)`,
        weight: row.weight_tonnes,
        rate: row.rate_per_tonne,
        rebate: row.rebate_value,
        source: row.rate_source,
      });
    }

    // Categorize Skip/RoRo materials
    for (const summary of skipRoroSummaries) {
      let category = "Other";
      
      if (summary.material_type === "card_loose") {
        category = "Cardboard";
      } else if (summary.material_type === "scrap_metal") {
        category = "Scrap Metal";
      }

      categories[category].weight += summary.total_weight_tonnes;
      categories[category].rebate += summary.rebate_value;
      categories[category].sources.push({
        name: `${summary.material_label} (RoRo/Skip)`,
        weight: summary.total_weight_tonnes,
        rate: summary.rate_per_tonne,
        rebate: summary.rebate_value,
        source: summary.rate_source,
      });
    }

    // Convert to array, filter empty, sort rebates before charges
    return Object.entries(categories)
      .filter(([_, data]) => data.weight > 0 || data.rebate !== 0)
      .map(([name, data]) => ({
        category: name,
        ...data,
      }))
      .sort((a, b) => b.rebate - a.rebate);
  })();

  const exportToExcel = () => {
    const exportCustomer = customers.find((c) => c.id === selectedCustomerId);
    if (!exportCustomer || !dateRange?.from) return;

    const siteName = isCustomerMidweighMode ? "Customer Midweigh Report" : (selectedSite?.site_name ?? "Customer-Level Report");

    // Helper to round numbers for Excel (keeps as number type)
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const wb = XLSX.utils.book_new();

    // ============ Sheet 1: Summary ============
    const summaryHeader = [
      ["Rebate Report"],
      ["Customer", exportCustomer.customer_name],
      ["Site", siteName],
      ["Period", `${format(dateRange.from, "d MMM yyyy")}${dateRange.to && dateRange.to !== dateRange.from ? ` to ${format(dateRange.to, "d MMM yyyy")}` : ""}`],
      ["Rebate Set", priceSetName || "Customer-Level Midweigh Rebates"],
      [],
      ["Category", "Weight (t)", "Value (£)"],
    ];

    const summaryData = consolidatedData.map((cat) => [
      cat.category,
      round2(cat.weight),
      round2(cat.rebate),
    ]);

    summaryData.push([
      "TOTAL",
      round2(combinedTotalWeight),
      round2(combinedTotalRebate),
    ]);

    const summaryWsData = [...summaryHeader, ...summaryData];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryWsData);
    summaryWs["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    // ============ Sheet 2: Load Reports Detail ============
    const loadReportsHeader = [
      ["Load Reports Detail"],
      [],
      ["Date", "Operator", "Vehicle Reg", "Job Number", "Pallets", "Total Weight (kg)", "Weighbridge (kg)", "Reconciliation Status"],
    ];

    const loadReportsData = individualReports.map((report) => {
      const weighbridge = report.weighbridge_weight_kg;
      let reconciliationStatus = "-";
      if (weighbridge != null) {
        const diff = Math.abs(report.total_weight_kg - weighbridge);
        reconciliationStatus = diff > 50 ? "Needs Reconciliation" : "OK";
      }
      return [
        format(new Date(report.report_date), "dd/MM/yyyy"),
        report.operator_name,
        report.vehicle_reg || "-",
        report.notes || "-",
        report.total_pallets,
        report.total_weight_kg,
        weighbridge ?? "-",
        reconciliationStatus,
      ];
    });

    const loadReportsWsData = [...loadReportsHeader, ...loadReportsData];
    const loadReportsWs = XLSX.utils.aoa_to_sheet(loadReportsWsData);
    loadReportsWs["!cols"] = [
      { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
      { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, loadReportsWs, "Load Reports");

    // ============ Sheet 3: Load Report Line Items ============
    const lineItemsHeader = [
      ["Load Report Line Items"],
      [],
      ["Report Date", "Operator", "Job Number", "Material", "Pallets", "Weight (kg)", "Rate (£/t)", "Rebate (£)"],
    ];

    const lineItemsData: (string | number)[][] = [];
    for (const report of individualReports) {
      for (const li of report.line_items) {
        // Skip Pallet Weight Charge - it's calculated separately
        if (li.waste_type.toLowerCase().includes("pallet weight")) continue;
        
        const rateConfig = reportData.find((r) => r.material_name === li.waste_type);
        const rate = rateConfig?.rate_per_tonne ?? 0;
        const weightTonnes = li.total_weight_kg / 1000;
        const rebate = weightTonnes * rate;

        lineItemsData.push([
          format(new Date(report.report_date), "dd/MM/yyyy"),
          report.operator_name,
          report.notes || "-",
          li.waste_type,
          li.pallet_count,
          round2(li.total_weight_kg),
          round2(rate),
          round2(rebate),
        ]);
      }
    }

    const lineItemsWsData = [...lineItemsHeader, ...lineItemsData];
    const lineItemsWs = XLSX.utils.aoa_to_sheet(lineItemsWsData);
    lineItemsWs["!cols"] = [
      { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
      { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, lineItemsWs, "Line Items");

    // ============ Sheet 4: Materials Summary ============
    const materialsHeader = [
      ["Materials Summary (Load Reports)"],
      [],
      ["Material", "Weight (t)", "Rate (£/t)", "Rate Source", "Value (£)"],
    ];

    const materialsData = reportData.map((row) => [
      row.material_name,
      round2(row.weight_tonnes),
      round2(row.rate_per_tonne),
      row.rate_source,
      round2(row.rebate_value),
    ]);

    materialsData.push([
      "TOTAL",
      round2(loadReportsTotalWeight),
      "",
      "",
      round2(loadReportsTotalRebate),
    ]);

    const materialsWsData = [...materialsHeader, ...materialsData];
    const materialsWs = XLSX.utils.aoa_to_sheet(materialsWsData);
    materialsWs["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, materialsWs, "Materials Summary");

    // ============ Sheet 5: RoRo/Skip Summary ============
    if (skipRoroSummaries.length > 0) {
      const skipHeader = [
        ["RoRo / Skip Rebates Summary"],
        [],
        ["Material", "Weight (t)", "Rate (£/t)", "Adjustment (£)", "Rate Source", "Value (£)"],
      ];

      const skipData = skipRoroSummaries.map((s) => [
        s.material_label,
        round2(s.total_weight_tonnes),
        round2(s.rate_per_tonne),
        round2(s.adjustment),
        s.rate_source,
        round2(s.rebate_value),
      ]);

      skipData.push([
        "TOTAL",
        round2(skipRoroTotalWeight),
        "",
        "",
        "",
        round2(skipRoroTotalRebate),
      ]);

      const skipWsData = [...skipHeader, ...skipData];
      const skipWs = XLSX.utils.aoa_to_sheet(skipWsData);
      skipWs["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, skipWs, "RoRo Skip");
    }

    // Generate filename
    const fileName = `Rebate_${exportCustomer.customer_name}_${siteName.replace(/[^a-zA-Z0-9]/g, "_")}_${format(dateRange.from, "yyyyMMdd")}${dateRange.to ? `-${format(dateRange.to, "yyyyMMdd")}` : ""}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleCustomerExport = async () => {
    const exportCustomer = customers.find((c) => c.id === selectedCustomerId);
    if (!exportCustomer || !dateRange?.from) return;
    const siteName = isCustomerMidweighMode
      ? "Customer Midweigh Report"
      : (selectedSite?.site_name ?? "Customer-Level Report");
    const periodLabel = `${format(dateRange.from, "d MMM yyyy")}${dateRange.to && dateRange.to !== dateRange.from ? ` to ${format(dateRange.to, "d MMM yyyy")}` : ""}`;
    try {
      await exportCustomerRebateReport({
        customerName: exportCustomer.customer_name,
        siteName,
        periodLabel,
        rebateSetName: priceSetName || "Customer-Level Midweigh Rebates",
        consolidatedData,
        totalWeight: combinedTotalWeight,
        totalRebate: combinedTotalRebate,
      });
    } catch (err) {
      console.error("Customer export failed", err);
      toast({ title: "Export failed", description: "Could not generate the customer report.", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Customer</Label>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.customer_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Site</Label>
          {selectedCustomerId && sites.length === 0 && !selectedCustomer?.data_hub_customer ? (
            <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              No sites configured
            </div>
          ) : (
            <Select
              value={selectedSiteId}
              onValueChange={setSelectedSiteId}
              disabled={!selectedCustomerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {/* Show Customer Midweigh option if customer has data_hub_customer mapping */}
                {selectedCustomer?.data_hub_customer && (
                  <SelectItem value="__CUSTOMER_MIDWEIGH__">
                    ⚖️ Customer Midweigh Report (No Site)
                  </SelectItem>
                )}
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.site_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <ReportDateRangePicker
          value={dateRange}
          onChange={setDateRange}
          customerId={selectedCustomerId}
        />
      </div>


      <Button
        onClick={generateReport}
        disabled={(!selectedSiteId && sites.length > 0 && !selectedCustomer?.data_hub_customer) || !selectedCustomerId || loading}
        className="w-full md:w-auto"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <DollarSign className="h-4 w-4 mr-2" />
            Generate Rebate Report
          </>
        )}
      </Button>

      {reportGenerated && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-semibold">
                {isCustomerMidweighMode 
                  ? `${selectedCustomer?.customer_name ?? "Customer"} (Midweigh)` 
                  : (selectedSite?.site_name ?? selectedCustomer?.customer_name ?? "Customer")
                } – {dateRange?.from && format(dateRange.from, "d MMM yyyy")}
                {dateRange?.to && dateRange.to !== dateRange.from && ` to ${format(dateRange.to, "d MMM yyyy")}`}
              </h3>
              {priceSetName && !isCustomerMidweighMode ? (
                <p className="text-sm text-muted-foreground">
                  Rebate Set: <span className="font-medium">{priceSetName}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Customer-level Midweigh Rebates</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-sm">
                {combinedTotalWeight.toFixed(2)} tonnes
              </Badge>
              <Badge variant="default" className={cn("text-sm", combinedTotalRebate >= 0 ? "bg-green-600" : "bg-red-600")}>
                £{combinedTotalRebate.toFixed(2)}
              </Badge>
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleCustomerExport}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Customer Export
              </Button>
            </div>
          </div>

          <RebateReportLockControls
            lockedReport={lockedReport}
            valueChanges={valueChanges}
            loading={lockLoading}
            onLock={async () => {
              const combinedSnapshot = {
                reportData,
                skipRoroSummaries,
                totalRebate: combinedTotalRebate,
                totalWeight: combinedTotalWeight,
              };
              return lockReport(combinedSnapshot, rebateValuesSnapshotRef.current, combinedTotalRebate, combinedTotalWeight);
            }}
            onUnlock={unlockReport}
            onDismissChanges={dismissChanges}
            onUpdateWithNewValues={async () => {
              await generateReport();
              const combinedSnapshot = {
                reportData,
                skipRoroSummaries,
                totalRebate: combinedTotalRebate,
                totalWeight: combinedTotalWeight,
              };
              return lockReport(combinedSnapshot, rebateValuesSnapshotRef.current, combinedTotalRebate, combinedTotalWeight);
            }}
          />

          <Tabs defaultValue="total" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="total">Total</TabsTrigger>
              <TabsTrigger value="load-reports">Load Reports</TabsTrigger>
              <TabsTrigger value="roro-skip">RoRo / Skip Rebates</TabsTrigger>
            </TabsList>

            <TabsContent value="total" className="mt-4">
              {consolidatedData.length > 0 ? (() => {
                const rebateRows = consolidatedData.filter((cat) => cat.rebate >= 0);
                const chargeRows = consolidatedData.filter((cat) => cat.rebate < 0);
                const rebatesTotal = rebateRows.reduce((sum, c) => sum + c.rebate, 0);
                const rebatesWeight = rebateRows.reduce((sum, c) => sum + c.weight, 0);
                const chargesTotal = chargeRows.reduce((sum, c) => sum + c.rebate, 0);
                const chargesWeight = chargeRows.reduce((sum, c) => sum + c.weight, 0);

                const renderCategoryRows = (rows: typeof consolidatedData) =>
                  rows.map((cat, idx) => (
                    <TableRow key={idx} className="border-b">
                      <TableCell className="font-semibold align-top">{cat.category}</TableCell>
                      <TableCell className="text-right align-top font-medium">{cat.weight.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground align-top">
                        <div className="space-y-0.5">
                          {cat.sources.map((src, srcIdx) => (
                            <div key={srcIdx}>{src.name}</div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground align-top">
                        <div className="space-y-0.5">
                          {cat.sources.map((src, srcIdx) => (
                            <div key={srcIdx}>
                              {src.weight.toFixed(2)}t @ £{src.rate.toFixed(2)} = £{src.rebate.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right font-semibold align-top", cat.rebate >= 0 ? "text-green-600" : "text-red-600")}>
                        £{cat.rebate.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ));

                return (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Weight (t)</TableHead>
                          <TableHead colSpan={2}>Sources</TableHead>
                          <TableHead className="text-right">Value (£)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rebateRows.length > 0 && (
                          <>
                            <TableRow className="bg-green-50 dark:bg-green-950/20">
                              <TableCell colSpan={5} className="font-bold text-green-700 dark:text-green-400 text-base py-2">
                                Rebates
                              </TableCell>
                            </TableRow>
                            {renderCategoryRows(rebateRows)}
                            <TableRow className="bg-green-50/50 dark:bg-green-950/10 border-t">
                              <TableCell className="font-bold text-green-700 dark:text-green-400">REBATES TOTAL</TableCell>
                              <TableCell className="text-right font-bold text-green-700 dark:text-green-400">{rebatesWeight.toFixed(2)}</TableCell>
                              <TableCell colSpan={2}></TableCell>
                              <TableCell className="text-right font-bold text-green-600">£{rebatesTotal.toFixed(2)}</TableCell>
                            </TableRow>
                          </>
                        )}
                        {chargeRows.length > 0 && (
                          <>
                            <TableRow className="bg-red-50 dark:bg-red-950/20">
                              <TableCell colSpan={5} className="font-bold text-red-700 dark:text-red-400 text-base py-2">
                                Charges
                              </TableCell>
                            </TableRow>
                            {renderCategoryRows(chargeRows)}
                            <TableRow className="bg-red-50/50 dark:bg-red-950/10 border-t">
                              <TableCell className="font-bold text-red-700 dark:text-red-400">CHARGES TOTAL</TableCell>
                              <TableCell className="text-right font-bold text-red-700 dark:text-red-400">{chargesWeight.toFixed(2)}</TableCell>
                              <TableCell colSpan={2}></TableCell>
                              <TableCell className="text-right font-bold text-red-600">£{chargesTotal.toFixed(2)}</TableCell>
                            </TableRow>
                          </>
                        )}
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{combinedTotalWeight.toFixed(2)}</TableCell>
                          <TableCell colSpan={2}></TableCell>
                          <TableCell className={cn("text-right", combinedTotalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                            £{combinedTotalRebate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                );
              })() : (
                <p className="text-muted-foreground text-center py-8">
                  No materials configured for this site's rebate set.
                </p>
              )}

              <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground mt-4">
                <p className="font-medium mb-1">Data Source:</p>
                <p>
                  Cardboard, Films, and Scrap Metal are consolidated from both Load Reports and RoRo/Skip data.
                  See individual tabs for detailed breakdowns.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="load-reports" className="mt-4 space-y-6">
              {/* Summary Table */}
              {reportData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Weight (t)</TableHead>
                        <TableHead className="text-right">Rate (£/t)</TableHead>
                        <TableHead>Rate Source</TableHead>
                        <TableHead className="text-right">Value (£)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((row, idx) => (
                        <TableRow key={idx} className={row.has_wet_charge ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
                          <TableCell className="font-medium">
                            {row.material_name}
                            {row.has_wet_charge && (
                              <Badge variant="outline" className="ml-2 text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700">
                                Wet Charge
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{row.weight_tonnes.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {row.rate_per_tonne !== 0 ? `£${row.rate_per_tonne.toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{row.rate_source}</span>
                            {row.has_wet_charge && row.wet_charge_summary && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                {row.wet_charge_summary}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={cn("text-right font-medium", row.rebate_value >= 0 ? "text-green-600" : "text-red-600")}>
                            £{row.rebate_value.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{loadReportsTotalWeight.toFixed(2)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell className={cn("text-right", loadReportsTotalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                          £{loadReportsTotalRebate.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No materials configured for this site's rebate set.
                </p>
              )}

              {/* Individual Load Report Cards */}
              <LoadReportCards
                reports={individualReports}
                rebateConfigs={reportData.map((r) => ({
                  material_name: r.material_name,
                  rate_per_tonne: r.rate_per_tonne,
                }))}
                palletWeightKg={palletWeightKgState}
              />
            </TabsContent>

            <TabsContent value="roro-skip" className="mt-4">
              {(selectedSite || selectedCustomer) && (
                <SkipRoroRebateTab
                  siteId={selectedSiteId}
                  customerId={selectedCustomerId}
                  dateRange={dateRange}
                  siteDataHubMappings={siteDataHubMappings}
                  dataHubCustomer={effectiveDataHubCustomer}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
