import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { format, startOfMonth, eachMonthOfInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

type JobRecord = {
  id: string;
  job_number: string;
  job_date: string;
  source?: string | null;
  customer?: string | null;
  category: string;
  waste_description: string | null;
  weight_t: number;
  site: string;
  container_type?: string | null;
  movement_type?: string | null;
  job_type?: string | null;
  rebatable_weight?: number;
  job_rebate_value?: number;
  // For loads with matching Load Reports - weight from specific load report line item
  material_weight_t?: number;
  // Gross weight before pallet deduction (for display)
  gross_weight_t?: number;
  // Total pallet weight deducted (for display)
  pallet_weight_t?: number;
  explicit_waste_filter_match?: boolean;
};

type MaterialSummary = {
  material_type: string;
  material_label: string;
  total_weight_tonnes: number;
  rebatable_weight_tonnes: number;
  threshold_tonnes: number;
  rate_per_tonne: number;
  adjustment: number;
  rebate_value: number;
  rate_source: string;
  jobs: JobRecord[];
};

type SkipRebateConfig = {
  material_type: string;
  value_type: string;
  value_type_item_id: string | null;
  set_value: number | null;
  adjustment: number | null;
  threshold_tonnes: number | null;
  rebate_enabled: boolean | null;
  container_type_filter: string[] | null;
  waste_description_filter: string[] | null;
  effective_from: string | null;
  effective_to: string | null;
};

type RebateMapping = {
  waste_description: string;
  material_type_id: string | null;
};

type Props = {
  siteId: string;
  customerId?: string; // For customer-level rebates (Midweigh data)
  dateRange: DateRange | undefined;
  siteDataHubMappings: string[];
  dataHubCustomer?: string; // Customer name in data hub for Midweigh lookup
};

const MATERIAL_LABELS: Record<string, string> = {
  card_loose: "Card Loose",
  scrap_metal: "Scrap Metal",
};

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

// Map material_type to the expected load_waste_types material names
// These must match the waste_type values in load_waste_types table
const MATERIAL_TYPE_TO_WASTE_TYPES: Record<string, string[]> = {
  card_loose: ["Card Loose", "Card Bales", "Cardboard"],
  scrap_metal: ["Scrap Ferrous", "Scrap Non-Ferrous", "Scrap Metal"],
};

export function SkipRoroRebateTab({ siteId, customerId, dateRange, siteDataHubMappings, dataHubCustomer }: Props) {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<MaterialSummary[]>([]);
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());

  useEffect(() => {
    if ((siteId || customerId) && dateRange?.from) {
      loadData();
    }
  }, [siteId, customerId, dateRange, siteDataHubMappings.join(","), dataHubCustomer]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 0. Load rebate rules (exclusion settings)
      const { data: rebateRules } = await supabase
        .from("rebate_rules")
        .select("rule_key, is_enabled");
      
      const excludeSkipJobType = rebateRules?.find(r => r.rule_key === "exclude_skip_job_type")?.is_enabled ?? false;
      const excludeDeliverMovement = rebateRules?.find(r => r.rule_key === "exclude_deliver_movement")?.is_enabled ?? false;

      // 1. Get skip rebate config - either site-level or customer-level
      let skipConfigs: SkipRebateConfig[] = [];
      
      // Try site-level config first
      if (siteId) {
        const { data: siteConfigs } = await supabase
          .from("customer_site_skip_rebates")
          .select("material_type, value_type, value_type_item_id, set_value, adjustment, threshold_tonnes, rebate_enabled, container_type_filter, waste_description_filter, effective_from, effective_to")
          .eq("site_id", siteId);
        
        skipConfigs = (siteConfigs ?? []).filter(c => c.rebate_enabled !== false) as SkipRebateConfig[];
      }
      
      // If no site configs and we have customerId, try customer-level config (for Midweigh data)
      if (skipConfigs.length === 0 && customerId) {
        const { data: customerConfigs } = await supabase
          .from("customer_skip_rebates")
          .select("material_type, value_type, value_type_item_id, set_value, adjustment, threshold_tonnes, rebate_enabled, container_type_filter, waste_description_filter, effective_from, effective_to")
          .eq("customer_id", customerId);
        
        skipConfigs = (customerConfigs ?? []).filter((c: any) => c.rebate_enabled !== false) as SkipRebateConfig[];
      }

      if (skipConfigs.length === 0) {
        setSummaries([]);
        setLoading(false);
        return;
      }

      // 2. Get rebate mappings to filter jobs by valid waste descriptions
      const { data: rebateMappings } = await supabase
        .from("data_hub_rebate_mappings")
        .select("waste_description, material_type_id");

      // Get load_waste_types to map material_type_id to waste_type names
      const { data: loadWasteTypes } = await supabase
        .from("load_waste_types")
        .select("id, waste_type");

      // Build a map of waste_description -> material category (e.g., "scrap_metal", "card_loose")
      const wasteDescriptionToMaterialCategory: Record<string, string> = {};
      
      for (const mapping of rebateMappings ?? []) {
        if (!mapping.material_type_id) continue;
        
        const wasteType = loadWasteTypes?.find(wt => wt.id === mapping.material_type_id);
        if (!wasteType) continue;
        
        // Check which material category this waste type belongs to
        for (const [materialCategory, wasteTypeNames] of Object.entries(MATERIAL_TYPE_TO_WASTE_TYPES)) {
          if (wasteTypeNames.some(name => wasteType.waste_type.toLowerCase().includes(name.toLowerCase()))) {
            wasteDescriptionToMaterialCategory[mapping.waste_description] = materialCategory;
            break;
          }
        }
      }

      // 3. Get jobs from Performance Hub in date range
      const startDate = format(dateRange!.from!, "yyyy-MM-dd");
      const endDate = format(dateRange?.to ?? dateRange!.from!, "yyyy-MM-dd");

      // Filter by site mappings and categories (Roll on Roll off, Skips, Midweigh)
      const targetCategories = ["Roll on Roll off", "Skips", "Midweigh"];
      
      let allJobs: JobRecord[] = [];
      
      // Query for each site mapping (for site-level data)
      for (const siteMapping of siteDataHubMappings) {
        if (!siteMapping) continue;
        
        const { data: jobs } = await supabase
          .from("data_hub_jobs")
            .select("id, job_number, source, customer, job_date, category, waste_description, weight_t, site, container_type, movement_type, job_type")
          .eq("site", siteMapping)
          .gte("job_date", startDate)
          .lte("job_date", endDate)
          .in("category", targetCategories);

        if (jobs) {
          allJobs = [...allJobs, ...jobs.map(j => ({
            ...j,
            source: j.source ?? null,
            customer: (j as any).customer ?? null,
            weight_t: (j.category ?? "") === "Midweigh" ? (j.weight_t ?? 0) / 1000 : (j.weight_t ?? 0),
            job_date: j.job_date ?? "",
            waste_description: j.waste_description ?? null,
            category: j.category ?? "",
            site: j.site ?? "",
            container_type: j.container_type ?? null,
            movement_type: j.movement_type ?? null,
            job_type: j.job_type ?? null,
          }))];
        }
      }

      // Also query for Midweigh data where site is blank - match by customer name.
      // Only do the broad pull in customer-level mode; site-level reports use the
      // explicit waste-description filter below so a shared account (e.g. Biffa
      // Waste) cannot leak unrelated weighbridge tickets into one site.
      if (dataHubCustomer && siteDataHubMappings.filter(Boolean).length === 0) {
        const { data: midweighJobs } = await supabase
          .from("data_hub_jobs")
          .select("id, job_number, source, job_date, category, waste_description, weight_t, site, customer, container_type, movement_type, job_type")
          .ilike("customer", `%${dataHubCustomer}%`)
          .or("site.is.null,site.eq.")
          .gte("job_date", startDate)
          .lte("job_date", endDate)
          .eq("category", "Midweigh");

        if (midweighJobs) {
          const mappedJobs = midweighJobs.map(j => ({
            id: j.id,
            job_number: j.job_number,
            source: j.source ?? null,
            job_date: j.job_date ?? "",
            category: j.category ?? "",
            waste_description: j.waste_description ?? null,
            weight_t: (j.category ?? "") === "Midweigh" ? (j.weight_t ?? 0) / 1000 : (j.weight_t ?? 0),
            site: (j as any).customer ?? "Midweigh", // Show customer as "site" for display
            container_type: j.container_type ?? null,
            movement_type: j.movement_type ?? null,
            job_type: j.job_type ?? null,
          }));
          allJobs = [...allJobs, ...mappedJobs];
        }
      }

      const wasteFilterNames = Array.from(
        new Set(
          skipConfigs
            .flatMap((config) => config.waste_description_filter ?? [])
            .map((name) => name.trim())
            .filter((name) => name.length > 0)
        )
      );

      if ((siteId || siteDataHubMappings.filter(Boolean).length > 0) && wasteFilterNames.length > 0) {
        const wasteFilterKeys = new Set(wasteFilterNames.map(normalise));
        let filteredMidweighQuery = supabase
          .from("data_hub_jobs")
          .select("id, job_number, source, job_date, category, waste_description, weight_t, site, customer, container_type, movement_type, job_type")
          .or("site.is.null,site.eq.")
          .gte("job_date", startDate)
          .lte("job_date", endDate)
          .eq("category", "Midweigh");

        if (dataHubCustomer) {
          filteredMidweighQuery = filteredMidweighQuery.ilike("customer", `%${dataHubCustomer}%`);
        }

        const { data: filteredMidweigh } = await filteredMidweighQuery;

        if (filteredMidweigh) {
          const existingIds = new Set(allJobs.map((job) => job.id));
          let skiptrakCandidatesQuery = supabase
            .from("data_hub_jobs")
            .select("id, job_number, source, job_date, category, waste_description, weight_t, site, customer, container_type, movement_type, job_type")
            .in("category", ["Roll on Roll off", "Skips"])
            .gte("job_date", startDate)
            .lte("job_date", endDate);

          const mappedSites = siteDataHubMappings.map((site) => site.trim()).filter(Boolean);
          if (mappedSites.length > 0) {
            skiptrakCandidatesQuery = skiptrakCandidatesQuery.in("site", mappedSites);
          } else if (dataHubCustomer) {
            skiptrakCandidatesQuery = skiptrakCandidatesQuery.ilike("customer", `%${dataHubCustomer}%`);
          }

          const { data: skiptrakCandidates } = await skiptrakCandidatesQuery;
          const skiptrakByMatchKey = new Map<string, any>();
          for (const candidate of skiptrakCandidates ?? []) {
            if (!candidate.waste_description || !wasteFilterKeys.has(normalise(candidate.waste_description))) continue;
            const key = [
              candidate.job_date ?? "",
              normalise(candidate.waste_description ?? ""),
              normalise(candidate.container_type ?? ""),
              (candidate.weight_t ?? 0).toFixed(2),
            ].join("|");
            if (!skiptrakByMatchKey.has(key)) {
              skiptrakByMatchKey.set(key, candidate);
            }
          }

          const mappedJobs = filteredMidweigh
            .filter((job) => job.waste_description && wasteFilterKeys.has(normalise(job.waste_description)))
            .filter((job) => !existingIds.has(job.id))
            .map((job) => {
              const midweighWeightT = (job.weight_t ?? 0) / 1000;
              const matchKey = [
                job.job_date ?? "",
                normalise(job.waste_description ?? ""),
                normalise(job.container_type ?? ""),
                midweighWeightT.toFixed(2),
              ].join("|");
              const skiptrakMatch = skiptrakByMatchKey.get(matchKey);

              if (skiptrakMatch) {
                return {
                  id: skiptrakMatch.id,
                  job_number: skiptrakMatch.job_number,
                  source: skiptrakMatch.source ?? "skiptrak",
                  customer: skiptrakMatch.customer ?? null,
                  job_date: skiptrakMatch.job_date ?? "",
                  category: skiptrakMatch.category ?? "",
                  waste_description: skiptrakMatch.waste_description ?? null,
                  weight_t: skiptrakMatch.weight_t ?? midweighWeightT,
                  site: skiptrakMatch.site ?? "",
                  container_type: skiptrakMatch.container_type ?? null,
                  movement_type: skiptrakMatch.movement_type ?? null,
                  job_type: skiptrakMatch.job_type ?? null,
                  explicit_waste_filter_match: true,
                };
              }

              return {
                id: job.id,
                job_number: job.job_number,
                source: job.source ?? null,
                customer: (job as any).customer ?? null,
                job_date: job.job_date ?? "",
                category: job.category ?? "",
                waste_description: job.waste_description ?? null,
                weight_t: midweighWeightT,
                site: (job as any).customer ?? "Midweigh",
                container_type: job.container_type ?? null,
                movement_type: job.movement_type ?? null,
                job_type: job.job_type ?? null,
                explicit_waste_filter_match: true,
              };
            });
          const skiptrakKeys = new Set(
            allJobs
              .filter((job) => job.category !== "Midweigh")
              .map((job) => [
              job.job_date,
              normalise(job.waste_description ?? ""),
              normalise(job.container_type ?? ""),
              (job.weight_t ?? 0).toFixed(2),
            ].join("|"))
          );
          const dedupedMidweigh = mappedJobs.filter((job) => {
            const key = [
              job.job_date,
              normalise(job.waste_description ?? ""),
              normalise(job.container_type ?? ""),
              (job.weight_t ?? 0).toFixed(2),
            ].join("|");
            return !skiptrakKeys.has(key);
          });
          allJobs = [...allJobs, ...dedupedMidweigh];
        }
      }

      // Apply exclusion rules to filter out unwanted jobs
      // Rule 1: Exclude Midweigh jobs with Job Type = "SKIP"
      // These are duplicate weighbridge records for Skiptrak jobs
      if (excludeSkipJobType) {
        allJobs = allJobs.filter(j => {
          if (j.category !== "Midweigh") return true;
          if (j.explicit_waste_filter_match) return true;
          const jobType = (j.job_type ?? "").toUpperCase();
          return jobType !== "SKIP";
        });
      }
      
      // Rule 2: Exclude Skiptrak "Deliver" jobs (Skips & Roll on Roll off categories)
      // These are empty container deliveries with zero weight - no rebate applies
      if (excludeDeliverMovement) {
        allJobs = allJobs.filter(j => {
          if (j.category !== "Skips" && j.category !== "Roll on Roll off") return true;
          const movementType = (j.movement_type ?? "").toLowerCase();
          return movementType !== "deliver" && movementType !== "delivery";
        });
      }

      // Final safeguard: never display a Midweigh ticket where the matching
      // Skiptrak job exists. The explicit Midweigh pull is only a fallback for
      // blank-site weighbridge rows; the customer-facing report must use the
      // operational Skiptrak ticket number (e.g. 47815, not 81781).
      const midweighRows = allJobs.filter((job) => job.category === "Midweigh");
      if (midweighRows.length > 0) {
        const mappedSites = siteDataHubMappings.map((site) => site.trim()).filter(Boolean);
        const candidateRowsById = new Map<string, any>();
        const baseCandidateQuery = () =>
          supabase
            .from("data_hub_jobs")
            .select("id, job_number, source, customer, job_date, category, waste_description, weight_t, site, container_type, movement_type, job_type")
            .in("category", ["Roll on Roll off", "Skips"])
            .gte("job_date", startDate)
            .lte("job_date", endDate);

        if (mappedSites.length > 0) {
          const { data } = await baseCandidateQuery().in("site", mappedSites);
          for (const row of data ?? []) candidateRowsById.set(row.id, row);
        }

        if (dataHubCustomer) {
          const { data } = await baseCandidateQuery().ilike("customer", `%${dataHubCustomer}%`);
          for (const row of data ?? []) candidateRowsById.set(row.id, row);
        }

        // Last-resort broad pull by waste description. Some Skiptrak site names
        // are not an exact string match to the saved site mapping, but the
        // duplicate Midweigh ticket still has the same date/waste/container/weight.
        // Pulling the matching waste descriptions prevents those Midweigh ticket
        // numbers being shown when the Skiptrak job exists.
        const midweighWasteDescriptions = Array.from(
          new Set(
            midweighRows
              .map((job) => job.waste_description?.trim())
              .filter((waste): waste is string => !!waste)
          )
        );
        if (midweighWasteDescriptions.length > 0) {
          const { data } = await baseCandidateQuery().in("waste_description", midweighWasteDescriptions);
          for (const row of data ?? []) candidateRowsById.set(row.id, row);
        }

        if (candidateRowsById.size === 0 && mappedSites.length === 0 && !dataHubCustomer) {
          const { data } = await baseCandidateQuery();
          for (const row of data ?? []) candidateRowsById.set(row.id, row);
        }

        const candidates = Array.from(candidateRowsById.values()).filter((candidate) => {
          const candidateWaste = normalise(candidate.waste_description ?? "");
          return midweighRows.some((job) => normalise(job.waste_description ?? "") === candidateWaste);
        });

        const exactMaps = [new Map<string, any>(), new Map<string, any>(), new Map<string, any>()];
        const dateWasteBuckets = new Map<string, any[]>();
        const keyParts = (job: { job_date?: string | null; waste_description?: string | null; container_type?: string | null; weight_t?: number | null }) => ({
          date: (job.job_date ?? "").slice(0, 10),
          waste: normalise(job.waste_description ?? ""),
          container: normalise(job.container_type ?? ""),
          weight: Number(job.weight_t ?? 0),
        });
        const keysFor = (job: typeof candidates[number]) => {
          const parts = keyParts(job);
          const weightKey = parts.weight > 0 ? parts.weight.toFixed(2) : "";
          return [
            weightKey ? `${parts.date}|${parts.waste}|${parts.container}|${weightKey}` : "",
            weightKey ? `${parts.date}|${parts.waste}|${weightKey}` : "",
            `${parts.date}|${parts.waste}|${parts.container}`,
          ];
        };

        for (const candidate of candidates) {
          keysFor(candidate).forEach((key, index) => {
            if (key && !exactMaps[index].has(key)) exactMaps[index].set(key, candidate);
          });
          const { date, waste } = keyParts(candidate);
          const dateWasteKey = `${date}|${waste}`;
          dateWasteBuckets.set(dateWasteKey, [...(dateWasteBuckets.get(dateWasteKey) ?? []), candidate]);
        }

        const findSkiptrakMatch = (job: JobRecord) => {
          const parts = keyParts(job);
          const weightKey = parts.weight > 0 ? parts.weight.toFixed(2) : "";
          const possibleKeys = [
            weightKey ? `${parts.date}|${parts.waste}|${parts.container}|${weightKey}` : "",
            weightKey ? `${parts.date}|${parts.waste}|${weightKey}` : "",
            `${parts.date}|${parts.waste}|${parts.container}`,
          ];

          for (let index = 0; index < possibleKeys.length; index += 1) {
            const key = possibleKeys[index];
            if (key && exactMaps[index].has(key)) return exactMaps[index].get(key);
          }

          const bucket = dateWasteBuckets.get(`${parts.date}|${parts.waste}`) ?? [];
          return bucket.length === 1 ? bucket[0] : null;
        };

        const replacedJobs = allJobs.map((job) => {
          if (job.category !== "Midweigh") return job;
          const skiptrakMatch = findSkiptrakMatch(job);
          if (!skiptrakMatch) return job;

          return {
            ...job,
            id: skiptrakMatch.id,
            job_number: skiptrakMatch.job_number,
            source: skiptrakMatch.source ?? "skiptrak",
            customer: skiptrakMatch.customer ?? job.customer ?? null,
            job_date: skiptrakMatch.job_date ?? job.job_date,
            category: skiptrakMatch.category ?? "Roll on Roll off",
            waste_description: skiptrakMatch.waste_description ?? job.waste_description,
            weight_t: skiptrakMatch.weight_t ?? job.weight_t ?? 0,
            site: skiptrakMatch.site ?? job.site,
            container_type: skiptrakMatch.container_type ?? job.container_type ?? null,
            movement_type: skiptrakMatch.movement_type ?? job.movement_type ?? null,
            job_type: skiptrakMatch.job_type ?? job.job_type ?? null,
            explicit_waste_filter_match: job.explicit_waste_filter_match,
          };
        });

        const preferredById = new Map<string, JobRecord>();
        for (const job of replacedJobs) {
          const existing = preferredById.get(job.id);
          if (!existing) {
            preferredById.set(job.id, job);
            continue;
          }

          const existingWeight = existing.weight_t ?? 0;
          const jobWeight = job.weight_t ?? 0;
          if (existing.category === "Midweigh" || (existingWeight === 0 && jobWeight > 0)) {
            preferredById.set(job.id, job);
          }
        }
        allJobs = Array.from(preferredById.values());
      }

      // 4a. Get material-specific weights from load_line_items for jobs with matching Load Reports
      // Load Reports store job numbers in the 'notes' field
      // This applies to ALL jobs that have a corresponding Load Report (not just Artic Curtain Side)
      const allJobNumbers = allJobs.map(j => j.job_number);
      
      // Map load_waste_types to material categories
      const wasteTypeToMaterialCategory: Record<string, string> = {};
      for (const wt of loadWasteTypes ?? []) {
        for (const [materialCategory, wasteTypeNames] of Object.entries(MATERIAL_TYPE_TO_WASTE_TYPES)) {
          if (wasteTypeNames.some(name => wt.waste_type.toLowerCase().includes(name.toLowerCase()))) {
            wasteTypeToMaterialCategory[wt.waste_type] = materialCategory;
            break;
          }
        }
      }

      // Fetch load reports that match ANY job numbers (stored in notes field)
      // Also fetch no_pallets_on_load flag to calculate actual weight after pallet deduction
      let loadReportWeights: Record<string, Record<string, number>> = {}; // job_number -> material_category -> weight_t
      
      if (allJobNumbers.length > 0) {
        const { data: loadReports } = await supabase
          .from("load_reports")
          .select("id, notes, no_pallets_on_load")
          .in("notes", allJobNumbers)
          .eq("exclude_from_rebate", false);

        if (loadReports && loadReports.length > 0) {
          const loadReportIds = loadReports.map(lr => lr.id);
          
          // Fetch line items with pallet counts to calculate actual weight
          const { data: lineItems } = await supabase
            .from("load_line_items")
            .select("load_report_id, waste_type, total_weight_kg, pallet_count")
            .in("load_report_id", loadReportIds)
            .gt("total_weight_kg", 0); // Only items with weight

          // Fetch default pallet weight
          const { data: palletWeightSetting } = await supabase
            .from("load_report_settings")
            .select("setting_value")
            .eq("setting_key", "default_pallet_weight_kg")
            .single();
          
          const defaultPalletWeightKg = palletWeightSetting ? Number(palletWeightSetting.setting_value) || 20 : 20;

          // Build a map of job_number -> material_category -> { net, gross, palletWeight } in tonnes
          for (const lr of loadReports) {
            const jobNumber = lr.notes;
            if (!jobNumber) continue;
            
            const noPalletsOnLoad = (lr as any).no_pallets_on_load ?? false;
            const jobLineItems = lineItems?.filter(li => li.load_report_id === lr.id) ?? [];
            loadReportWeights[jobNumber] = {};
            
            for (const li of jobLineItems) {
              const materialCategory = wasteTypeToMaterialCategory[li.waste_type];
              if (materialCategory) {
                // Calculate actual weight: total weight minus pallet weight (unless no pallets on load)
                const totalWeightKg = li.total_weight_kg ?? 0;
                const palletCount = (li as any).pallet_count ?? 0;
                const palletWeightDeduction = noPalletsOnLoad ? 0 : (palletCount * defaultPalletWeightKg);
                const actualWeightKg = totalWeightKg - palletWeightDeduction;
                
                // Convert KG to tonnes and store with breakdown
                const grossT = totalWeightKg / 1000;
                const palletT = palletWeightDeduction / 1000;
                const netT = actualWeightKg / 1000;
                
                // Store with breakdown info (we store as object with net, gross, pallet)
                const existing = loadReportWeights[jobNumber][materialCategory] as any;
                if (existing && typeof existing === 'object') {
                  existing.net += netT;
                  existing.gross += grossT;
                  existing.pallet += palletT;
                } else {
                  loadReportWeights[jobNumber][materialCategory] = { net: netT, gross: grossT, pallet: palletT } as any;
                }
              }
            }
          }
        }
      }

      // Attach material-specific weights to ALL jobs that have matching Load Reports
      allJobs = allJobs.map(job => {
        if (loadReportWeights[job.job_number]) {
          // Attach load report weights as hidden property for later use
          return { ...job, _loadReportWeights: loadReportWeights[job.job_number] };
        }
        return job;
      });

      // 4. Get monthly values for rate calculation
      const rangeStart = dateRange!.from!;
      const rangeEnd = dateRange?.to ?? rangeStart;
      const monthsInRange = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
      const monthStarts = monthsInRange.map(m => format(startOfMonth(m), "yyyy-MM-dd"));

      const valueTypeItemIds = skipConfigs
        .map(c => c.value_type_item_id)
        .filter((id): id is string => id !== null);

      let monthlyValueMap: Record<string, { lower: number; higher: number }> = {};

      if (valueTypeItemIds.length > 0) {
        const { data: monthlyValues } = await supabase
          .from("rebate_monthly_values")
          .select("item_id, lower_range, higher_range, month_start")
          .in("item_id", valueTypeItemIds)
          .in("month_start", monthStarts);

        // Average values across months
        const accumulator: Record<string, { lowerSum: number; higherSum: number; count: number }> = {};
        for (const mv of monthlyValues ?? []) {
          if (!accumulator[mv.item_id]) {
            accumulator[mv.item_id] = { lowerSum: 0, higherSum: 0, count: 0 };
          }
          accumulator[mv.item_id].lowerSum += mv.lower_range ?? 0;
          accumulator[mv.item_id].higherSum += mv.higher_range ?? 0;
          accumulator[mv.item_id].count += 1;
        }

        for (const [itemId, acc] of Object.entries(accumulator)) {
          monthlyValueMap[itemId] = {
            lower: acc.count > 0 ? acc.lowerSum / acc.count : 0,
            higher: acc.count > 0 ? acc.higherSum / acc.count : 0,
          };
        }
      }

      // 5. Get rebate item names for rate source display
      const { data: rebateItems } = await supabase
        .from("rebate_items")
        .select("id, name")
        .in("id", valueTypeItemIds);

      const rebateItemNames: Record<string, string> = {};
      for (const ri of rebateItems ?? []) {
        rebateItemNames[ri.id] = ri.name;
      }

      // 6. Build summaries per material type
      const materialSummaries: MaterialSummary[] = [];

      for (const config of skipConfigs) {
        // Skip if rebate is disabled for this material
        if (config.rebate_enabled === false) {
          continue;
        }
        
        const wasteFilter = (config.waste_description_filter ?? []).filter((name) => name.trim().length > 0);
        const containerFilter = (config.container_type_filter ?? []).filter((name) => name.trim().length > 0);
        const effectiveFrom = config.effective_from ? config.effective_from.slice(0, 10) : null;
        const effectiveTo = config.effective_to ? config.effective_to.slice(0, 10) : null;

        const matchingJobs = allJobs.filter(job => {
          if (!job.waste_description) return false;

          const jobDay = (job.job_date ?? "").slice(0, 10);
          if (effectiveFrom && jobDay && jobDay < effectiveFrom) return false;
          if (effectiveTo && jobDay && jobDay > effectiveTo) return false;

          if (wasteFilter.length > 0) {
            const jobWaste = normalise(job.waste_description);
            if (!wasteFilter.some((filter) => normalise(filter) === jobWaste)) return false;
          } else {
            const mappedCategory = wasteDescriptionToMaterialCategory[job.waste_description];
            if (mappedCategory !== config.material_type) return false;
          }

          if (containerFilter.length > 0) {
            const jobContainer = normalise(job.container_type ?? "");
            if (!containerFilter.some((filter) => jobContainer.includes(normalise(filter)))) return false;
          }

          return true;
        });

        const totalWeight = matchingJobs.reduce((sum, j) => sum + (j.weight_t ?? 0), 0);

        // Calculate rate
        let rate = 0;
        let rateSource = "Not configured";

        if (config.value_type === "set" && config.set_value !== null) {
          rate = config.set_value;
          rateSource = "Custom";
        } else if (config.value_type_item_id) {
          const monthVal = monthlyValueMap[config.value_type_item_id];
          const itemName = rebateItemNames[config.value_type_item_id] ?? "Unknown";
          if (monthVal) {
            rate = config.value_type === "higher" ? monthVal.higher : monthVal.lower;
            rateSource = `${itemName} (${config.value_type})`;
          } else {
            rateSource = `${itemName} - No monthly value`;
          }
        }

        // Apply adjustment
        const adjustment = config.adjustment ?? 0;
        const adjustedRate = rate + adjustment;
      
        // Apply threshold PER JOB: only pay rebate on weight above threshold for each individual job
        const threshold = config.threshold_tonnes ?? 0;
        
        // Calculate per-job rebatable weight and rebate value
        // For Artic Curtain Side loads, use the material-specific weight from load_line_items
        const jobsWithRebates = matchingJobs.map(job => {
          // Check if this job has load report weights with breakdown
          const loadWeights = (job as any)._loadReportWeights as Record<string, any> | undefined;
          
          // Use material-specific weight if available (from load report), otherwise use total job weight
          let materialWeight: number;
          let grossWeight: number | undefined;
          let palletWeight: number | undefined;
          
          if (loadWeights && loadWeights[config.material_type] !== undefined) {
            const breakdown = loadWeights[config.material_type];
            if (typeof breakdown === 'object' && breakdown.net !== undefined) {
              materialWeight = breakdown.net;
              grossWeight = breakdown.gross;
              palletWeight = breakdown.pallet;
            } else {
              materialWeight = breakdown as number;
            }
          } else {
            // For jobs without load reports, use total job weight (no pallet breakdown)
            materialWeight = job.weight_t ?? 0;
          }
          
          const rebatableWeight = Math.max(0, materialWeight - threshold);
          const jobRebateValue = rebatableWeight * adjustedRate;
          
          return {
            ...job,
            material_weight_t: materialWeight,
            gross_weight_t: grossWeight,
            pallet_weight_t: palletWeight,
            weight_t: job.weight_t, // Keep original total weight for display
            rebatable_weight: rebatableWeight,
            job_rebate_value: jobRebateValue,
          };
        });

        const totalRebatableWeight = jobsWithRebates.reduce((sum, j) => sum + (j.rebatable_weight ?? 0), 0);
        const rebateValue = jobsWithRebates.reduce((sum, j) => sum + (j.job_rebate_value ?? 0), 0);

        materialSummaries.push({
          material_type: config.material_type,
          material_label: MATERIAL_LABELS[config.material_type] ?? config.material_type,
          total_weight_tonnes: totalWeight,
          rebatable_weight_tonnes: totalRebatableWeight,
          threshold_tonnes: threshold,
          rate_per_tonne: adjustedRate,
          adjustment,
          rebate_value: rebateValue,
          rate_source: rateSource,
          jobs: jobsWithRebates.sort((a, b) => 
            new Date(b.job_date).getTime() - new Date(a.job_date).getTime()
          ),
        });
      }

      setSummaries(materialSummaries);
    } catch (error) {
      console.error("Error loading skip/roro rebate data:", error);
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleMaterial = (materialType: string) => {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      if (next.has(materialType)) {
        next.delete(materialType);
      } else {
        next.add(materialType);
      }
      return next;
    });
  };

  const totalRebate = summaries.reduce((sum, s) => sum + s.rebate_value, 0);
  const totalWeight = summaries.reduce((sum, s) => sum + s.total_weight_tonnes, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading RoRo/Skip data...</span>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <p>No Skip/RoRo rebate configuration found for this site.</p>
        <p className="text-sm mt-2">
          Configure materials in Customer Setup → Skip/RoRo Rebates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <p className="text-sm text-muted-foreground">
          RoRo = Category "Roll on Roll off" • Skip = Category "Skips"
        </p>
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-sm">
            {totalWeight.toFixed(2)} tonnes
          </Badge>
          <Badge variant="default" className={cn("text-sm", totalRebate >= 0 ? "bg-green-600" : "bg-red-600")}>
            £{totalRebate.toFixed(2)}
          </Badge>
        </div>
      </div>

      {/* Materials Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Weight (t)</TableHead>
                <TableHead className="text-right">Rebatable (t)</TableHead>
              <TableHead className="text-right">Rate (£/t)</TableHead>
              <TableHead>Rate Source</TableHead>
              <TableHead className="text-right">Value (£)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((summary) => (
              <>
                <TableRow 
                  key={summary.material_type}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleMaterial(summary.material_type)}
                >
                  <TableCell className="w-8">
                    {expandedMaterials.has(summary.material_type) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {summary.material_label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({summary.jobs.length} jobs)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{summary.total_weight_tonnes.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {summary.rebatable_weight_tonnes.toFixed(2)}
                    {summary.threshold_tonnes > 0 && (
                      <span className="ml-1 text-xs text-amber-600">
                        (after {summary.threshold_tonnes}t threshold)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {summary.rate_per_tonne !== 0 ? `£${summary.rate_per_tonne.toFixed(2)}` : "-"}
                    {summary.adjustment !== 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({summary.adjustment > 0 ? "+" : ""}{summary.adjustment.toFixed(2)} adj)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{summary.rate_source}</span>
                  </TableCell>
                  <TableCell className={cn("text-right font-medium", summary.rebate_value >= 0 ? "text-green-600" : "text-red-600")}>
                    £{summary.rebate_value.toFixed(2)}
                  </TableCell>
                </TableRow>

                {/* Expanded job details */}
                {expandedMaterials.has(summary.material_type) && summary.jobs.length > 0 && (
                  <TableRow key={`${summary.material_type}-jobs`}>
                    <TableCell colSpan={7} className="p-0 bg-muted/30">
                      <div className="p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Job No.</TableHead>
                              <TableHead>Site</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Gross Weight (t)</TableHead>
                              <TableHead className="text-right">Pallet Weight (t)</TableHead>
                              <TableHead className="text-right">Actual Recyclable (t)</TableHead>
                              <TableHead className="text-right">Rate (£/t)</TableHead>
                              <TableHead className="text-right">Rebate (£)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summary.jobs.map((job) => {
                              const jobRebate = job.job_rebate_value ?? 0;
                              const rebatableWeight = job.rebatable_weight ?? 0;
                              const isBelowThreshold = summary.threshold_tonnes > 0 && rebatableWeight === 0;
                              
                              // Determine gross, pallet, and net weights
                              const hasLoadReportData = job.gross_weight_t !== undefined;
                              const grossWeight = hasLoadReportData ? job.gross_weight_t! : job.weight_t;
                              const palletWeight = hasLoadReportData ? (job.pallet_weight_t ?? 0) : 0;
                              const netWeight = job.material_weight_t !== undefined ? job.material_weight_t : job.weight_t;
                              
                              return (
                                <TableRow key={job.id} className={isBelowThreshold ? "bg-amber-50/50" : ""}>
                                  <TableCell>
                                    {job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "-"}
                                  </TableCell>
                                  <TableCell className="font-medium">{job.job_number}</TableCell>
                                  <TableCell>{job.site}</TableCell>
                                  <TableCell>{job.waste_description || "-"}</TableCell>
                                  <TableCell className="text-right">
                                    {grossWeight.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right text-red-600">
                                    {palletWeight > 0 ? `-${palletWeight.toFixed(2)}` : "-"}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {netWeight.toFixed(2)}
                                    {isBelowThreshold && (
                                      <span className="ml-1 text-xs text-amber-600">(below threshold)</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    £{summary.rate_per_tonne.toFixed(2)}
                                  </TableCell>
                                  <TableCell className={cn("text-right font-medium", jobRebate >= 0 ? "text-green-600" : "text-red-600")}>
                                    £{jobRebate.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}

            {/* Totals row */}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell></TableCell>
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{totalWeight.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  {summaries.reduce((sum, s) => sum + s.rebatable_weight_tonnes, 0).toFixed(2)}
                </TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell className={cn("text-right", totalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                £{totalRebate.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">Data Source:</p>
        <p>
          Jobs are pulled from Performance Hub data matching "Roll on Roll off" and "Skips" categories
          for sites mapped to this customer. Rates are from the Skip/RoRo rebate configuration.
        </p>
      </div>
    </div>
  );
}
