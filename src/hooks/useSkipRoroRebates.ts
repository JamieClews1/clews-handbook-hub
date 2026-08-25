 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
import { isMidweighRebateCustomer } from "@/lib/midweigh-rebates";
 import { format, startOfMonth, eachMonthOfInterval } from "date-fns";
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
  /** Bespoke £/tonne set on the job in the Data Hub; overrides the configured rate */
  rebate_rate_per_tonne?: number | null;
  /** Rate actually used for this job (bespoke or configured) */
  applied_rate_per_tonne?: number;
  // For Artic Curtain Side loads - weight from specific load report line item
  material_weight_t?: number;
  explicit_waste_filter_match?: boolean;
};
 
 export type SkipRoroMaterialSummary = {
   material_type: string;
   material_label: string;
   total_weight_tonnes: number;
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
  rebate_enabled: boolean;
  container_type_filter: string[] | null;
  waste_description_filter: string[] | null;
  effective_from: string | null;
  effective_to: string | null;
};

 // Normalise container/waste strings so "40yd" matches "40 yd Ro Ro" etc.
 const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
 
 const MATERIAL_LABELS: Record<string, string> = {
   card_loose: "Card Loose",
   scrap_metal: "Scrap Metal",
 };
 
const MATERIAL_TYPE_TO_WASTE_TYPES: Record<string, string[]> = {
  card_loose: ["Card Loose", "Card Bales", "Cardboard"],
  scrap_metal: ["Scrap Ferrous", "Scrap Non-Ferrous", "Scrap Metal"],
};
 
