import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMidweighRebateCustomer } from "@/lib/midweigh-rebates";
import { convertWeightToTonnes } from "@/lib/weighbridge-source";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, Loader2, Mail, RefreshCw, Download, Lock, AlertTriangle, Eye, FileSpreadsheet } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import * as XLSX from "xlsx";
import { ReportDateRangePicker } from "./ReportDateRangePicker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/useAuth";
import { fetchActivePriceSetLink } from "@/lib/rebate-price-set";
import { fetchAllCustomers } from "@/lib/fetch-all";
import { getCustomerRebateExportBase64, type CustomerExportCategory } from "@/lib/customer-rebate-export";
import {
  fetchTrackingForPeriod,
  upsertTracking,
  trackingKey,
  STATUS_META,
  type RebateTrackingRow,
  type RebateTrackingStatus,
} from "@/lib/rebate-tracking";

type Customer = { id: string; customer_name: string; customer_code: string; data_hub_customer: string | null };
type Site = {
  id: string;
  site_name: string;
  customer_id: string;
  data_hub_customer: string | null;
  data_hub_site: string | null;
  data_hub_site_2: string | null;
  data_hub_site_3: string | null;
  data_hub_site_4: string | null;
  data_hub_site_5: string | null;
  load_report_type: string | null;
  owner_contact_id: string | null;
};
type CustomerContact = { id: string; full_name: string; email: string | null; customer_id: string };

type LoadLineItem = {
  waste_type: string;
  grossKg: number;
  pallets: number;
  palletKg: number;
  netKg: number;
};

type LoadLine = {
  ref: string;
  date: string | null;
  source: string;
  description: string;
  weight: number;
  items?: LoadLineItem[];
  totalPallets?: number;
};


type SiteBreakdown = {
  site: Site;
  totalRebate: number;
  totalWeight: number;
  materials: Array<{ name: string; weight: number; rate: number; rebate: number; source: string }>;
  loads: LoadLine[];
};

type CustomerRebateSummary = {
  customer: Customer;
  contacts: CustomerContact[];
  totalRebate: number;
  totalWeight: number;
  siteBreakdowns: SiteBreakdown[];
};

type PossiblyDue = {
  customer: string;
  source: string;
  totalWeight: number;
  totalJobs: number;
  wasteTypes: Array<{ waste_description: string; total_weight: number; job_count: number }>;
};

