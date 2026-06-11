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
import { CalendarIcon, DollarSign, Loader2, FileSpreadsheet } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { DateRange } from "react-day-picker";
import { LoadReportCards, LoadReportCardData } from "@/components/customer-reporting/LoadReportCards";
import { ReportingPeriodSelector } from "./ReportingPeriodSelector";
import { SkipRoroRebateTab } from "@/components/customer-reporting/SkipRoroRebateTab";
import { useSkipRoroRebates } from "@/hooks/useSkipRoroRebates";
import { computeThresholdReductions } from "@/lib/rebate-threshold";
import { getWeighbridgeSource, convertWeightToTonnes } from "@/lib/weighbridge-source";
import { useLockedRebateReport } from "@/hooks/useLockedRebateReport";
import { RebateReportLockControls } from "@/components/customer-reporting/RebateReportLockControls";

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
};

interface CustomerPortalRebateReportProps {
  customerId: string;
  customerName: string;
  accessibleSiteIds?: string[];
}

export function CustomerPortalRebateReport({ customerId, customerName, accessibleSiteIds }: CustomerPortalRebateReportProps) {
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState(() => sessionStorage.getItem("portal-rebate-report-siteId") || "");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const saved = sessionStorage.getItem("portal-rebate-report-dateRange");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          from: parsed.from ? new Date(parsed.from) : undefined,
          to: parsed.to ? new Date(parsed.to) : undefined,
        };
      } catch { /* fall through */ }
    }
    return {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    };
  });

  // Persist selections to sessionStorage
  useEffect(() => {
    if (selectedSiteId) sessionStorage.setItem("portal-rebate-report-siteId", selectedSiteId);
  }, [selectedSiteId]);

  useEffect(() => {
    if (dateRange?.from || dateRange?.to) {
      sessionStorage.setItem("portal-rebate-report-dateRange", JSON.stringify({
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      }));
    }
  }, [dateRange]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<RebateReportRow[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [priceSetName, setPriceSetName] = useState("");
  const [individualReports, setIndividualReports] = useState<LoadReportCardData[]>([]);
  const [palletWeightKgState, setPalletWeightKgState] = useState(20);
  const rebateValuesSnapshotRef = useRef<Record<string, { lower: number; higher: number; name: string }>>({});

  // Get site data hub mappings for Skip/RoRo calculation
  const selectedSite = sites.find((s) => s.id === selectedSiteId);
  const siteDataHubMappings = selectedSite
    ? [
        selectedSite.data_hub_site,
        selectedSite.data_hub_site_2,
        selectedSite.data_hub_site_3,
        selectedSite.data_hub_site_4,
        selectedSite.data_hub_site_5,
      ].filter((s): s is string => !!s)
    : [];

  // Use the hook to get Skip/RoRo rebate totals
  const {
    loading: skipRoroLoading,
    summaries: skipRoroSummaries,
    totalRebate: skipRoroTotalRebate,
    totalWeight: skipRoroTotalWeight,
  } = useSkipRoroRebates(
    reportGenerated ? selectedSiteId : "",
    reportGenerated ? dateRange : undefined,
    siteDataHubMappings,
    reportGenerated ? customerId : undefined,
    selectedSite?.data_hub_customer ?? undefined
  );

  // Lock mechanism
  const {
    lockedReport,
    valueChanges,
    loading: lockLoading,
    lockReport,
    unlockReport,
    dismissChanges,
    refreshLock,
  } = useLockedRebateReport(
    selectedSiteId || null,
    customerId,
    dateRange?.from,
    dateRange?.to,
    "portal_rebate"
  );

  useEffect(() => {
    loadSites();
  }, [customerId, accessibleSiteIds]);

  const loadSites = async () => {
    let query = supabase
      .from("customer_sites")
      .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, load_report_type")
      .eq("customer_id", customerId)
      .order("site_name");
    
    // Filter to only accessible sites for portal users
    if (accessibleSiteIds && accessibleSiteIds.length > 0) {
      query = query.in("id", accessibleSiteIds);
    } else if (accessibleSiteIds && accessibleSiteIds.length === 0) {
      setSites([]);
      return;
    }
    
    const { data } = await query;
    setSites(data ?? []);
  };

  const formatDateRange = () => {
    if (!dateRange?.from) return "Select date range";
    if (!dateRange.to) return format(dateRange.from, "dd MMM yyyy");
    return `${format(dateRange.from, "dd MMM yyyy")} - ${format(dateRange.to, "dd MMM yyyy")}`;
  };

  const generateReport = async () => {
    if (!selectedSiteId || !dateRange?.from || !dateRange?.to) return;

    setLoading(true);
    setReportGenerated(false);

    try {
      const site = sites.find((s) => s.id === selectedSiteId);
      if (!site) return;

      // Get the site's price set
      const { data: priceSetLink } = await supabase
        .from("customer_site_price_sets")
        .select("price_set_id, rebate_price_sets(name)")
        .eq("site_id", selectedSiteId)
        .single();

      if (!priceSetLink) {
        toast({
          title: "No Rebate Set",
          description: "This site doesn't have a rebate set configured.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setPriceSetName((priceSetLink.rebate_price_sets as any)?.name || "Unknown");

      // Get rebate configuration for this price set
      const { data: rebateItems } = await supabase
        .from("rebate_price_set_items")
        .select("rebate_item_id, value_type, set_value")
        .eq("price_set_id", priceSetLink.price_set_id);

      if (!rebateItems || rebateItems.length === 0) {
        toast({
          title: "No Materials Configured",
          description: "No materials are configured for this site's rebate set.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch value_type_item_id and material names
      const rebateConfigs: RebateConfig[] = [];

      for (const item of rebateItems) {
        const { data: fullItem } = await supabase
          .from("rebate_price_set_items")
          .select("*")
          .eq("rebate_item_id", item.rebate_item_id)
          .eq("price_set_id", priceSetLink.price_set_id)
          .single();

        const { data: material } = await supabase
          .from("load_waste_types")
          .select("waste_type, rebate_category")
          .eq("id", item.rebate_item_id)
          .single();

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

      // Get all months within the date range
      const monthsInRange = eachMonthOfInterval({
        start: dateRange.from,
        end: dateRange.to,
      });

      const monthStarts = monthsInRange.map((m) => format(startOfMonth(m), "yyyy-MM-dd"));

      // Get monthly values for all months in the range
      const { data: monthlyValues } = await supabase
        .from("rebate_monthly_values")
        .select("item_id, lower_range, higher_range, month_start")
        .in("month_start", monthStarts);

      // Use the latest month's values when spanning multiple months
      const monthlyValueMap: Record<string, { lower: number; higher: number }> = {};
      const sortedMonthStarts = [...monthStarts].sort();
      const latestMonthStart = sortedMonthStarts[sortedMonthStarts.length - 1];

      for (const mv of monthlyValues ?? []) {
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


      const rangeStart = format(dateRange.from, "yyyy-MM-dd");
      const rangeEnd = format(dateRange.to, "yyyy-MM-dd");
      
      const { data: loadReports } = await supabase
        .from("load_reports")
        .select("id, report_date, status, total_pallets, no_pallets_on_load, wet_charge_percent, rebate_threshold_tonnes, operator_name, vehicle_reg, total_weight_kg, notes")
        .eq("site_id", selectedSiteId)
        .gte("report_date", rangeStart)
        .lte("report_date", rangeEnd)
        .eq("status", "submitted")
        .eq("exclude_from_rebate", false)
        .order("report_date", { ascending: false });

      const { data: palletWeightSetting } = await supabase
        .from("load_report_settings")
        .select("setting_value")
        .eq("setting_key", "default_pallet_weight_kg")
        .single();
      
      const palletWeightKg = palletWeightSetting ? Number(palletWeightSetting.setting_value) : 20;

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
          .lte("start_date", rangeEnd)
          .gte("end_date", rangeStart);
        siteOverrides = (ovs ?? []) as any;
      }
      // Map material_name (load waste_type) -> applicable overrides
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
      const overrideWeights: Record<string, Record<string, number>> = {};
      const overrideMeta: Record<string, { rate: number; start_date: string; end_date: string; notes: string | null }> = {};

      let lineItemWeights: Record<string, number> = {};
      let totalPalletWeightTonnes = 0;
      const loadReportsWithItems: LoadReportCardData[] = [];
      const wetChargeDiscounts: Record<string, { affectedWeight: number; discountPercent: number }[]> = {};
      const thresholdReductionsByMaterial: Record<string, number> = {};
      const wetChargePercentByReportId: Record<string, number> = {};
      for (const r of loadReports ?? []) {
        wetChargePercentByReportId[r.id] = (r as any).wet_charge_percent ?? 0;
      }
      
      if (loadReportIds.length > 0) {
        const { data: lineItems } = await supabase
          .from("load_line_items")
          .select("load_report_id, waste_type, pallet_count, total_weight_kg, wet_charge_applied, rebate_threshold_applied")
          .in("load_report_id", loadReportIds);
        
        // Fetch weighbridge weights from data_hub_jobs by matching notes (job number)
        const jobNumbers = (loadReports ?? [])
          .map((r) => r.notes)
          .filter((n): n is string => !!n && n.trim() !== "");
        
        let weighbridgeMap: Record<string, number> = {};
        if (jobNumbers.length > 0) {
          const source = getWeighbridgeSource(site.load_report_type);
          
          const { data: dataHubJobs } = await supabase
            .from("data_hub_jobs")
            .select("job_number, weight_t")
            .eq("source", source)
            .in("job_number", jobNumbers);
          
          for (const job of dataHubJobs ?? []) {
            const weightInTonnes = convertWeightToTonnes(job.weight_t, source);
            if (weightInTonnes != null) {
              weighbridgeMap[job.job_number] = weightInTonnes * 1000;
            }
          }
        }
        
        for (const report of loadReports ?? []) {
          const reportLineItems = (lineItems ?? []).filter((li) => li.load_report_id === report.id);
          const weighbridgeWeightKg = report.notes ? weighbridgeMap[report.notes] ?? null : null;
          
          loadReportsWithItems.push({
            id: report.id,
            report_date: report.report_date,
            operator_name: report.operator_name || "Unknown",
            vehicle_reg: report.vehicle_reg || null,
            total_pallets: report.total_pallets ?? 0,
            total_weight_kg: report.total_weight_kg ?? 0,
            notes: report.notes || null,
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
            calculated_rebate: 0,
            weighbridge_weight_kg: weighbridgeWeightKg,
          });
        }

        // Compute per-load weight rebate threshold reductions (deduct first N tonnes of selected materials)
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
      }

      lineItemWeights["__PALLET_WEIGHT__"] = (lineItemWeights["__PALLET_WEIGHT__"] ?? 0) + totalPalletWeightTonnes;

      // Build report rows
      const reportRows: RebateReportRow[] = [];

      for (const config of rebateConfigs) {
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

        if (config.adjustment !== 0) {
          rate += config.adjustment;
          rateSource += ` ${config.adjustment > 0 ? "+" : ""}${config.adjustment}`;
        }

        const isPalletCharge = config.material_name.toLowerCase().includes("pallet");
        const weight_tonnes = isPalletCharge
          ? (lineItemWeights["__PALLET_WEIGHT__"] ?? 0)
          : (lineItemWeights[config.material_name] ?? 0);

        const isCostItem = config.rebate_category === "cost";
        let rebate_value = weight_tonnes * rate;
        if (isCostItem) rebate_value = -Math.abs(rebate_value);

        const materialDiscounts = wetChargeDiscounts[config.material_name];
        if (materialDiscounts && materialDiscounts.length > 0 && !isPalletCharge) {
          const totalWeight = lineItemWeights[config.material_name] ?? 0;
          const unaffectedWeight = totalWeight - materialDiscounts.reduce((sum, d) => sum + d.affectedWeight, 0);

          rebate_value = unaffectedWeight * rate;
          for (const discount of materialDiscounts) {
            rebate_value += discount.affectedWeight * rate * (1 - discount.discountPercent / 100);
          }
          if (isCostItem) rebate_value = -Math.abs(rebate_value);
        }

        reportRows.push({
          material_name: config.material_name,
          weight_tonnes,
          rate_per_tonne: rate,
          rebate_value,
          rate_source: rateSource,
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

  // Load Reports totals (exclude Pallet Weight Charge from weight total - it's a deduction, not material weight)
  const loadReportsTotalRebate = reportData.reduce((sum, r) => sum + r.rebate_value, 0);
  const loadReportsTotalWeight = reportData
    .filter((r) => r.material_name !== "Pallet Weight Charge")
    .reduce((sum, r) => sum + r.weight_tonnes, 0);

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

    // Convert to array and filter out empty categories
    return Object.entries(categories)
      .filter(([_, data]) => data.weight > 0 || data.rebate !== 0)
      .map(([name, data]) => ({
        category: name,
        ...data,
      }))
      .sort((a, b) => b.rebate - a.rebate);
  })();

  const exportToExcel = () => {
    if (!selectedSite || !dateRange?.from || !dateRange?.to) return;

    const wb = XLSX.utils.book_new();

    // Helper to round numbers for Excel (keeps as number type)
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const round4 = (n: number) => Math.round(n * 10000) / 10000;

    // Sheet 1: Summary
    const summaryData = [
      ["Rebate Report Summary"],
      [],
      ["Customer:", customerName],
      ["Site:", selectedSite.site_name],
      ["Period:", formatDateRange()],
      ["Rebate Set:", priceSetName],
      ["Generated:", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Total Weight (t):", round2(combinedTotalWeight)],
      ["Total Rebate (£):", round2(combinedTotalRebate)],
      [],
      [],
      ["Material", "Weight (t)", "Rate (£/t)", "Rate Source", "Value (£)"],
      ...reportData.map((row) => [
        row.material_name,
        round2(row.weight_tonnes),
        row.rate_per_tonne !== 0 ? round2(row.rate_per_tonne) : "-",
        row.rate_source,
        round2(row.rebate_value),
      ]),
      ["Total", round2(loadReportsTotalWeight), "", "", round2(loadReportsTotalRebate)],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // Sheet 2: Load Reports
    const loadReportsData = [
      ["Load Reports Detail"],
      [],
      ["Date", "Operator", "Vehicle Reg", "Job Number", "Pallets", "Report Weight (t)", "Weighbridge (t)", "Reconciliation Status"],
      ...individualReports.map((report) => {
        const weighbridgeT = report.weighbridge_weight_kg != null ? round2(report.weighbridge_weight_kg / 1000) : "-";
        const reportT = round2(report.total_weight_kg / 1000);
        let status = "-";
        if (report.weighbridge_weight_kg != null) {
          const diff = Math.abs(report.total_weight_kg - report.weighbridge_weight_kg);
          status = diff > 50 ? "Needs Reconciliation" : "OK";
        }
        return [
          format(new Date(report.report_date), "dd/MM/yyyy"),
          report.operator_name,
          report.vehicle_reg || "-",
          report.notes || "-",
          report.total_pallets,
          reportT,
          weighbridgeT,
          status,
        ];
      }),
    ];
    const wsLoadReports = XLSX.utils.aoa_to_sheet(loadReportsData);
    wsLoadReports["!cols"] = [
      { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLoadReports, "Load Reports");

    // Sheet 3: Line Items
    const lineItemsRows: any[][] = [
      ["Line Items Detail"],
      [],
      ["Date", "Operator", "Job Number", "Material", "Pallets", "Weight (kg)", "Weight (t)", "Rate (£/t)", "Rebate (£)"],
    ];
    for (const report of individualReports) {
      for (const li of report.line_items) {
        if (li.waste_type.toLowerCase().includes("pallet weight")) continue;
        // Find rate for this material
        const materialConfig = reportData.find((r) => r.material_name === li.waste_type);
        const rate = materialConfig?.rate_per_tonne ?? 0;
        const isCost = materialConfig ? materialConfig.rebate_value < 0 : false;
        // Use net weight (gross minus pallet tare) to match portal display
        const noPallets = report.no_pallets_on_load ?? false;
        const palletKg = noPallets ? 0 : (li.pallet_count ?? 0) * palletWeightKgState;
        const netKg = Math.max(0, li.total_weight_kg - palletKg);
        const weightT = netKg / 1000;
        let rebate = weightT * rate;
        if (isCost) rebate = -Math.abs(rebate);
        lineItemsRows.push([
          format(new Date(report.report_date), "dd/MM/yyyy"),
          report.operator_name,
          report.notes || "-",
          li.waste_type,
          li.pallet_count,
          round2(netKg),
          round4(weightT),
          round2(isCost ? -Math.abs(rate) : rate),
          round2(rebate),
        ]);
      }
      // Add pallet weight charge row per report if applicable
      if (report.total_pallets > 0) {
        const palletWeightT = (report.total_pallets * palletWeightKgState) / 1000;
        const palletConfig = reportData.find((r) => r.material_name === "Pallet Weight Charge");
        const palletRate = palletConfig?.rate_per_tonne ?? 0;
        const palletRebate = -(Math.abs(palletWeightT * palletRate));
        lineItemsRows.push([
          format(new Date(report.report_date), "dd/MM/yyyy"),
          report.operator_name,
          report.notes || "-",
          "Pallet Weight Charge",
          report.total_pallets,
          round2(report.total_pallets * palletWeightKgState),
          round4(palletWeightT),
          round2(-Math.abs(palletRate)),
          round2(palletRebate),
        ]);
      }
    }
    const wsLineItems = XLSX.utils.aoa_to_sheet(lineItemsRows);
    wsLineItems["!cols"] = [
      { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLineItems, "Line Items");

    // Sheet 4: Materials Summary
    const materialsSummaryData = [
      ["Materials Summary"],
      [],
      ["Material", "Total Weight (t)", "Rate (£/t)", "Rate Source", "Total Value (£)"],
      ...reportData.map((row) => [
        row.material_name,
        round2(row.weight_tonnes),
        row.rate_per_tonne !== 0 ? round2(row.rate_per_tonne) : "-",
        row.rate_source,
        round2(row.rebate_value),
      ]),
      [],
      ["Grand Total", round2(loadReportsTotalWeight), "", "", round2(loadReportsTotalRebate)],
    ];
    const wsMaterialsSummary = XLSX.utils.aoa_to_sheet(materialsSummaryData);
    wsMaterialsSummary["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsMaterialsSummary, "Materials Summary");

    const fromStr = format(dateRange.from, "yyyyMMdd");
    const toStr = format(dateRange.to, "yyyyMMdd");
    const fileName = `${customerName}_${selectedSite.site_name}_Rebate_${fromStr}_${toStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Site</Label>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger>
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.site_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <ReportingPeriodSelector
            customerId={customerId}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={generateReport}
          disabled={!selectedSiteId || !dateRange?.from || !dateRange?.to || loading}
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

        {reportGenerated && reportData.length > 0 && (
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        )}
      </div>

      {reportGenerated && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-semibold">
                {selectedSite?.site_name} – {dateRange?.from && format(dateRange.from, "d MMM yyyy")}
                {dateRange?.to && dateRange.to !== dateRange.from && ` to ${format(dateRange.to, "d MMM yyyy")}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                Rebate Set: <span className="font-medium">{priceSetName}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-sm">
                {combinedTotalWeight.toFixed(2)} tonnes
              </Badge>
              <Badge variant="default" className={cn("text-sm", combinedTotalRebate >= 0 ? "bg-green-600" : "bg-red-600")}>
                £{combinedTotalRebate.toFixed(2)}
              </Badge>
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
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.material_name}</TableCell>
                          <TableCell className="text-right">{row.weight_tonnes.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {row.rate_per_tonne !== 0 ? `£${row.rate_per_tonne.toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{row.rate_source}</span>
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
              {selectedSite && (
                <SkipRoroRebateTab
                  siteId={selectedSiteId}
                  customerId={customerId}
                  dateRange={dateRange}
                  siteDataHubMappings={siteDataHubMappings}
                  dataHubCustomer={selectedSite.data_hub_customer ?? undefined}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