export function useSkipRoroRebates(
  siteId: string,
  dateRange: DateRange | undefined,
  siteDataHubMappings: string[],
  customerId?: string,
  dataHubCustomer?: string
) {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<SkipRoroMaterialSummary[]>([]);
  const [totalRebate, setTotalRebate] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);

  useEffect(() => {
    if ((siteId || customerId) && dateRange?.from) {
      loadData();
    } else {
      setSummaries([]);
      setTotalRebate(0);
      setTotalWeight(0);
      setLoading(false);
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
        
        skipConfigs = (siteConfigs ?? []) as SkipRebateConfig[];
      }
      
      // If no site configs and we have customerId, try customer-level config (for Midweigh data)
      if (skipConfigs.length === 0 && customerId) {
        const { data: customerConfigs } = await supabase
          .from("customer_skip_rebates")
          .select("material_type, value_type, value_type_item_id, set_value, adjustment, threshold_tonnes, rebate_enabled, container_type_filter, waste_description_filter, effective_from, effective_to")
          .eq("customer_id", customerId);
        
        skipConfigs = (customerConfigs ?? []) as SkipRebateConfig[];
      }

      if (skipConfigs.length === 0) {
        setSummaries([]);
        setTotalRebate(0);
        setTotalWeight(0);
        setLoading(false);
        return;
      }
 
       // 2. Get rebate mappings to filter jobs by valid waste descriptions
       const { data: rebateMappings } = await supabase
         .from("data_hub_rebate_mappings")
         .select("waste_description, material_type_id");
 
       const { data: loadWasteTypes } = await supabase
         .from("load_waste_types")
         .select("id, waste_type");
 
       const wasteDescriptionToMaterialCategory: Record<string, string> = {};
       
       for (const mapping of rebateMappings ?? []) {
         if (!mapping.material_type_id) continue;
         
         const wasteType = loadWasteTypes?.find(wt => wt.id === mapping.material_type_id);
         if (!wasteType) continue;
         
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

      // Midweigh weighbridge tickets only count for customers set up for them
      const midweighAllowed = await isMidweighRebateCustomer({ customerId, dataHubCustomer });
      const targetCategories = midweighAllowed
        ? ["Roll on Roll off", "Skips", "Midweigh", "Flat Bed pick up"]
        : ["Roll on Roll off", "Skips", "Flat Bed pick up"];
      
      let allJobs: JobRecord[] = [];
      
      // Query for each site mapping (for site-level data)
      for (const siteMapping of siteDataHubMappings) {
        if (!siteMapping) continue;
        
        const { data: jobs } = await supabase
          .from("data_hub_jobs")
          .select("id, job_number, source, customer, job_date, category, waste_description, weight_t, site, container_type, movement_type, job_type, linked_skip_job, rebate_rate_per_tonne")
          .eq("site", siteMapping)
          .gte("job_date", startDate)
          .lte("job_date", endDate)
          .in("category", targetCategories);

        if (jobs) {
          allJobs = [...allJobs, ...jobs.map(j => ({
            ...j,
            source: j.source ?? null,
            customer: j.customer ?? null,
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

      // Also query for Midweigh data where site is blank - match by customer name
      // Only do this when there are no site-specific mappings (i.e. customer-level "no site" report)
      if (midweighAllowed && dataHubCustomer && siteDataHubMappings.filter(Boolean).length === 0) {
        const { data: midweighJobs } = await supabase
          .from("data_hub_jobs")
          .select("id, job_number, source, job_date, category, waste_description, weight_t, site, customer, container_type, movement_type, job_type, linked_skip_job, rebate_rate_per_tonne")
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
            customer: (j as any).customer ?? null,
            job_date: j.job_date ?? "",
            category: j.category ?? "",
            waste_description: j.waste_description ?? null,
            weight_t: (j.category ?? "") === "Midweigh" ? (j.weight_t ?? 0) / 1000 : (j.weight_t ?? 0),
            site: (j as any).customer ?? "Midweigh",
            container_type: j.container_type ?? null,
            movement_type: j.movement_type ?? null,
            job_type: j.job_type ?? null,
          }));
          allJobs = [...allJobs, ...mappedJobs];
        }
      }

      // Site mode: some rebatable RoRo loads (e.g. Britvic plastic bottles) arrive
      // as standalone Midweigh weighbridge tickets with NO site, under a shared
      // customer (e.g. "Biffa Waste"). When a site rebate line has an explicit
      // waste-description filter, pull those blank-site Midweigh jobs for this
      // customer that match the filtered waste names. The waste filter is what
      // scopes them to THIS site (e.g. only Britvic's "Plastic Packaging").
      const wasteFilterNames = Array.from(
        new Set(
          skipConfigs
            .flatMap((c) => c.waste_description_filter ?? [])
            .map((n) => n.trim())
            .filter((n) => n.length > 0)
        )
      );
      if ((siteId || siteDataHubMappings.filter(Boolean).length > 0) && wasteFilterNames.length > 0) {
        const wasteFilterKeys = new Set(wasteFilterNames.map(normalise));
        let filteredMidweighQuery = supabase
          .from("data_hub_jobs")
          .select("id, job_number, source, job_date, category, waste_description, weight_t, site, customer, container_type, movement_type, job_type, linked_skip_job, rebate_rate_per_tonne")
          .or("site.is.null,site.eq.")
          .gte("job_date", startDate)
          .lte("job_date", endDate)
          .eq("category", "Midweigh");

        if (dataHubCustomer) {
          filteredMidweighQuery = filteredMidweighQuery.ilike("customer", `%${dataHubCustomer}%`);
        }

        const { data: filteredMidweigh } = await filteredMidweighQuery;

        if (filteredMidweigh) {
          const existingIds = new Set(allJobs.map((j) => j.id));
          let skiptrakCandidatesQuery = supabase
            .from("data_hub_jobs")
            .select("id, job_number, source, customer, job_date, category, waste_description, weight_t, site, container_type, movement_type, job_type, linked_skip_job, rebate_rate_per_tonne")
            .in("category", ["Roll on Roll off", "Skips"])
            .gte("job_date", startDate)
            .lte("job_date", endDate);

          const mappedSites = siteDataHubMappings.map((s) => s.trim()).filter(Boolean);
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
            .filter((j) => j.waste_description && wasteFilterKeys.has(normalise(j.waste_description)))
            .filter((j) => !existingIds.has(j.id))
            .map((j) => {
              const midweighWeightT = (j.weight_t ?? 0) / 1000;
              const matchKey = [
                j.job_date ?? "",
                normalise(j.waste_description ?? ""),
                normalise(j.container_type ?? ""),
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
                id: j.id,
                job_number: j.job_number,
                source: j.source ?? null,
                customer: (j as any).customer ?? null,
                job_date: j.job_date ?? "",
                category: j.category ?? "",
                waste_description: j.waste_description ?? null,
                weight_t: midweighWeightT,
                site: (j as any).customer ?? "Midweigh",
                container_type: j.container_type ?? null,
                movement_type: j.movement_type ?? null,
                job_type: j.job_type ?? null,
                explicit_waste_filter_match: true,
              };
            });
          // Always prefer the Skiptrak ticket over the Midweigh weighbridge
          // duplicate. Build keys from the Skiptrak (non-Midweigh) jobs already
          // loaded and drop any Midweigh mapped job that matches one of them, so
          // the report shows the Skiptrak job number rather than the Midweigh
          // ticket (e.g. Britvic plastic packaging shows 47814 not 81468).
          const skiptrakKeys = new Set(
            allJobs
              .filter((j) => j.category !== "Midweigh")
              .map((j) => [
                j.job_date,
                normalise(j.waste_description ?? ""),
                normalise(j.container_type ?? ""),
                (j.weight_t ?? 0).toFixed(2),
              ].join("|"))
          );
          const dedupedMidweigh = mappedJobs.filter((j) => {
            const key = [
              j.job_date,
              normalise(j.waste_description ?? ""),
              normalise(j.container_type ?? ""),
              (j.weight_t ?? 0).toFixed(2),
            ].join("|");
            return !skiptrakKeys.has(key);
          });
          allJobs = [...allJobs, ...dedupedMidweigh];

        }
      }

      // Authoritative de-dupe: a Midweigh weighbridge ticket that references a
      // Skiptrak job ("Skip job" column) is the same physical load. When that
      // Skiptrak job is already in this report, drop the Midweigh duplicate so
      // tonnage is never counted twice.
      {
        const skiptrakJobNumbers = new Set(
          allJobs
            .filter((j) => (j.source ?? "") !== "midweigh" && j.category !== "Midweigh")
            .map((j) => String(j.job_number).trim()),
        );
        if (skiptrakJobNumbers.size > 0) {
          allJobs = allJobs.filter((j) => {
            const linked = String((j as any).linked_skip_job ?? "").trim();
            if (!linked) return true;
            if ((j.source ?? "") !== "midweigh" && j.category !== "Midweigh") return true;
            return !skiptrakJobNumbers.has(linked);
          });
        }
      }

      // Apply exclusion rules to filter out unwanted jobs
      // Rule 1: Exclude Midweigh jobs with Job Type = "SKIP"
      // These are duplicate weighbridge records for Skiptrak jobs (e.g., Skiptrak 44788 = Midweigh 75756)
      if (excludeSkipJobType) {
        allJobs = allJobs.filter(j => {
          // Only apply to Midweigh category
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
          // Only apply to Skiptrak categories (Skips and Roll on Roll off)
          if (j.category !== "Skips" && j.category !== "Roll on Roll off") return true;
          const movementType = (j.movement_type ?? "").toLowerCase();
          return movementType !== "deliver" && movementType !== "delivery";
        });
      }

      // Final safeguard: never display/use a Midweigh ticket where the matching
      // Skiptrak job exists. Midweigh is only a fallback for blank-site rows;
      // customer reports must use the operational Skiptrak ticket number.
      const midweighRows = allJobs.filter((job) => job.category === "Midweigh");
      if (midweighRows.length > 0) {
        const mappedSites = siteDataHubMappings.map((site) => site.trim()).filter(Boolean);
        const candidateRowsById = new Map<string, any>();
        const baseCandidateQuery = () =>
          supabase
            .from("data_hub_jobs")
            .select("id, job_number, source, customer, job_date, category, waste_description, weight_t, site, container_type, movement_type, job_type, linked_skip_job, rebate_rate_per_tonne")
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
        // numbers being used in totals/exports when the Skiptrak job exists.
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

          // Build a map of job_number -> material_category -> weight in tonnes (actual weight after pallet deduction)
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
                const palletCount = li.pallet_count ?? 0;
                const palletWeightDeduction = noPalletsOnLoad ? 0 : (palletCount * defaultPalletWeightKg);
                const actualWeightKg = totalWeightKg - palletWeightDeduction;
                
                // Convert KG to tonnes and accumulate
                const weightT = actualWeightKg / 1000;
                loadReportWeights[jobNumber][materialCategory] = 
                  (loadReportWeights[jobNumber][materialCategory] ?? 0) + weightT;
              }
            }
          }
        }
      }

      // Attach material-specific weights to ALL jobs that have matching Load Reports
      allJobs = allJobs.map(job => {
        if (loadReportWeights[job.job_number]) {
          // Attach load report weights for later use
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
       const materialSummaries: SkipRoroMaterialSummary[] = [];
 
       for (const config of skipConfigs) {
         // Skip if rebate is disabled for this material
         if (!config.rebate_enabled) {
           materialSummaries.push({
             material_type: config.material_type,
             material_label: MATERIAL_LABELS[config.material_type] ?? config.material_type,
             total_weight_tonnes: 0,
             rate_per_tonne: 0,
             adjustment: 0,
             rebate_value: 0,
             rate_source: "Rebate disabled",
             jobs: [],
           });
           continue;
         }
 
          const wasteFilter = (config.waste_description_filter ?? []).filter((n) => n.trim().length > 0);
          const containerFilter = (config.container_type_filter ?? []).filter((n) => n.trim().length > 0);
          const effectiveFrom = config.effective_from ? config.effective_from.slice(0, 10) : null;
          const effectiveTo = config.effective_to ? config.effective_to.slice(0, 10) : null;

          const matchingJobs = allJobs.filter(job => {
            if (!job.waste_description) return false;

            // Effective date window: only count jobs on/after the start date
            // (and on/before the end date if set). Lets a rebate go live from a
            // specific date (e.g. Britvic plastic packaging from 24th May) without
            // touching earlier jobs or any other rebate line.
            const jobDay = (job.job_date ?? "").slice(0, 10);
            if (effectiveFrom && jobDay && jobDay < effectiveFrom) return false;
            if (effectiveTo && jobDay && jobDay > effectiveTo) return false;

            // Waste-description matching:
            // - If an explicit waste filter is configured on this line, match by it
            //   (precise per-site mapping, e.g. Britvic "Plastic Packaging").
            // - Otherwise fall back to the global material-category mapping.
            if (wasteFilter.length > 0) {
              const jobWaste = normalise(job.waste_description);
              const wasteMatches = wasteFilter.some((f) => normalise(f) === jobWaste);
              if (!wasteMatches) return false;
            } else {
              const mappedCategory = wasteDescriptionToMaterialCategory[job.waste_description];
              if (mappedCategory !== config.material_type) return false;
            }

            // Optional container-type filter (e.g. "40yd" matches "40 yd Ro Ro").
            if (containerFilter.length > 0) {
              const jobContainer = normalise(job.container_type ?? "");
              const containerMatches = containerFilter.some((f) => {
                const nf = normalise(f);
                return nf.length > 0 && jobContainer.includes(nf);
              });
              if (!containerMatches) return false;
            }

            return true;
          });


          const totalWeightVal = matchingJobs.reduce((sum, j) => sum + (j.weight_t ?? 0), 0);

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

          const adjustment = config.adjustment ?? 0;
          const adjustedRate = rate + adjustment;

          // Apply threshold PER JOB: only pay rebate on weight above threshold for each individual job
          const threshold = config.threshold_tonnes ?? 0;
          
          // Calculate per-job rebatable weight and rebate value
          // For Artic Curtain Side loads, use the material-specific weight from load_line_items
          const jobsWithRebates = matchingJobs.map(job => {
            // Check if this is an Artic Curtain Side job with load report weights
            const loadWeights = (job as any)._loadReportWeights as Record<string, number> | undefined;
            
            // Use material-specific weight if available (from load report), otherwise use total job weight
            let materialWeight: number;
            if (loadWeights && loadWeights[config.material_type] !== undefined) {
              materialWeight = loadWeights[config.material_type];
            } else {
              // For non-Artic jobs or Artic without load reports, use total job weight
              materialWeight = job.weight_t ?? 0;
            }
            
            const rebatableWeight = Math.max(0, materialWeight - threshold);
            const jobRebateValue = rebatableWeight * adjustedRate;
            
            return {
              ...job,
              material_weight_t: materialWeight,
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
            total_weight_tonnes: totalWeightVal,
            rate_per_tonne: adjustedRate,
            adjustment,
            rebate_value: rebateValue,
            rate_source: rateSource,
            jobs: jobsWithRebates.sort((a, b) => 
              new Date(b.job_date).getTime() - new Date(a.job_date).getTime()
            ),
          });
       }
 
       const totalRebateVal = materialSummaries.reduce((sum, s) => sum + s.rebate_value, 0);
       const totalWeightVal = materialSummaries.reduce((sum, s) => sum + s.total_weight_tonnes, 0);
 
       setSummaries(materialSummaries);
       setTotalRebate(totalRebateVal);
       setTotalWeight(totalWeightVal);
     } catch (error) {
       console.error("Error loading skip/roro rebate data:", error);
       setSummaries([]);
       setTotalRebate(0);
       setTotalWeight(0);
     } finally {
       setLoading(false);
     }
   };
 
   return { loading, summaries, totalRebate, totalWeight };
 }