export function MonthlyRebateGenerationV2() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [generated, setGenerated] = useState(false);

  const [summaries, setSummaries] = useState<CustomerRebateSummary[]>([]);
  const [possiblyDue, setPossiblyDue] = useState<PossiblyDue[]>([]);
  const [tracking, setTracking] = useState<Map<string, RebateTrackingRow>>(new Map());
  const [lockedSiteIds, setLockedSiteIds] = useState<Set<string>>(new Set());

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Email dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [reportSummary, setReportSummary] = useState<CustomerRebateSummary | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRebateSummary | null>(null);
  const [selectedSite, setSelectedSite] = useState<SiteBreakdown | null>(null);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSiteId, setSendingSiteId] = useState<string | null>(null);

  // Bulk (per-site) review dialog
  type BulkDraft = { sb: SiteBreakdown; include: boolean; recipient: string; subject: string; body: string };
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<CustomerRebateSummary | null>(null);
  const [bulkDrafts, setBulkDrafts] = useState<BulkDraft[]>([]);
  const [bulkSending, setBulkSending] = useState(false);


  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Customer-level status derived from per-site tracking rows.
  const customerStatus = (s: CustomerRebateSummary): RebateTrackingStatus => {
    const rows = s.siteBreakdowns
      .map((sb) => tracking.get(trackingKey(s.customer.id, sb.site.id)))
      .filter(Boolean) as RebateTrackingRow[];
    const custRow = tracking.get(trackingKey(s.customer.id, null));
    if (custRow) rows.push(custRow);
    if (rows.length === 0) return "not_generated";
    if (rows.some((r) => r.status === "sent")) return "sent";
    if (rows.some((r) => r.status === "generated")) return "generated";
    return "not_generated";
  };

  const generate = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    setGenerated(false);
    setProgress(0);
    setProgressLabel("Loading customers & sites...");

    try {
      const periodStart = format(dateRange.from, "yyyy-MM-dd");
      const periodEnd = format(dateRange.to, "yyyy-MM-dd");

      const customers = await fetchAllCustomers<{
        id: string;
        customer_name: string;
        customer_code: string | null;
        data_hub_customer: string | null;
      }>("id, customer_name, customer_code, data_hub_customer");

      // Sites (paginated)
      const allSitesRaw: Site[] = [];
      {
        const pageSize = 1000;
        let offset = 0;
        while (true) {
          const { data: page, error } = await supabase
            .from("customer_sites")
            .select(
              "id, site_name, customer_id, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, load_report_type, owner_contact_id",
            )
            .order("id")
            .range(offset, offset + pageSize - 1);
          if (error) throw error;
          if (!page || page.length === 0) break;
          allSitesRaw.push(...(page as Site[]));
          if (page.length < pageSize) break;
          offset += pageSize;
        }
      }

      // Only sites/customers with rebate lines configured can ever produce a
      // rebate. Pre-filter here so we don't fire per-site queries for the
      // ~20k Data Hub sites that have no rebate setup at all.
      setProgressLabel("Finding sites with rebate setup...");
      const [{ data: psRows }, { data: siteSkipRows }, { data: custSkipRows }] = await Promise.all([
        supabase.from("customer_site_price_sets").select("site_id"),
        supabase
          .from("customer_site_skip_rebates")
          .select("site_id, material_type, value_type, value_type_item_id, set_value, adjustment, threshold_tonnes, rebate_enabled"),
        supabase
          .from("customer_skip_rebates")
          .select("customer_id, material_type, value_type, value_type_item_id, set_value, adjustment, threshold_tonnes, rebate_enabled"),
      ]);
      const eligibleSiteIds = new Set<string>([
        ...(psRows ?? []).map((r: any) => r.site_id),
        ...(siteSkipRows ?? []).map((r: any) => r.site_id),
      ]);
      const eligibleCustomerIds = new Set<string>((custSkipRows ?? []).map((r: any) => r.customer_id));
      // IMPORTANT: customer-level Skip/RoRo rebate lines are a CUSTOMER total,
      // not something each of the customer's (often hundreds of) sites should
      // repeat. Only site-level setup makes a site eligible here; customer
      // level lines are calculated once per customer further below.
      const allSites = allSitesRaw.filter((s) => eligibleSiteIds.has(s.id));

      const siteSkipConfigsBySite = new Map<string, any[]>();
      for (const r of siteSkipRows ?? []) {
        const list = siteSkipConfigsBySite.get((r as any).site_id) ?? [];
        list.push(r);
        siteSkipConfigsBySite.set((r as any).site_id, list);
      }
      const custSkipConfigsByCustomer = new Map<string, any[]>();
      for (const r of custSkipRows ?? []) {
        const list = custSkipConfigsByCustomer.get((r as any).customer_id) ?? [];
        list.push(r);
        custSkipConfigsByCustomer.set((r as any).customer_id, list);
      }

      // Shared lookups fetched once (previously queried inside nested loops).
      const [{ data: allWasteTypes }, { data: allMappings }, { data: rebateRules }, { data: allRebateItems }] =
        await Promise.all([
          supabase.from("load_waste_types").select("id, waste_type, rebate_category"),
          supabase.from("data_hub_rebate_mappings").select("waste_description, material_type_id, rebate_item_id"),
          supabase.from("rebate_rules").select("rule_key, is_enabled"),
          supabase.from("rebate_items").select("id, name"),
        ]);
      const wasteTypeById = new Map<string, { waste_type: string; rebate_category: string | null }>();
      for (const wt of allWasteTypes ?? []) wasteTypeById.set(wt.id, wt as any);
      const rebateItemNameById = new Map<string, string>();
      for (const ri of allRebateItems ?? []) rebateItemNameById.set(ri.id, ri.name);
      const mappingByWaste = new Map<string, any>();
      for (const m of allMappings ?? []) mappingByWaste.set(m.waste_description, m);
      const excludeSkipJobType =
        rebateRules?.find((r) => r.rule_key === "exclude_skip_job_type")?.is_enabled ?? false;
      const excludeDeliverMovement =
        rebateRules?.find((r) => r.rule_key === "exclude_deliver_movement")?.is_enabled ?? false;

      const MATERIAL_TYPE_MAP: Record<string, string> = { card_loose: "Card Loose", scrap_metal: "Scrap Metal" };
      const MATERIAL_TYPE_TO_WASTE_TYPES: Record<string, string[]> = {
        card_loose: ["card loose", "cardboard"],
        scrap_metal: ["scrap ferrous", "scrap non-ferrous", "scrap metal"],
      };
      const targetCategories = ["Roll on Roll off", "Skips", "Midweigh", "Flat Bed pick up"];

      // Turn a set of Data Hub jobs into rebate material lines for the given configs.
      const buildSkipRoroMaterials = (
        configs: any[],
        jobs: Array<{
          waste_description: string | null;
          weight_t: number;
          category: string | null;
          job_type: string | null;
          movement_type: string | null;
          job_number?: string | null;
          job_date?: string | null;
          site?: string | null;
        }>,
        labelSuffix: string,
      ) => {
        const materials: SiteBreakdown["materials"] = [];
        const loads: LoadLine[] = [];
        const seenLoads = new Set<string>();
        let rebateTotal = 0;
        let weightTotal = 0;
        let filtered = jobs;
        if (excludeSkipJobType) {
          filtered = filtered.filter((j) => (j.category !== "Midweigh" ? true : (j.job_type ?? "").toUpperCase() !== "SKIP"));
        }
        if (excludeDeliverMovement) {
          filtered = filtered.filter((j) => {
            if (j.category !== "Skips" && j.category !== "Roll on Roll off") return true;
            const mt = (j.movement_type ?? "").toLowerCase();
            return mt !== "deliver" && mt !== "delivery";
          });
        }
        for (const config of configs) {
          if (config.rebate_enabled === false) continue;
          const patterns = MATERIAL_TYPE_TO_WASTE_TYPES[config.material_type] ?? [];
          let totalWeight = 0;
          for (const job of filtered) {
            const mapping = job.waste_description ? mappingByWaste.get(job.waste_description) : null;
            if (!mapping?.material_type_id) continue;
            const wasteTypeLower = (wasteTypeById.get(mapping.material_type_id)?.waste_type ?? "").toLowerCase();
            if (patterns.some((p) => wasteTypeLower.includes(p))) {
              totalWeight += job.weight_t;
              const ref = job.job_number ?? "—";
              const key = `${ref}|${job.job_date ?? ""}|${job.waste_description ?? ""}|${job.weight_t}`;
              if (!seenLoads.has(key)) {
                seenLoads.add(key);
                loads.push({
                  ref,
                  date: job.job_date ?? null,
                  source: job.category === "Midweigh" ? "Midweigh" : "Skiptrak",
                  description: [job.waste_description ?? "—", job.site ? `· ${job.site}` : ""].filter(Boolean).join(" "),
                  weight: job.weight_t,
                });
              }
            }
          }
          if (totalWeight === 0) continue;
          let rate = 0;
          if (config.value_type === "set" && config.set_value !== null) rate = Number(config.set_value);
          else if (config.value_type_item_id) {
            const monthVal = monthlyValueMap[config.value_type_item_id];
            if (monthVal) rate = config.value_type === "higher" ? monthVal.higher : monthVal.lower;
          }
          rate += config.adjustment ?? 0;
          const threshold = config.threshold_tonnes ?? 0;
          const rebate = Math.max(0, totalWeight - threshold) * rate;
          rebateTotal += rebate;
          weightTotal += totalWeight;
          materials.push({
            name: `${MATERIAL_TYPE_MAP[config.material_type] ?? config.material_type} (${labelSuffix})`,
            weight: totalWeight,
            rate,
            rebate,
            source: threshold > 0 ? `After ${threshold}t threshold` : "Market rate",
          });
        }
        return { materials, rebateTotal, weightTotal, loads };
      };



      const { data: allContacts } = await supabase
        .from("customer_contacts")
        .select("id, full_name, email, customer_id");

      const { data: palletWeightSetting } = await supabase
        .from("load_report_settings")
        .select("setting_value")
        .eq("setting_key", "default_pallet_weight_kg")
        .single();
      const palletWeightKg = palletWeightSetting ? Number(palletWeightSetting.setting_value) : 20;

      // Monthly market values (averaged across months in range)
      const monthsInRange = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
      const monthStarts = monthsInRange.map((m) => format(startOfMonth(m), "yyyy-MM-dd"));
      const { data: monthlyValues } = await supabase
        .from("rebate_monthly_values")
        .select("item_id, lower_range, higher_range, month_start")
        .in("month_start", monthStarts);

      const valueAccumulator: Record<string, { lowerSum: number; higherSum: number; count: number }> = {};
      for (const mv of monthlyValues ?? []) {
        if (!valueAccumulator[mv.item_id]) valueAccumulator[mv.item_id] = { lowerSum: 0, higherSum: 0, count: 0 };
        valueAccumulator[mv.item_id].lowerSum += mv.lower_range ?? 0;
        valueAccumulator[mv.item_id].higherSum += mv.higher_range ?? 0;
        valueAccumulator[mv.item_id].count += 1;
      }
      const monthlyValueMap: Record<string, { lower: number; higher: number }> = {};
      for (const [itemId, acc] of Object.entries(valueAccumulator)) {
        monthlyValueMap[itemId] = {
          lower: acc.count > 0 ? acc.lowerSum / acc.count : 0,
          higher: acc.count > 0 ? acc.higherSum / acc.count : 0,
        };
      }

      // Process customers with at least one configured site, plus customers
      // that only have customer-level Skip/RoRo rebate lines.
      const customersWithSites = (customers ?? []).filter(
        (c) => (allSites ?? []).some((s) => s.customer_id === c.id) || eligibleCustomerIds.has(c.id),
      );

      const totalToProcess = customersWithSites.length || 1;

      const result: CustomerRebateSummary[] = [];

      for (let i = 0; i < customersWithSites.length; i++) {
        const customer = customersWithSites[i];
        setProgressLabel(`Calculating ${customer.customer_name}...`);
        setProgress(Math.round((i / totalToProcess) * 90));

        const customerSites = (allSites ?? []).filter((s) => s.customer_id === customer.id);
        const customerContacts = (allContacts ?? []).filter((c) => c.customer_id === customer.id);

        let customerTotalRebate = 0;
        let customerTotalWeight = 0;
        const siteBreakdowns: SiteBreakdown[] = [];
        const customerUsedJobIds = new Set<string>();


        for (const site of customerSites) {
          const priceSetLink = await fetchActivePriceSetLink(site.id, periodEnd);

          let rebateItems: Array<{
            rebate_item_id: string;
            value_type: string;
            set_value: number | null;
            value_type_item_id: string | null;
            adjustment: number | null;
          }> | null = null;
          if (priceSetLink) {
            const { data } = await supabase
              .from("rebate_price_set_items")
              .select("rebate_item_id, value_type, set_value, value_type_item_id, adjustment")
              .eq("price_set_id", priceSetLink.price_set_id);
            rebateItems = (data ?? []) as typeof rebateItems;
          }

          // Rebate lines must already be set up (site price set items, or
          // SITE-level Skip/RoRo rebate lines). Customer-level lines are
          // handled once per customer after this loop.
          const configuredSkipConfigs = siteSkipConfigsBySite.get(site.id) ?? [];

          const hasConfiguredRebateLines =
            (rebateItems?.length ?? 0) > 0 ||
            configuredSkipConfigs.some((c: any) => c.rebate_enabled !== false);

          if (!hasConfiguredRebateLines) continue;

          const rebateItemNames: Record<string, string> = Object.fromEntries(rebateItemNameById);


          const { data: loadReports } = await supabase
            .from("load_reports")
            .select("id, total_pallets, no_pallets_on_load, report_date, vehicle_reg")
            .eq("site_id", site.id)
            .gte("report_date", periodStart)
            .lte("report_date", periodEnd)
            .eq("status", "submitted")
            .eq("exclude_from_rebate", false);

          const loadReportIds = (loadReports ?? []).map((r) => r.id);
          const noPalletsByReportId: Record<string, boolean> = {};
          for (const r of loadReports ?? []) noPalletsByReportId[r.id] = Boolean((r as any).no_pallets_on_load);

          const siteLoads: LoadLine[] = [];
          const perReport = new Map<string, { weight: number; wasteTypes: Set<string>; items: LoadLineItem[]; pallets: number }>();

          let lineItemWeights: Record<string, number> = {};
          let totalPalletWeightTonnes = 0;
          if (loadReportIds.length > 0) {
            const { data: lineItems } = await supabase
              .from("load_line_items")
              .select("load_report_id, waste_type, total_weight_kg, pallet_count")
              .in("load_report_id", loadReportIds);
            for (const item of lineItems ?? []) {
              const wasteType = item.waste_type;
              if (wasteType.toLowerCase().includes("pallet weight")) continue;
              const grossKg = Number(item.total_weight_kg) || 0;
              const palletCount = Number(item.pallet_count) || 0;
              const noPallets = noPalletsByReportId[item.load_report_id] ?? false;
              const palletKg = noPallets ? 0 : palletCount * palletWeightKg;
              const actualKg = Math.max(0, grossKg - palletKg);
              lineItemWeights[wasteType] = (lineItemWeights[wasteType] ?? 0) + actualKg / 1000;
              totalPalletWeightTonnes += palletKg / 1000;

              const agg = perReport.get(item.load_report_id) ?? { weight: 0, wasteTypes: new Set<string>(), items: [], pallets: 0 };
              agg.weight += actualKg / 1000;
              agg.wasteTypes.add(wasteType);
              agg.pallets += noPallets ? 0 : palletCount;
              agg.items.push({
                waste_type: wasteType,
                grossKg,
                pallets: noPallets ? 0 : palletCount,
                palletKg,
                netKg: actualKg,
              });
              perReport.set(item.load_report_id, agg);
            }
            for (const r of loadReports ?? []) {
              const agg = perReport.get(r.id);
              if (!agg) continue;
              siteLoads.push({
                ref: (r as any).vehicle_reg || r.id.slice(0, 8).toUpperCase(),
                date: (r as any).report_date ?? null,
                source: "Load Report",
                description: Array.from(agg.wasteTypes).join(", "),
                weight: agg.weight,
                items: agg.items,
                totalPallets: agg.pallets,
              });
            }
          }

          const palletWeightTonnes = totalPalletWeightTonnes;

          let loadReportRebate = 0;
          let loadReportWeight = 0;
          const materials: SiteBreakdown["materials"] = [];

          for (const item of rebateItems ?? []) {
            const material = wasteTypeById.get(item.rebate_item_id) ?? null;


            const materialName = material?.waste_type ?? "Unknown";
            const isPalletCharge = materialName.toLowerCase().includes("pallet");
            const weight = isPalletCharge ? palletWeightTonnes : lineItemWeights[materialName] ?? 0;

            let rate = 0;
            let rateSource = "Not configured";
            const adjustment = Number(item.adjustment ?? 0);
            if (item.value_type === "set" && item.set_value !== null) {
              rate = Number(item.set_value);
              rateSource = "Custom";
            } else if (item.value_type_item_id) {
              const monthVal = monthlyValueMap[item.value_type_item_id];
              const itemName = rebateItemNames[item.value_type_item_id] ?? "Market";
              if (monthVal) {
                rate = item.value_type === "higher" ? monthVal.higher : monthVal.lower;
                rateSource = `${itemName} (${item.value_type})`;
              } else {
                rateSource = `${itemName} - No monthly value`;
              }
            }
            if (adjustment !== 0) {
              rate += adjustment;
              rateSource += ` ${adjustment > 0 ? "+" : ""}${adjustment}`;
            }
            const isCostItem = (material?.rebate_category ?? "rebate") === "cost";
            let rebate = weight * rate;
            if (isCostItem) rebate = -Math.abs(rebate);
            loadReportRebate += rebate;
            loadReportWeight += weight;

            if (weight > 0 || rate !== 0) {
              materials.push({
                name: isPalletCharge ? "Pallet Weight Charge" : `${materialName} (Load Reports)`,
                weight,
                rate,
                rebate,
                source: rateSource,
              });
            }
          }

          // Skip / RoRo rebates — SITE level only (matched on Data Hub sites).
          const siteDataHubMappings = [
            site.data_hub_site,
            site.data_hub_site_2,
            site.data_hub_site_3,
            site.data_hub_site_4,
            site.data_hub_site_5,
          ].filter((s): s is string => !!s);

          let skipRoroRebate = 0;
          let skipRoroWeight = 0;

          if (configuredSkipConfigs.length > 0 && siteDataHubMappings.length > 0) {
            const { data: siteJobs } = await supabase
              .from("data_hub_jobs")
              .select("id, job_number, job_date, site, waste_description, weight_t, category, job_type, movement_type")
              .in("site", siteDataHubMappings)
              .gte("job_date", periodStart)
              .lte("job_date", periodEnd)
              .in("category", targetCategories);

            const jobs = (siteJobs ?? []).map((j) => {
              if (j.id) customerUsedJobIds.add(j.id);
              return {
                waste_description: j.waste_description,
                category: j.category,
                job_type: j.job_type,
                movement_type: j.movement_type,
                job_number: j.job_number,
                job_date: j.job_date,
                site: j.site,
                weight_t: (j.category ?? "") === "Midweigh" ? (j.weight_t ?? 0) / 1000 : j.weight_t ?? 0,
              };
            });

            const built = buildSkipRoroMaterials(configuredSkipConfigs, jobs, "RoRo/Skip");
            skipRoroRebate = built.rebateTotal;
            skipRoroWeight = built.weightTotal;
            materials.push(...built.materials);
            siteLoads.push(...built.loads);
          }

          const siteTotalRebate = loadReportRebate + skipRoroRebate;
          const siteTotalWeight = loadReportWeight + skipRoroWeight;
          if (siteTotalRebate !== 0 || materials.length > 0) {
            siteLoads.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
            siteBreakdowns.push({ site, totalRebate: siteTotalRebate, totalWeight: siteTotalWeight, materials, loads: siteLoads });
          }
          customerTotalRebate += siteTotalRebate;
          customerTotalWeight += siteTotalWeight;
        }

        // Customer-level Skip/RoRo rebate lines: calculated ONCE for the whole
        // customer (weighbridge tickets and jobs carrying only a customer
        // name), never repeated per site.
        const customerSkipConfigs = (custSkipConfigsByCustomer.get(customer.id) ?? []).filter(
          (c: any) => c.rebate_enabled !== false,
        );
        const customerDataHubName = customer.data_hub_customer?.trim() || null;
        if (customerSkipConfigs.length > 0 && customerDataHubName) {
          const midweighAllowed = await isMidweighRebateCustomer({
            customerId: customer.id,
            dataHubCustomer: customerDataHubName,
          });
          const customerCategories = midweighAllowed
            ? targetCategories
            : targetCategories.filter((c) => c !== "Midweigh");

          const { data: customerJobs } = await supabase
            .from("data_hub_jobs")
            .select("id, job_number, job_date, site, waste_description, weight_t, category, job_type, movement_type")
            .eq("customer", customerDataHubName)
            .gte("job_date", periodStart)
            .lte("job_date", periodEnd)
            .in("category", customerCategories);

          const jobs = (customerJobs ?? [])
            .filter((j) => !j.id || !customerUsedJobIds.has(j.id))
            .map((j) => ({
              site: (j.site ?? "").trim(),
              waste_description: j.waste_description,
              category: j.category,
              job_type: j.job_type,
              movement_type: j.movement_type,
              job_number: j.job_number,
              job_date: j.job_date,
              weight_t: (j.category ?? "") === "Midweigh" ? (j.weight_t ?? 0) / 1000 : j.weight_t ?? 0,
            }));

          // Split customer-level jobs out by their Data Hub site so customers
          // with multiple site owners (e.g. Biffa) get one line per site.
          const siteByMapping = new Map<string, Site>();
          for (const s of customerSites) {
            for (const m of [s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5, s.site_name]) {
              const key = (m ?? "").trim().toLowerCase();
              if (key && !siteByMapping.has(key)) siteByMapping.set(key, s);
            }
          }

          const groups = new Map<string, { site: Site; jobs: typeof jobs }>();
          for (const job of jobs) {
            const matched = siteByMapping.get(job.site.toLowerCase());
            const key = matched ? matched.id : job.site ? `unmapped:${job.site}` : `cust-${customer.id}`;
            if (!groups.has(key)) {
              const site: Site = matched ?? {
                id: key,
                site_name: job.site ? `${job.site}` : `${customer.customer_name} (customer level)`,
                customer_id: customer.id,
                data_hub_customer: customerDataHubName,
                data_hub_site: job.site || null,
                data_hub_site_2: null,
                data_hub_site_3: null,
                data_hub_site_4: null,
                data_hub_site_5: null,
                load_report_type: null,
                owner_contact_id: null,
              };
              groups.set(key, { site, jobs: [] });
            }
            groups.get(key)!.jobs.push(job);
          }

          for (const { site, jobs: siteJobs } of groups.values()) {
            const built = buildSkipRoroMaterials(customerSkipConfigs, siteJobs, "RoRo/Skip");
            if (built.materials.length === 0) continue;

            const existing = siteBreakdowns.find((b) => b.site.id === site.id);
            if (existing) {
              existing.materials.push(...built.materials);
              existing.totalRebate += built.rebateTotal;
              existing.totalWeight += built.weightTotal;
              existing.loads.push(...built.loads);
              existing.loads.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
            } else {
              siteBreakdowns.push({
                site,
                totalRebate: built.rebateTotal,
                totalWeight: built.weightTotal,
                materials: built.materials,
                loads: built.loads.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
              });
            }
            customerTotalRebate += built.rebateTotal;
            customerTotalWeight += built.weightTotal;
          }
        }


        if (siteBreakdowns.length > 0) {
          result.push({
            customer,
            contacts: customerContacts,
            totalRebate: customerTotalRebate,
            totalWeight: customerTotalWeight,
            siteBreakdowns,
          });
        }
      }


      result.sort((a, b) => b.totalRebate - a.totalRebate);

      // Locked reports for the period
      const { data: lockedReports } = await supabase
        .from("locked_rebate_reports")
        .select("site_id")
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd);
      setLockedSiteIds(new Set((lockedReports ?? []).map((r) => r.site_id).filter((id): id is string => !!id)));

      // Tracking
      setProgressLabel("Loading communication status...");
      setProgress(94);
      const trackingMap = await fetchTrackingForPeriod(periodStart, periodEnd);

      // Possibly due (unconfigured) — waste removed but nothing in customer setup
      setProgressLabel("Checking for un-configured rebatable waste...");
      setProgress(97);
      const possibly = await computePossiblyDue(periodStart, periodEnd, result);

      setSummaries(result);
      setTracking(trackingMap);
      setPossiblyDue(possibly);
      setProgress(100);
      setGenerated(true);
    } catch (error: any) {
      console.error("Error generating rebate overview:", error);
      toast({ title: "Error", description: error?.message || "Failed to generate overview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const computePossiblyDue = async (
    periodStart: string,
    periodEnd: string,
    configured: CustomerRebateSummary[],
  ): Promise<PossiblyDue[]> => {
    const { data: rebateMappings } = await supabase
      .from("data_hub_rebate_mappings")
      .select("waste_description, material_type_id, rebate_item_id");
    const rebateableWaste = (rebateMappings ?? [])
      .filter((m) => m.rebate_item_id !== null || m.material_type_id !== null)
      .map((m) => m.waste_description);
    if (rebateableWaste.length === 0) return [];

    const { data: jobs } = await supabase
      .from("data_hub_jobs")
      .select("customer, source, waste_description, weight_t, site")
      .in("waste_description", rebateableWaste)
      .gte("job_date", periodStart)
      .lte("job_date", periodEnd)
      .not("customer", "is", null);
    if (!jobs || jobs.length === 0) return [];

    const [{ data: configuredSites }, { data: configuredCustomers }] = await Promise.all([
      supabase
        .from("customer_sites")
        .select(
          "data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, data_hub_customer",
        ),
      supabase.from("customers").select("data_hub_customer").not("data_hub_customer", "is", null),
    ]);

    const configuredKeys = new Set<string>();
    for (const c of configuredCustomers ?? []) {
      if (c.data_hub_customer) configuredKeys.add(c.data_hub_customer.toLowerCase());
    }
    for (const s of configuredSites ?? []) {
      [s.data_hub_customer, s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5]
        .filter(Boolean)
        .forEach((v) => configuredKeys.add((v as string).toLowerCase()));
    }

    const map: Record<string, PossiblyDue> = {};
    for (const job of jobs) {
      const custLower = (job.customer ?? "").toLowerCase();
      const siteLower = (job.site ?? "").toLowerCase();
      if (configuredKeys.has(custLower) || configuredKeys.has(siteLower)) continue;
      const key = `${job.customer}|${job.source}`;
      if (!map[key]) map[key] = { customer: job.customer!, source: job.source, totalWeight: 0, totalJobs: 0, wasteTypes: [] };
      let wt = map[key].wasteTypes.find((w) => w.waste_description === job.waste_description);
      if (!wt) {
        wt = { waste_description: job.waste_description!, total_weight: 0, job_count: 0 };
        map[key].wasteTypes.push(wt);
      }
      const tonnes = convertWeightToTonnes(Number(job.weight_t) || 0, job.source as "skiptrak" | "midweigh") || 0;
      wt.total_weight += tonnes;
      wt.job_count += 1;
      map[key].totalWeight += tonnes;
      map[key].totalJobs += 1;
    }
    return Object.values(map).sort((a, b) => b.totalWeight - a.totalWeight);
  };

  // ---- Excel / Email helpers ----
  const buildConsolidatedData = (siteBreakdowns: SiteBreakdown[]): CustomerExportCategory[] => {
    const categories: Record<string, CustomerExportCategory> = {
      Cardboard: { category: "Cardboard", weight: 0, rebate: 0, sources: [] },
      Paper: { category: "Paper", weight: 0, rebate: 0, sources: [] },
      Plastics: { category: "Plastics", weight: 0, rebate: 0, sources: [] },
      Films: { category: "Films", weight: 0, rebate: 0, sources: [] },
      "Scrap Metal": { category: "Scrap Metal", weight: 0, rebate: 0, sources: [] },
      Other: { category: "Other", weight: 0, rebate: 0, sources: [] },
    };
    for (const sb of siteBreakdowns) {
      for (const mat of sb.materials) {
        const name = mat.name.toLowerCase();
        let category = "Other";
        if (name.includes("card") || name.includes("cardboard")) category = "Cardboard";
        else if (name.includes("paper")) category = "Paper";
        else if (name.includes("plastic")) category = "Plastics";
        else if (name.includes("film")) category = "Films";
        else if (name.includes("scrap") || name.includes("ferrous") || name.includes("metal")) category = "Scrap Metal";
        categories[category].weight += mat.weight;
        categories[category].rebate += mat.rebate;
        categories[category].sources.push({ name: mat.name, weight: mat.weight, rate: mat.rate, rebate: mat.rebate, source: mat.source });
      }
    }
    return Object.values(categories).filter((c) => c.weight > 0 || c.rebate !== 0).sort((a, b) => b.rebate - a.rebate);
  };

  const periodLabel = dateRange?.from
    ? `${format(dateRange.from, "MMMM yyyy")}${dateRange.to && dateRange.to.getMonth() !== dateRange.from.getMonth() ? ` - ${format(dateRange.to, "MMMM yyyy")}` : ""}`
    : "Rebate Period";

  // Customer-level breakdowns use a synthetic site id — track them against the
  // customer (site_id null) instead.
  const trackSiteId = (sb: SiteBreakdown) => (sb.site.id.startsWith("cust-") ? null : sb.site.id);

  const markGenerated = async (summary: CustomerRebateSummary) => {
    if (!dateRange?.from || !dateRange?.to) return;
    const periodStart = format(dateRange.from, "yyyy-MM-dd");
    const periodEnd = format(dateRange.to, "yyyy-MM-dd");
    for (const sb of summary.siteBreakdowns) {
      await upsertTracking({
        customerId: summary.customer.id,
        siteId: trackSiteId(sb),
        periodStart,
        periodEnd,
        status: tracking.get(trackingKey(summary.customer.id, trackSiteId(sb)))?.status === "sent" ? "sent" : "generated",

        rebateAmount: sb.totalRebate,
        userId: user?.id,
      });
    }
    setTracking(await fetchTrackingForPeriod(periodStart, periodEnd));
  };

  const downloadExcel = async (summary: CustomerRebateSummary) => {
    const rows: Array<Record<string, any>> = [];
    for (const sb of summary.siteBreakdowns) {
      for (const mat of sb.materials) {
        rows.push({
          Customer: summary.customer.customer_name,
          Site: sb.site.site_name,
          Material: mat.name,
          "Weight (t)": Number(mat.weight.toFixed(4)),
          "Rate (£/t)": Number(mat.rate.toFixed(2)),
          "Rate Source": mat.source,
          "Value (£)": Number(mat.rebate.toFixed(2)),
        });
      }
      rows.push({ Customer: summary.customer.customer_name, Site: sb.site.site_name, Material: "SITE TOTAL", "Weight (t)": Number(sb.totalWeight.toFixed(4)), "Rate (£/t)": "", "Rate Source": "", "Value (£)": Number(sb.totalRebate.toFixed(2)) });
    }
    rows.push({ Customer: summary.customer.customer_name, Site: "TOTAL", Material: "", "Weight (t)": Number(summary.totalWeight.toFixed(4)), "Rate (£/t)": "", "Rate Source": "", "Value (£)": Number(summary.totalRebate.toFixed(2)) });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rebate");
    const safeName = summary.customer.customer_name.replace(/[^a-zA-Z0-9]/g, "_");
    XLSX.writeFile(workbook, `Rebate-${safeName}-${format(dateRange!.from!, "MMM-yyyy")}.xlsx`);
    await markGenerated(summary);
    toast({ title: "Downloaded", description: `Marked ${summary.customer.customer_name} as generated.` });
  };

  // Download the exact branded customer workbook that gets emailed, so it can
  // be reviewed before sending. `sb` limits it to a single site.
  const downloadBrandedReport = async (summary: CustomerRebateSummary, sb?: SiteBreakdown) => {
    if (!dateRange?.from || !dateRange?.to) return;
    const breakdowns = sb ? [sb] : summary.siteBreakdowns;
    if (breakdowns.length === 0) {
      toast({ title: "Nothing to download", description: "No rebate lines for this customer.", variant: "destructive" });
      return;
    }
    setDownloadingId(sb ? sb.site.id : summary.customer.id);
    try {
      const { base64, filename } = await getCustomerRebateExportBase64({
        customerName: summary.customer.customer_name,
        siteName: sb ? sb.site.site_name : "All sites",
        periodLabel,
        consolidatedData: buildConsolidatedData(breakdowns),
        totalWeight: breakdowns.reduce((s, b) => s + b.totalWeight, 0),
        totalRebate: breakdowns.reduce((s, b) => s + b.totalRebate, 0),
        siteBreakdowns: breakdowns.map((b) => ({
          siteName: b.site.site_name,
          totalWeight: b.totalWeight,
          totalRebate: b.totalRebate,
          materials: b.materials.map((m) => ({ name: m.name, weight: m.weight, rate: m.rate, rebate: m.rebate, source: m.source })),
        })),
        loadReportsScope: {
          siteIds: breakdowns.filter((b) => trackSiteId(b)).map((b) => b.site.id),
          periodStart: format(dateRange.from, "yyyy-MM-dd"),
          periodEnd: format(dateRange.to, "yyyy-MM-dd"),
          palletChargeRate:
            breakdowns.flatMap((b) => b.materials).find((m) => m.name.toLowerCase().includes("pallet"))?.rate ?? 0,
        },
      });

      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: filename });
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message ?? "Could not build the report.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  // Resolve the recipient email for a specific site: prefer the site's owner
  // contact, then fall back to the first customer contact with an email.
  const siteRecipient = (summary: CustomerRebateSummary, sb: SiteBreakdown) => {
    const owner = sb.site.owner_contact_id
      ? summary.contacts.find((c) => c.id === sb.site.owner_contact_id && c.email)
      : undefined;
    return owner ?? summary.contacts.find((c) => c.email);
  };

  const buildSiteBody = (contactName: string | undefined, sb: SiteBreakdown) =>
    `Dear ${contactName ?? "Customer"},\n\nWe are writing to inform you that rebates have been calculated for ${sb.site.site_name} for ${periodLabel}.\n\nTotal Rebate Due: £${sb.totalRebate.toFixed(2)}\n\nPlease submit an invoice for this amount at your earliest convenience.\n\nMaterial Breakdown:\n${sb.materials.map((m) => `- ${m.name}: ${m.weight.toFixed(2)}t @ £${m.rate.toFixed(2)}/t = £${m.rebate.toFixed(2)}`).join("\n")}\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\nClews Recycling Limited`;

  const openEmailDialog = (summary: CustomerRebateSummary, sb: SiteBreakdown) => {
    setSelectedCustomer(summary);
    setSelectedSite(sb);
    const contact = siteRecipient(summary, sb);
    setEmailRecipient(contact?.email ?? "");
    setEmailSubject(`Rebate Invoice Request - ${sb.site.site_name} - ${periodLabel}`);
    setEmailBody(buildSiteBody(contact?.full_name, sb));
    setEmailDialogOpen(true);
  };

  // Core send for a single site. Returns true on success.
  const sendSiteRebate = async (
    summary: CustomerRebateSummary,
    sb: SiteBreakdown,
    recipient: string,
    subject: string,
    body: string,
  ): Promise<boolean> => {
    if (!recipient || !dateRange?.from || !dateRange?.to) return false;
    const { base64, filename } = await getCustomerRebateExportBase64({
      customerName: summary.customer.customer_name,
      siteName: sb.site.site_name,
      periodLabel,
      consolidatedData: buildConsolidatedData([sb]),
      totalWeight: sb.totalWeight,
      totalRebate: sb.totalRebate,
      siteBreakdowns: [
        {
          siteName: sb.site.site_name,
          totalWeight: sb.totalWeight,
          totalRebate: sb.totalRebate,
          materials: sb.materials.map((m) => ({ name: m.name, weight: m.weight, rate: m.rate, rebate: m.rebate, source: m.source })),
        },
      ],
      loadReportsScope: {
        siteIds: trackSiteId(sb) ? [sb.site.id] : [],
        periodStart: format(dateRange.from, "yyyy-MM-dd"),
        periodEnd: format(dateRange.to, "yyyy-MM-dd"),
        palletChargeRate: sb.materials.find((m) => m.name.toLowerCase().includes("pallet"))?.rate ?? 0,
      },
    });


    const { error: emailError } = await supabase.functions.invoke("send-rebate-notification", {
      body: {
        to: recipient,
        subject,
        body,
        customerName: `${summary.customer.customer_name} - ${sb.site.site_name}`,
        attachment: { base64, filename },
      },
    });
    if (emailError) throw emailError;

    const periodStart = format(dateRange.from, "yyyy-MM-dd");
    const periodEnd = format(dateRange.to, "yyyy-MM-dd");

    // Store a copy of the exact workbook that was emailed so it can be
    // re-downloaded later from Sent Rebates.
    let uploadedPath: string | null = null;
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const path = `${summary.customer.id}/${periodStart}/${Date.now()}-${filename}`;
      const { error: upErr } = await supabase.storage
        .from("rebate-reports")
        .upload(path, bytes, {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: false,
        });
      if (upErr) console.error("Failed to store rebate report file", upErr);
      else uploadedPath = path;
    } catch (e) {
      console.error("Failed to prepare rebate report upload", e);
    }

    const { error: logError } = await supabase.from("rebate_email_logs").insert({
      customer_id: summary.customer.id,
      site_id: trackSiteId(sb),
      period_start: periodStart,
      period_end: periodEnd,
      rebate_amount: sb.totalRebate,
      recipient_email: recipient,
      sent_by: user?.id,
      file_path: uploadedPath,
      file_name: filename,
    });
    if (logError) console.error("Failed to log rebate email", logError);

    await upsertTracking({
      customerId: summary.customer.id,
      siteId: trackSiteId(sb),
      periodStart,
      periodEnd,
      status: "sent",
      rebateAmount: sb.totalRebate,
      userId: user?.id,
      recipientEmail: recipient,
    });
    return true;
  };

  // Send from the review dialog (single site).
  const sendRebateEmail = async () => {
    if (!selectedCustomer || !selectedSite || !emailRecipient || !dateRange?.from || !dateRange?.to) return;
    setSendingEmail(true);
    try {
      await sendSiteRebate(selectedCustomer, selectedSite, emailRecipient, emailSubject, emailBody);
      toast({ title: "Email Sent", description: `Rebate notification for ${selectedSite.site.site_name} sent to ${emailRecipient}` });
      setEmailDialogOpen(false);
      const periodStart = format(dateRange.from, "yyyy-MM-dd");
      const periodEnd = format(dateRange.to, "yyyy-MM-dd");
      setTracking(await fetchTrackingForPeriod(periodStart, periodEnd));
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({ title: "Error", description: error?.message || "Failed to send email", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  // Send one email per site to each site's owner (top-level split).
  const sendAllSites = async (summary: CustomerRebateSummary) => {
    if (!dateRange?.from || !dateRange?.to) return;
    setSendingSiteId(summary.customer.id);
    let sent = 0;
    const missing: string[] = [];
    try {
      for (const sb of summary.siteBreakdowns) {
        const contact = siteRecipient(summary, sb);
        if (!contact?.email) {
          missing.push(sb.site.site_name);
          continue;
        }
        await sendSiteRebate(
          summary,
          sb,
          contact.email,
          `Rebate Invoice Request - ${sb.site.site_name} - ${periodLabel}`,
          buildSiteBody(contact.full_name, sb),
        );
        sent += 1;
      }
      const periodStart = format(dateRange.from, "yyyy-MM-dd");
      const periodEnd = format(dateRange.to, "yyyy-MM-dd");
      setTracking(await fetchTrackingForPeriod(periodStart, periodEnd));
      toast({
        title: sent > 0 ? "Emails Sent" : "Nothing sent",
        description: [
          sent > 0 ? `${sent} site email${sent === 1 ? "" : "s"} sent.` : "",
          missing.length > 0 ? `No contact for: ${missing.join(", ")}.` : "",
        ].filter(Boolean).join(" "),
        variant: missing.length > 0 && sent === 0 ? "destructive" : undefined,
      });
    } catch (error: any) {
      console.error("Error sending site emails:", error);
      toast({ title: "Error", description: error?.message || "Failed to send emails", variant: "destructive" });
    } finally {
      setSendingSiteId(null);
    }
  };


  // Open a review dialog listing every site email before anything is sent.
  const openBulkDialog = (summary: CustomerRebateSummary) => {
    setBulkSummary(summary);
    setBulkDrafts(
      summary.siteBreakdowns.map((sb) => {
        const contact = siteRecipient(summary, sb);
        return {
          sb,
          include: Boolean(contact?.email),
          recipient: contact?.email ?? "",
          subject: `Rebate Invoice Request - ${sb.site.site_name} - ${periodLabel}`,
          body: buildSiteBody(contact?.full_name, sb),
        };
      }),
    );
    setBulkOpen(true);
  };

  const updateDraft = (index: number, patch: Partial<BulkDraft>) =>
    setBulkDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const sendBulk = async () => {
    if (!bulkSummary || !dateRange?.from || !dateRange?.to) return;
    setBulkSending(true);
    let sent = 0;
    const failed: string[] = [];
    try {
      for (const draft of bulkDrafts) {
        if (!draft.include || !draft.recipient) continue;
        try {
          await sendSiteRebate(bulkSummary, draft.sb, draft.recipient, draft.subject, draft.body);
          sent += 1;
        } catch (e) {
          console.error("Send failed", draft.sb.site.site_name, e);
          failed.push(draft.sb.site.site_name);
        }
      }
      const periodStart = format(dateRange.from, "yyyy-MM-dd");
      const periodEnd = format(dateRange.to, "yyyy-MM-dd");
      setTracking(await fetchTrackingForPeriod(periodStart, periodEnd));
      toast({
        title: sent > 0 ? "Emails Sent" : "Nothing sent",
        description: [
          sent > 0 ? `${sent} site email${sent === 1 ? "" : "s"} sent.` : "",
          failed.length > 0 ? `Failed: ${failed.join(", ")}.` : "",
        ].filter(Boolean).join(" "),
        variant: sent === 0 ? "destructive" : undefined,
      });
      if (failed.length === 0) setBulkOpen(false);
    } finally {
      setBulkSending(false);
    }
  };

  const grandTotal = summaries.reduce((sum, s) => sum + s.totalRebate, 0);

  const sentCount = summaries.filter((s) => customerStatus(s) === "sent").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <ReportDateRangePicker value={dateRange} onChange={setDateRange} allCustomers label="Period" />
        <Button onClick={generate} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Overview
            </>
          )}
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">
            {progressLabel} ({progress}%)
          </p>
        </div>
      )}

      {generated && !loading && (
        <div className="space-y-6">
          {/* Summary header */}
          <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <h3 className="text-lg font-semibold">Rebates Due — {periodLabel}</h3>
              <p className="text-sm text-muted-foreground">
                {summaries.length} configured customers • {sentCount} sent • {summaries.length - sentCount} outstanding
              </p>
            </div>
            <Badge className={cn("text-lg px-4 py-2", grandTotal >= 0 ? "bg-green-600" : "bg-red-600")}>
              Total: £{grandTotal.toFixed(2)}
            </Badge>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            {(["sent", "generated", "not_generated"] as RebateTrackingStatus[]).map((st) => (
              <div key={st} className="flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[st].dot)} />
                <span className="text-muted-foreground">{STATUS_META[st].label}</span>
              </div>
            ))}
          </div>

          {/* TOP: configured customers — single line each */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Configured customers ({summaries.length})
            </h4>
            {summaries.map((summary) => {
              const status = customerStatus(summary);
              const meta = STATUS_META[status];
              const isOpen = expanded.has(summary.customer.id);
              return (
                <Card key={summary.customer.id} className={cn("overflow-hidden border-l-4", meta.border)}>
                  <Collapsible open={isOpen} onOpenChange={() => toggle(summary.customer.id)}>
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <CollapsibleTrigger className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", meta.dot)} />
                        <span className="font-medium truncate">{summary.customer.customer_name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {summary.siteBreakdowns.length} site{summary.siteBreakdowns.length !== 1 ? "s" : ""} • {summary.totalWeight.toFixed(2)}t
                        </span>
                      </CollapsibleTrigger>
                      <Badge variant="outline" className={cn("shrink-0 text-xs", meta.badge)}>
                        {meta.label}
                      </Badge>
                      <span className={cn("font-semibold w-24 text-right shrink-0", summary.totalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                        £{summary.totalRebate.toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => setReportSummary(summary)}
                        title="View customer report"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => downloadBrandedReport(summary)}
                        disabled={downloadingId === summary.customer.id}
                        title="Download customer report (same file as emailed)"
                      >
                        {downloadingId === summary.customer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => downloadExcel(summary)} title="Download summary Excel">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => openBulkDialog(summary)}
                        disabled={sendingSiteId === summary.customer.id}
                        title={`Review & send emails to each site owner (${summary.siteBreakdowns.length})`}

                      >
                        {sendingSiteId === summary.customer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      </Button>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
                        {summary.siteBreakdowns.map((sb) => {
                          const siteTracking = tracking.get(trackingKey(summary.customer.id, trackSiteId(sb)));
                          const isSent = siteTracking?.status === "sent";
                          return (
                            <div key={sb.site.id} className="rounded-md border bg-background/60">
                              <div className="flex items-center justify-between text-sm px-3 py-2 border-b">
                                <span className="flex items-center gap-2 font-medium">
                                  {sb.site.site_name}
                                  {lockedSiteIds.has(sb.site.id) && (
                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300">
                                      <Lock className="h-2.5 w-2.5 mr-1" />
                                      Locked
                                    </Badge>
                                  )}
                                  <span className="text-muted-foreground font-normal">({sb.totalWeight.toFixed(2)}t)</span>
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={cn("font-medium", sb.totalRebate >= 0 ? "text-green-600" : "text-red-600")}>£{sb.totalRebate.toFixed(2)}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() => downloadBrandedReport(summary, sb)}
                                    disabled={downloadingId === sb.site.id}
                                    title={`Download the report for ${sb.site.site_name}`}
                                  >
                                    {downloadingId === sb.site.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                    Report
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 text-xs"
                                    onClick={() => openEmailDialog(summary, sb)}
                                    title={`Send rebate email for ${sb.site.site_name}`}
                                  >
                                    <Mail className="h-3 w-3" />
                                    {isSent ? "Resend" : "Send"}
                                  </Button>
                                </div>
                              </div>

                              {/* Value breakdown by material */}
                              {sb.materials.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="h-8 text-xs">Material</TableHead>
                                      <TableHead className="h-8 text-xs text-right">Weight (t)</TableHead>
                                      <TableHead className="h-8 text-xs text-right">Rate (£/t)</TableHead>
                                      <TableHead className="h-8 text-xs text-right">Rebate</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sb.materials.map((m, i) => (
                                      <TableRow key={`${sb.site.id}-${m.name}-${i}`} className="hover:bg-transparent">
                                        <TableCell className="py-1.5 text-xs">
                                          {m.name}
                                          <span className="text-muted-foreground ml-1 capitalize">· {m.source}</span>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs text-right">{m.weight.toFixed(2)}</TableCell>
                                        <TableCell className="py-1.5 text-xs text-right">£{m.rate.toFixed(2)}</TableCell>
                                        <TableCell className={cn("py-1.5 text-xs text-right font-medium", m.rebate >= 0 ? "text-green-600" : "text-red-600")}>£{m.rebate.toFixed(2)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="px-3 py-2 text-xs text-muted-foreground">No material breakdown available.</p>
                              )}

                              {/* Load-by-load breakdown */}
                              {sb.loads.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 border-t text-xs font-medium text-muted-foreground hover:text-foreground">
                                    <ChevronRight className="h-3 w-3" />
                                    Load breakdown ({sb.loads.length})
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                          <TableHead className="h-8 text-xs">Date</TableHead>
                                          <TableHead className="h-8 text-xs">Reference</TableHead>
                                          <TableHead className="h-8 text-xs">Source</TableHead>
                                          <TableHead className="h-8 text-xs">Description</TableHead>
                                          <TableHead className="h-8 text-xs text-right">Weight (t)</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {sb.loads.map((l, i) => (
                                          <TableRow key={`${sb.site.id}-load-${i}`} className="hover:bg-transparent">
                                            <TableCell className="py-1.5 text-xs">{l.date ? format(new Date(l.date), "dd/MM/yyyy") : "—"}</TableCell>
                                            <TableCell className="py-1.5 text-xs font-medium">{l.ref}</TableCell>
                                            <TableCell className="py-1.5 text-xs text-muted-foreground">{l.source}</TableCell>
                                            <TableCell className="py-1.5 text-xs">{l.description}</TableCell>
                                            <TableCell className="py-1.5 text-xs text-right">{l.weight.toFixed(2)}</TableCell>
                                          </TableRow>
                                        ))}
                                        <TableRow className="hover:bg-transparent font-medium">
                                          <TableCell className="py-1.5 text-xs" colSpan={4}>Total</TableCell>
                                          <TableCell className="py-1.5 text-xs text-right">
                                            {sb.loads.reduce((s, l) => s + l.weight, 0).toFixed(2)}
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}

                              {/* Sent details */}
                              {isSent && (
                                <div className="px-3 py-2 border-t bg-green-50/60 dark:bg-green-950/20 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                                  <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                                    <Mail className="h-3 w-3" /> Sent
                                  </span>
                                  {siteTracking?.recipient_email && (
                                    <span className="text-muted-foreground">To: <span className="text-foreground">{siteTracking.recipient_email}</span></span>
                                  )}
                                  {siteTracking?.sent_at && (
                                    <span className="text-muted-foreground">
                                      On: <span className="text-foreground">{format(new Date(siteTracking.sent_at), "d MMM yyyy 'at' HH:mm")}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
            {summaries.length === 0 && (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">No configured customers with rebates due for this period.</CardContent>
              </Card>
            )}
          </div>

          {/* BOTTOM: possibly due (not in customer setup) */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Possibly due — rebatable waste with no customer setup ({possiblyDue.length})
            </h4>
            <p className="text-xs text-muted-foreground">
              Waste removed this period that maps to a rebatable material, but the customer has no rebate configured in Customer Setup.
            </p>
            {possiblyDue.length > 0 ? (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Jobs</TableHead>
                      <TableHead className="text-right">Weight (t)</TableHead>
                      <TableHead>Waste streams</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {possiblyDue.map((p) => (
                      <TableRow key={`${p.customer}|${p.source}`}>
                        <TableCell className="font-medium">{p.customer}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{p.source}</TableCell>
                        <TableCell className="text-right">{p.totalJobs}</TableCell>
                        <TableCell className="text-right">{p.totalWeight.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.wasteTypes.map((w) => `${w.waste_description} (${w.total_weight.toFixed(2)}t)`).join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground text-sm">No un-configured rebatable waste found for this period.</CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Customer report dialog */}
      <Dialog open={!!reportSummary} onOpenChange={(o) => !o && setReportSummary(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reportSummary?.customer.customer_name} — Rebate Report</DialogTitle>
            <DialogDescription>{periodLabel}</DialogDescription>
          </DialogHeader>
          {reportSummary && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-4">
                <div className="rounded-lg border p-3 min-w-[140px]">
                  <p className="text-xs text-muted-foreground">Total weight</p>
                  <p className="text-lg font-semibold">{reportSummary.totalWeight.toFixed(2)} t</p>
                </div>
                <div className="rounded-lg border p-3 min-w-[140px]">
                  <p className="text-xs text-muted-foreground">Total rebate</p>
                  <p className={cn("text-lg font-semibold", reportSummary.totalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                    £{reportSummary.totalRebate.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border p-3 min-w-[140px]">
                  <p className="text-xs text-muted-foreground">Sites</p>
                  <p className="text-lg font-semibold">{reportSummary.siteBreakdowns.length}</p>
                </div>
              </div>

              {reportSummary.siteBreakdowns.map((sb) => (
                <div key={`rep-${sb.site.id}`} className="rounded-lg border">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                    <span className="font-medium text-sm">{sb.site.site_name}</span>
                    <span className="text-sm">
                      {sb.totalWeight.toFixed(2)}t •{" "}
                      <span className={cn("font-semibold", sb.totalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                        £{sb.totalRebate.toFixed(2)}
                      </span>
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-8 text-xs">Material</TableHead>
                        <TableHead className="h-8 text-xs text-right">Weight (t)</TableHead>
                        <TableHead className="h-8 text-xs text-right">Rate (£/t)</TableHead>
                        <TableHead className="h-8 text-xs text-right">Rebate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sb.materials.map((m, i) => (
                        <TableRow key={`rep-${sb.site.id}-m-${i}`} className="hover:bg-transparent">
                          <TableCell className="py-1.5 text-xs">{m.name}</TableCell>
                          <TableCell className="py-1.5 text-xs text-right">{m.weight.toFixed(2)}</TableCell>
                          <TableCell className="py-1.5 text-xs text-right">£{m.rate.toFixed(2)}</TableCell>
                          <TableCell className={cn("py-1.5 text-xs text-right font-medium", m.rebate >= 0 ? "text-green-600" : "text-red-600")}>
                            £{m.rebate.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {sb.loads.length > 0 && (
                    <div className="border-t">
                      <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">Loads ({sb.loads.length})</p>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-8 text-xs">Date</TableHead>
                            <TableHead className="h-8 text-xs">Reference</TableHead>
                            <TableHead className="h-8 text-xs">Source</TableHead>
                            <TableHead className="h-8 text-xs">Description</TableHead>
                            <TableHead className="h-8 text-xs text-right">Weight (t)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sb.loads.map((l, i) => (
                            <TableRow key={`rep-${sb.site.id}-l-${i}`} className="hover:bg-transparent">
                              <TableCell className="py-1.5 text-xs">{l.date ? format(new Date(l.date), "dd/MM/yyyy") : "—"}</TableCell>
                              <TableCell className="py-1.5 text-xs font-medium">{l.ref}</TableCell>
                              <TableCell className="py-1.5 text-xs text-muted-foreground">{l.source}</TableCell>
                              <TableCell className="py-1.5 text-xs">{l.description}</TableCell>
                              <TableCell className="py-1.5 text-xs text-right">{l.weight.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            {reportSummary && (
              <>
                <Button variant="outline" onClick={() => downloadExcel(reportSummary)}>
                  <Download className="h-4 w-4 mr-2" />
                  Summary Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadBrandedReport(reportSummary)}
                  disabled={downloadingId === reportSummary.customer.id}
                >
                  {downloadingId === reportSummary.customer.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                  )}
                  Download customer report
                </Button>
              </>
            )}
            <Button onClick={() => setReportSummary(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk review dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review rebate emails</DialogTitle>
            <DialogDescription>
              {bulkSummary?.customer.customer_name} — {periodLabel}. Check the recipient and copy for each site before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {bulkDrafts.map((draft, i) => (
              <div key={draft.sb.site.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 font-medium text-sm">
                    <input
                      type="checkbox"
                      checked={draft.include}
                      onChange={(e) => updateDraft(i, { include: e.target.checked })}
                    />
                    {draft.sb.site.site_name}
                  </label>
                  <span className="text-sm text-muted-foreground">£{draft.sb.totalRebate.toFixed(2)}</span>
                </div>
                {draft.include && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Recipient</Label>
                      <Input
                        type="email"
                        value={draft.recipient}
                        placeholder="customer@example.com"
                        onChange={(e) => updateDraft(i, { recipient: e.target.value })}
                      />
                      {!draft.recipient && <p className="text-xs text-destructive">No contact email found for this site.</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Subject</Label>
                      <Input value={draft.subject} onChange={(e) => updateDraft(i, { subject: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Message</Label>
                      <Textarea
                        value={draft.body}
                        rows={8}
                        className="font-mono text-xs"
                        onChange={(e) => updateDraft(i, { body: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSending}>Cancel</Button>
            <Button
              onClick={sendBulk}
              disabled={bulkSending || bulkDrafts.filter((d) => d.include && d.recipient).length === 0}
            >
              {bulkSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send {bulkDrafts.filter((d) => d.include && d.recipient).length} email(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email dialog */}

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Rebate Notification</DialogTitle>
            <DialogDescription>
              Notify the owner of {selectedSite?.site.site_name}
              {selectedCustomer ? ` (${selectedCustomer.customer.customer_name})` : ""} about their rebate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="v2-email-to">Recipient Email</Label>
              <Input id="v2-email-to" type="email" value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} placeholder="customer@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v2-email-subject">Subject</Label>
              <Input id="v2-email-subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v2-email-body">Message</Label>
              <Textarea id="v2-email-body" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={12} className="font-mono text-sm" />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <strong>Rebate Amount:</strong> £{selectedCustomer?.totalRebate.toFixed(2)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={sendRebateEmail} disabled={sendingEmail || !emailRecipient}>
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
