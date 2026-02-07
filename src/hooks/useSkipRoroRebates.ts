 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { format, startOfMonth, eachMonthOfInterval } from "date-fns";
 import { DateRange } from "react-day-picker";
 
type JobRecord = {
  id: string;
  job_number: string;
  job_date: string;
  category: string;
  waste_description: string | null;
  weight_t: number;
  site: string;
  container_type?: string | null;
  movement_type?: string | null;
  job_type?: string | null;
  rebatable_weight?: number;
  job_rebate_value?: number;
  // For Artic Curtain Side loads - weight from specific load report line item
  material_weight_t?: number;
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
 };
 
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
          .select("material_type, value_type, value_type_item_id, set_value, adjustment, threshold_tonnes, rebate_enabled")
          .eq("site_id", siteId);
        
        skipConfigs = (siteConfigs ?? []) as SkipRebateConfig[];
      }
      
      // If no site configs and we have customerId, try customer-level config (for Midweigh data)
      if (skipConfigs.length === 0 && customerId) {
        const { data: customerConfigs } = await supabase
          .from("customer_skip_rebates")
          .select("material_type, value_type, value_type_item_id, set_value, adjustment, threshold_tonnes, rebate_enabled")
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

      const targetCategories = ["Roll on Roll off", "Skips", "Midweigh"];
      
      let allJobs: JobRecord[] = [];
      
      // Query for each site mapping (for site-level data)
      for (const siteMapping of siteDataHubMappings) {
        if (!siteMapping) continue;
        
        const { data: jobs } = await supabase
          .from("data_hub_jobs")
          .select("id, job_number, job_date, category, waste_description, weight_t, site, container_type, movement_type, job_type")
          .eq("site", siteMapping)
          .gte("job_date", startDate)
          .lte("job_date", endDate)
          .in("category", targetCategories);

        if (jobs) {
          allJobs = [...allJobs, ...jobs.map(j => ({
            ...j,
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
      if (dataHubCustomer) {
        const { data: midweighJobs } = await supabase
          .from("data_hub_jobs")
          .select("id, job_number, job_date, category, waste_description, weight_t, site, customer, container_type, movement_type, job_type")
          .eq("customer", dataHubCustomer)
          .or("site.is.null,site.eq.")
          .gte("job_date", startDate)
          .lte("job_date", endDate)
          .eq("category", "Midweigh");

        if (midweighJobs) {
          const mappedJobs = midweighJobs.map(j => ({
            id: j.id,
            job_number: j.job_number,
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

      // Apply exclusion rules to filter out unwanted jobs
      // Rule 1: Exclude Midweigh jobs with Job Type = "SKIP"
      // These are duplicate weighbridge records for Skiptrak jobs (e.g., Skiptrak 44788 = Midweigh 75756)
      if (excludeSkipJobType) {
        allJobs = allJobs.filter(j => {
          // Only apply to Midweigh category
          if (j.category !== "Midweigh") return true;
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

      // 4a. For Artic Curtain Side jobs, get material-specific weights from load_line_items
      // Load Reports store job numbers in the 'notes' field
      const articJobs = allJobs.filter(j => j.category === "Artic Curtain Side");
      const articJobNumbers = articJobs.map(j => j.job_number);
      
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

      // Fetch load reports that match the Artic job numbers (stored in notes field)
      let loadReportWeights: Record<string, Record<string, number>> = {}; // job_number -> material_category -> weight_t
      
      if (articJobNumbers.length > 0) {
        const { data: loadReports } = await supabase
          .from("load_reports")
          .select("id, notes")
          .in("notes", articJobNumbers);

        if (loadReports && loadReports.length > 0) {
          const loadReportIds = loadReports.map(lr => lr.id);
          
          const { data: lineItems } = await supabase
            .from("load_line_items")
            .select("load_report_id, waste_type, total_weight_kg")
            .in("load_report_id", loadReportIds)
            .gt("total_weight_kg", 0); // Only items with weight

          // Build a map of job_number -> material_category -> weight in tonnes
          for (const lr of loadReports) {
            const jobNumber = lr.notes;
            if (!jobNumber) continue;
            
            const jobLineItems = lineItems?.filter(li => li.load_report_id === lr.id) ?? [];
            loadReportWeights[jobNumber] = {};
            
            for (const li of jobLineItems) {
              const materialCategory = wasteTypeToMaterialCategory[li.waste_type];
              if (materialCategory) {
                // Convert KG to tonnes and accumulate
                const weightT = (li.total_weight_kg ?? 0) / 1000;
                loadReportWeights[jobNumber][materialCategory] = 
                  (loadReportWeights[jobNumber][materialCategory] ?? 0) + weightT;
              }
            }
          }
        }
      }

      // Attach material-specific weights to Artic jobs
      allJobs = allJobs.map(job => {
        if (job.category === "Artic Curtain Side" && loadReportWeights[job.job_number]) {
          // Don't set material_weight_t here - we'll determine it per material type later
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
 
          const matchingJobs = allJobs.filter(job => {
            if (!job.waste_description) return false;
            const mappedCategory = wasteDescriptionToMaterialCategory[job.waste_description];
            return mappedCategory === config.material_type;
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