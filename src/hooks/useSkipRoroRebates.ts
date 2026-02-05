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
 };
 
 const MATERIAL_LABELS: Record<string, string> = {
   card_loose: "Card Loose",
   scrap_metal: "Scrap Metal",
 };
 
 const MATERIAL_TYPE_TO_WASTE_TYPES: Record<string, string[]> = {
   card_loose: ["Card Loose", "Cardboard"],
   scrap_metal: ["Scrap Ferrous", "Scrap Non-Ferrous", "Scrap Metal"],
 };
 
 export function useSkipRoroRebates(
   siteId: string,
   dateRange: DateRange | undefined,
   siteDataHubMappings: string[]
 ) {
   const [loading, setLoading] = useState(true);
   const [summaries, setSummaries] = useState<SkipRoroMaterialSummary[]>([]);
   const [totalRebate, setTotalRebate] = useState(0);
   const [totalWeight, setTotalWeight] = useState(0);
 
   useEffect(() => {
     if (siteId && dateRange?.from) {
       loadData();
     } else {
       setSummaries([]);
       setTotalRebate(0);
       setTotalWeight(0);
       setLoading(false);
     }
   }, [siteId, dateRange, siteDataHubMappings.join(",")]);
 
   const loadData = async () => {
     setLoading(true);
     try {
       // 1. Get skip rebate config for this site
       const { data: skipConfigs } = await supabase
         .from("customer_site_skip_rebates")
         .select("material_type, value_type, value_type_item_id, set_value, adjustment")
         .eq("site_id", siteId);
 
       if (!skipConfigs || skipConfigs.length === 0) {
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
 
       // 3. Get jobs from Performance Hub for this site in date range
       const startDate = format(dateRange!.from!, "yyyy-MM-dd");
       const endDate = format(dateRange?.to ?? dateRange!.from!, "yyyy-MM-dd");
 
       const targetCategories = ["Roll on Roll off", "Skips"];
       
       let allJobs: JobRecord[] = [];
       
       for (const siteMapping of siteDataHubMappings) {
         if (!siteMapping) continue;
         
         const { data: jobs } = await supabase
           .from("data_hub_jobs")
           .select("id, job_number, job_date, category, waste_description, weight_t, site")
           .eq("site", siteMapping)
           .gte("job_date", startDate)
           .lte("job_date", endDate)
           .in("category", targetCategories);
 
         if (jobs) {
           allJobs = [...allJobs, ...jobs.map(j => ({
             ...j,
             weight_t: j.weight_t ?? 0,
             job_date: j.job_date ?? "",
             waste_description: j.waste_description ?? null,
             category: j.category ?? "",
             site: j.site ?? "",
           }))];
         }
       }
 
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
         const rebateValue = totalWeightVal * adjustedRate;
 
         materialSummaries.push({
           material_type: config.material_type,
           material_label: MATERIAL_LABELS[config.material_type] ?? config.material_type,
           total_weight_tonnes: totalWeightVal,
           rate_per_tonne: adjustedRate,
           adjustment,
           rebate_value: rebateValue,
           rate_source: rateSource,
           jobs: matchingJobs.sort((a, b) => 
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