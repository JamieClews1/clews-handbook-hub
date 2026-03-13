 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Calendar } from "@/components/ui/calendar";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Badge } from "@/components/ui/badge";
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, ChevronDown, ChevronRight, Loader2, Mail, RefreshCw, Check, Clock, Building2, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import * as XLSX from "xlsx";
 import { cn } from "@/lib/utils";
 import { useToast } from "@/hooks/use-toast";
 import { DateRange } from "react-day-picker";
 import { useAuth } from "@/hooks/useAuth";
 
 type Customer = {
   id: string;
   customer_name: string;
   customer_code: string;
 };
 
 type Site = {
   id: string;
   site_name: string;
   customer_id: string;
   data_hub_site: string | null;
   data_hub_site_2: string | null;
   data_hub_site_3: string | null;
   data_hub_site_4: string | null;
   data_hub_site_5: string | null;
   load_report_type: string | null;
 };
 
 type CustomerContact = {
   id: string;
   full_name: string;
   email: string | null;
   customer_id: string;
 };
 
 type EmailLog = {
   id: string;
   sent_at: string;
   recipient_email: string;
   rebate_amount: number;
 };
 
 type CustomerRebateSummary = {
   customer: Customer;
   sites: Site[];
   contacts: CustomerContact[];
   totalRebate: number;
   totalWeight: number;
   siteBreakdowns: Array<{
     site: Site;
     loadReportRebate: number;
     loadReportWeight: number;
     skipRoroRebate: number;
     skipRoroWeight: number;
     totalRebate: number;
     totalWeight: number;
     materials: Array<{
       name: string;
       weight: number;
       rate: number;
       rebate: number;
       source: string;
     }>;
   }>;
   emailLogs: EmailLog[];
 };
 
 export function MonthlyRebateGeneration() {
   const { toast } = useToast();
   const { user } = useAuth();
   const [dateRange, setDateRange] = useState<DateRange | undefined>({
     from: startOfMonth(new Date()),
     to: endOfMonth(new Date()),
   });
   const [loading, setLoading] = useState(false);
   const [customerSummaries, setCustomerSummaries] = useState<CustomerRebateSummary[]>([]);
   const [generated, setGenerated] = useState(false);
   const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
   const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
   
   // Email dialog state
   const [emailDialogOpen, setEmailDialogOpen] = useState(false);
   const [selectedCustomer, setSelectedCustomer] = useState<CustomerRebateSummary | null>(null);
   const [emailRecipient, setEmailRecipient] = useState("");
   const [emailSubject, setEmailSubject] = useState("");
   const [emailBody, setEmailBody] = useState("");
   const [sendingEmail, setSendingEmail] = useState(false);
 
   const toggleCustomer = (customerId: string) => {
     setExpandedCustomers((prev) => {
       const next = new Set(prev);
       if (next.has(customerId)) {
         next.delete(customerId);
       } else {
         next.add(customerId);
       }
       return next;
     });
   };
 
   const toggleSite = (siteId: string) => {
     setExpandedSites((prev) => {
       const next = new Set(prev);
       if (next.has(siteId)) {
         next.delete(siteId);
       } else {
         next.add(siteId);
       }
       return next;
     });
   };
 
   const generateSummaries = async () => {
     if (!dateRange?.from || !dateRange?.to) return;
     
     setLoading(true);
     setGenerated(false);
     
     try {
       // Fetch all customers
       const { data: customers } = await supabase
         .from("customers")
         .select("id, customer_name, customer_code")
         .order("customer_name");
       
       if (!customers || customers.length === 0) {
         setCustomerSummaries([]);
         setGenerated(true);
         setLoading(false);
         return;
       }
 
       // Fetch all sites with their configs
       const { data: allSites } = await supabase
         .from("customer_sites")
         .select("id, site_name, customer_id, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, load_report_type");
 
       // Fetch all contacts
       const { data: allContacts } = await supabase
         .from("customer_contacts")
         .select("id, full_name, email, customer_id");
 
       // Fetch email logs for the period
       const { data: emailLogs } = await supabase
         .from("rebate_email_logs")
         .select("id, customer_id, site_id, period_start, period_end, rebate_amount, recipient_email, sent_at")
         .gte("period_start", format(dateRange.from, "yyyy-MM-dd"))
         .lte("period_end", format(dateRange.to, "yyyy-MM-dd"));
 
       // Fetch pallet weight setting
       const { data: palletWeightSetting } = await supabase
         .from("load_report_settings")
         .select("setting_value")
         .eq("setting_key", "default_pallet_weight_kg")
         .single();
       
       const palletWeightKg = palletWeightSetting ? Number(palletWeightSetting.setting_value) : 20;
 
       const periodStart = format(dateRange.from, "yyyy-MM-dd");
       const periodEnd = format(dateRange.to, "yyyy-MM-dd");
 
       // Get monthly values for the period
       const monthsInRange = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
       const monthStarts = monthsInRange.map(m => format(startOfMonth(m), "yyyy-MM-dd"));
       
       const { data: monthlyValues } = await supabase
         .from("rebate_monthly_values")
         .select("item_id, lower_range, higher_range, month_start")
         .in("month_start", monthStarts);
 
       // Average monthly values
       const monthlyValueMap: Record<string, { lower: number; higher: number }> = {};
       const valueAccumulator: Record<string, { lowerSum: number; higherSum: number; count: number }> = {};
       
       for (const mv of monthlyValues ?? []) {
         if (!valueAccumulator[mv.item_id]) {
           valueAccumulator[mv.item_id] = { lowerSum: 0, higherSum: 0, count: 0 };
         }
         valueAccumulator[mv.item_id].lowerSum += mv.lower_range ?? 0;
         valueAccumulator[mv.item_id].higherSum += mv.higher_range ?? 0;
         valueAccumulator[mv.item_id].count += 1;
       }
       
       for (const [itemId, acc] of Object.entries(valueAccumulator)) {
         monthlyValueMap[itemId] = {
           lower: acc.count > 0 ? acc.lowerSum / acc.count : 0,
           higher: acc.count > 0 ? acc.higherSum / acc.count : 0,
         };
       }
 
       const summaries: CustomerRebateSummary[] = [];
 
       for (const customer of customers) {
         const customerSites = (allSites ?? []).filter(s => s.customer_id === customer.id);
         const customerContacts = (allContacts ?? []).filter(c => c.customer_id === customer.id);
         const customerEmailLogs = (emailLogs ?? []).filter(e => e.customer_id === customer.id);
         
         if (customerSites.length === 0) continue;
 
         let customerTotalRebate = 0;
         let customerTotalWeight = 0;
         const siteBreakdowns: CustomerRebateSummary["siteBreakdowns"] = [];
 
         for (const site of customerSites) {
           // Get site price set
           const { data: priceSetLink } = await supabase
             .from("customer_site_price_sets")
             .select("price_set_id")
             .eq("site_id", site.id)
             .single();
 
           if (!priceSetLink) continue;
 
            // Get rebate items config
            const { data: rebateItems } = await supabase
              .from("rebate_price_set_items")
              .select("rebate_item_id, value_type, set_value, value_type_item_id, adjustment")
              .eq("price_set_id", priceSetLink.price_set_id);
            
            // Fetch rebate item names for rate source display
            const rebateItemIds = (rebateItems ?? [])
              .map(item => item.value_type_item_id)
              .filter((id): id is string => !!id);
            
            let rebateItemNames: Record<string, string> = {};
            if (rebateItemIds.length > 0) {
              const { data: rebateItemsData } = await supabase
                .from("rebate_items")
                .select("id, name")
                .in("id", rebateItemIds);
              
              for (const ri of rebateItemsData ?? []) {
                rebateItemNames[ri.id] = ri.name;
              }
            }
 
          // Get load reports for this site
          const { data: loadReports } = await supabase
            .from("load_reports")
            .select("id, total_pallets, no_pallets_on_load")
            .eq("site_id", site.id)
            .gte("report_date", periodStart)
            .lte("report_date", periodEnd)
            .eq("status", "submitted");

          const loadReportIds = (loadReports ?? []).map(r => r.id);
          
          // Build a map of report id to no_pallets_on_load flag
          const noPalletsByReportId: Record<string, boolean> = {};
          for (const r of loadReports ?? []) {
            noPalletsByReportId[r.id] = Boolean((r as any).no_pallets_on_load);
          }

          // Get line items with pallet counts to calculate NET weights
          let lineItemWeights: Record<string, number> = {};
          let totalPalletWeightTonnes = 0;
          
          if (loadReportIds.length > 0) {
            const { data: lineItems } = await supabase
              .from("load_line_items")
              .select("load_report_id, waste_type, total_weight_kg, pallet_count")
              .in("load_report_id", loadReportIds);
            
            for (const item of lineItems ?? []) {
              const wasteType = item.waste_type;
              // Skip pallet weight line items - they're a charge not a material
              if (wasteType.toLowerCase().includes("pallet weight")) continue;
              
              const grossKg = Number(item.total_weight_kg) || 0;
              const palletCount = Number(item.pallet_count) || 0;
              const noPallets = noPalletsByReportId[item.load_report_id] ?? false;
              
              // Calculate pallet weight deduction for this line item
              const palletKg = noPallets ? 0 : palletCount * palletWeightKg;
              const actualKg = Math.max(0, grossKg - palletKg);
              const actualTonnes = actualKg / 1000;
              
              // Accumulate NET weight by waste type
              lineItemWeights[wasteType] = (lineItemWeights[wasteType] ?? 0) + actualTonnes;
              
              // Accumulate total pallet weight for the pallet charge row
              totalPalletWeightTonnes += palletKg / 1000;
            }
          }
          
          // Use the calculated pallet weight from line items
          const palletWeightTonnes = totalPalletWeightTonnes;
 
           // Calculate load report rebates
           let loadReportRebate = 0;
           let loadReportWeight = 0;
           const materials: CustomerRebateSummary["siteBreakdowns"][0]["materials"] = [];
           
           for (const item of rebateItems ?? []) {
             // Get material name
             const { data: material } = await supabase
               .from("load_waste_types")
               .select("waste_type, rebate_category")
               .eq("id", item.rebate_item_id)
               .single();

             const materialName = material?.waste_type ?? "Unknown";
             const isPalletCharge = materialName.toLowerCase().includes("pallet");
             
             // For pallet charge, use the aggregated pallet weight; for others use line item weight
             const weight = isPalletCharge ? palletWeightTonnes : (lineItemWeights[materialName] ?? 0);

              // Determine rate
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

              // Apply rate adjustment
              if (adjustment !== 0) {
                rate += adjustment;
                rateSource += ` ${adjustment > 0 ? "+" : ""}${adjustment}`;
              }

              // Calculate rebate value - negate for cost items
              const isCostItem = (material?.rebate_category ?? "rebate") === "cost";
              let rebate = weight * rate;
              if (isCostItem) rebate = -Math.abs(rebate);
              loadReportRebate += rebate;
              
              // Add all material weights to gross weight total (including pallet weight)
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
 
           // Skip/RoRo rebates (simplified - just getting totals)
           const siteDataHubMappings = [
             site.data_hub_site,
             site.data_hub_site_2,
             site.data_hub_site_3,
             site.data_hub_site_4,
             site.data_hub_site_5,
           ].filter((s): s is string => !!s);
 
           // Get skip rebate configs
           const { data: skipConfigs } = await supabase
             .from("customer_site_skip_rebates")
             .select("material_type, value_type, value_type_item_id, set_value, adjustment, threshold_tonnes, rebate_enabled")
             .eq("site_id", site.id);
 
           let skipRoroRebate = 0;
           let skipRoroWeight = 0;
 
            if (skipConfigs && skipConfigs.length > 0 && siteDataHubMappings.length > 0) {
              // Load rebate rules (exclusion settings) - same as useSkipRoroRebates
              const { data: rebateRules } = await supabase
                .from("rebate_rules")
                .select("rule_key, is_enabled");
              
              const excludeSkipJobType = rebateRules?.find(r => r.rule_key === "exclude_skip_job_type")?.is_enabled ?? false;
              const excludeDeliverMovement = rebateRules?.find(r => r.rule_key === "exclude_deliver_movement")?.is_enabled ?? false;

              // Get data hub jobs for these sites - MUST filter by category like useSkipRoroRebates
              const targetCategories = ["Roll on Roll off", "Skips", "Midweigh"];
              const { data: rawJobs } = await supabase
                .from("data_hub_jobs")
                .select("waste_description, weight_t, category, job_type, movement_type")
                .in("site", siteDataHubMappings)
                .gte("job_date", periodStart)
                .lte("job_date", periodEnd)
                .in("category", targetCategories);

              // Apply exclusion rules matching useSkipRoroRebates logic
              let jobs = (rawJobs ?? []).map(j => ({
                ...j,
                // Convert Midweigh weights from kg to tonnes
                weight_t: (j.category ?? "") === "Midweigh" ? (j.weight_t ?? 0) / 1000 : (j.weight_t ?? 0),
              }));

              // Rule 1: Exclude Midweigh jobs with Job Type = "SKIP"
              if (excludeSkipJobType) {
                jobs = jobs.filter(j => {
                  if (j.category !== "Midweigh") return true;
                  return (j.job_type ?? "").toUpperCase() !== "SKIP";
                });
              }
              
              // Rule 2: Exclude Skiptrak "Deliver" jobs
              if (excludeDeliverMovement) {
                jobs = jobs.filter(j => {
                  if (j.category !== "Skips" && j.category !== "Roll on Roll off") return true;
                  const mt = (j.movement_type ?? "").toLowerCase();
                  return mt !== "deliver" && mt !== "delivery";
                });
              }
 
             // Get rebate mappings
             const { data: mappings } = await supabase
               .from("data_hub_rebate_mappings")
               .select("waste_description, material_type_id, rebate_item_id");
 
             const MATERIAL_TYPE_MAP: Record<string, string> = {
               card_loose: "Card Loose",
               scrap_metal: "Scrap Metal",
             };
 
             // Map material type to waste type patterns for flexible matching
             const MATERIAL_TYPE_TO_WASTE_TYPES: Record<string, string[]> = {
               card_loose: ["card loose", "cardboard"],
               scrap_metal: ["scrap ferrous", "scrap non-ferrous", "scrap metal"],
             };

             for (const config of skipConfigs) {
               if (config.rebate_enabled === false) continue;
 
               // Find matching jobs via mappings
               let totalWeight = 0;
               for (const job of jobs ?? []) {
                 const mapping = (mappings ?? []).find(m => m.waste_description === job.waste_description);
                 if (mapping) {
                   if (mapping.material_type_id) {
                     // Check if this mapping corresponds to the material type
                     const { data: wasteType } = await supabase
                       .from("load_waste_types")
                       .select("waste_type")
                       .eq("id", mapping.material_type_id)
                       .single();
                     
                     // Use flexible matching - check if the waste type matches any of the patterns for this material
                     const patterns = MATERIAL_TYPE_TO_WASTE_TYPES[config.material_type] ?? [];
                     const wasteTypeLower = wasteType?.waste_type?.toLowerCase() ?? "";
                     
                     const matches = patterns.some(pattern => wasteTypeLower.includes(pattern));
                     if (matches) {
                       totalWeight += job.weight_t;
                     }
                   }
                 }
               }
 
               if (totalWeight === 0) continue;
 
               // Determine rate
               let rate = 0;
               if (config.value_type === "set" && config.set_value !== null) {
                 rate = Number(config.set_value);
               } else if (config.value_type_item_id) {
                 const monthVal = monthlyValueMap[config.value_type_item_id];
                 if (monthVal) {
                   rate = config.value_type === "higher" ? monthVal.higher : monthVal.lower;
                 }
               }
 
               // Apply adjustment and threshold
               rate += config.adjustment ?? 0;
               const threshold = config.threshold_tonnes ?? 0;
               const rebatableWeight = Math.max(0, totalWeight - threshold);
               const rebate = rebatableWeight * rate;
 
               skipRoroRebate += rebate;
               skipRoroWeight += totalWeight;
 
               materials.push({
                 name: `${MATERIAL_TYPE_MAP[config.material_type] ?? config.material_type} (RoRo/Skip)`,
                 weight: totalWeight,
                 rate,
                 rebate,
                 source: threshold > 0 ? `After ${threshold}t threshold` : "Market rate",
               });
             }
           }
 
           const siteTotalRebate = loadReportRebate + skipRoroRebate;
           const siteTotalWeight = loadReportWeight + skipRoroWeight;
 
           if (siteTotalRebate !== 0 || materials.length > 0) {
             siteBreakdowns.push({
               site,
               loadReportRebate,
               loadReportWeight,
               skipRoroRebate,
               skipRoroWeight,
               totalRebate: siteTotalRebate,
               totalWeight: siteTotalWeight,
               materials,
             });
           }
 
           customerTotalRebate += siteTotalRebate;
           customerTotalWeight += siteTotalWeight;
         }
 
         if (siteBreakdowns.length > 0) {
           summaries.push({
             customer,
             sites: customerSites,
             contacts: customerContacts,
             totalRebate: customerTotalRebate,
             totalWeight: customerTotalWeight,
             siteBreakdowns,
             emailLogs: customerEmailLogs.map(log => ({
               id: log.id,
               sent_at: log.sent_at,
               recipient_email: log.recipient_email,
               rebate_amount: Number(log.rebate_amount),
             })),
           });
         }
       }
 
       // Sort by total rebate descending
       summaries.sort((a, b) => b.totalRebate - a.totalRebate);
 
       setCustomerSummaries(summaries);
       setGenerated(true);
     } catch (error: any) {
       console.error("Error generating summaries:", error);
       toast({
         title: "Error",
         description: error?.message || "Failed to generate rebate summaries",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   };
 
    const buildCustomerExcelData = (summary: CustomerRebateSummary) => {
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
        rows.push({
          Customer: summary.customer.customer_name,
          Site: sb.site.site_name,
          Material: "SITE TOTAL",
          "Weight (t)": Number(sb.totalWeight.toFixed(4)),
          "Rate (£/t)": "",
          "Rate Source": "",
          "Value (£)": Number(sb.totalRebate.toFixed(2)),
        });
      }
      rows.push({
        Customer: summary.customer.customer_name,
        Site: "TOTAL",
        Material: "",
        "Weight (t)": Number(summary.totalWeight.toFixed(4)),
        "Rate (£/t)": "",
        "Rate Source": "",
        "Value (£)": Number(summary.totalRebate.toFixed(2)),
      });
      return rows;
    };

    const buildExcelWorkbook = (summary: CustomerRebateSummary) => {
      const rows = buildCustomerExcelData(summary);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      const periodLabel = dateRange?.from
        ? format(dateRange.from, "MMM-yyyy") + (dateRange?.to && dateRange.to.getMonth() !== dateRange.from.getMonth() ? `-${format(dateRange.to, "MMM-yyyy")}` : "")
        : "Rebate";
      XLSX.utils.book_append_sheet(workbook, worksheet, periodLabel);
      return { workbook, periodLabel };
    };

    const downloadCustomerExcel = (summary: CustomerRebateSummary) => {
      const { workbook, periodLabel } = buildExcelWorkbook(summary);
      const safeName = summary.customer.customer_name.replace(/[^a-zA-Z0-9]/g, "_");
      XLSX.writeFile(workbook, `Rebate-${safeName}-${periodLabel}.xlsx`);
    };

    const getExcelBase64 = (summary: CustomerRebateSummary): { base64: string; filename: string } => {
      const { workbook, periodLabel } = buildExcelWorkbook(summary);
      const safeName = summary.customer.customer_name.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `Rebate-${safeName}-${periodLabel}.xlsx`;
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
      return { base64: wbout, filename };
    };

    const openEmailDialog = (summary: CustomerRebateSummary) => {
     setSelectedCustomer(summary);
     
     // Find first contact with email
     const contactWithEmail = summary.contacts.find(c => c.email);
     setEmailRecipient(contactWithEmail?.email ?? "");
     
     const periodLabel = dateRange?.from 
       ? `${format(dateRange.from, "MMMM yyyy")}${dateRange.to && dateRange.to.getMonth() !== dateRange.from.getMonth() ? ` - ${format(dateRange.to, "MMMM yyyy")}` : ""}`
       : "the period";
     
     setEmailSubject(`Rebate Invoice Request - ${periodLabel}`);
     setEmailBody(
 `Dear ${contactWithEmail?.full_name ?? "Customer"},
 
 We are writing to inform you that rebates have been calculated for ${periodLabel}.
 
 Total Rebate Due: £${summary.totalRebate.toFixed(2)}
 
 Please submit an invoice for this amount at your earliest convenience.
 
 Site Breakdown:
 ${summary.siteBreakdowns.map(sb => `- ${sb.site.site_name}: £${sb.totalRebate.toFixed(2)}`).join("\n")}
 
 If you have any questions, please don't hesitate to contact us.
 
 Best regards,
 Clews Recycling Limited`
     );
     
     setEmailDialogOpen(true);
   };
 
   const sendRebateEmail = async () => {
     if (!selectedCustomer || !emailRecipient || !dateRange?.from || !dateRange?.to) return;
     
     setSendingEmail(true);
     
      try {
        // Generate Excel attachment
        const { base64, filename } = getExcelBase64(selectedCustomer);

        // Call edge function to send email with attachment
        const { error: emailError } = await supabase.functions.invoke("send-rebate-notification", {
          body: {
            to: emailRecipient,
            subject: emailSubject,
            body: emailBody,
            customerName: selectedCustomer.customer.customer_name,
            attachment: { base64, filename },
          },
        });
 
       if (emailError) throw emailError;
 
       // Log the email
       const { error: logError } = await supabase.from("rebate_email_logs").insert({
         customer_id: selectedCustomer.customer.id,
         period_start: format(dateRange.from, "yyyy-MM-dd"),
         period_end: format(dateRange.to, "yyyy-MM-dd"),
         rebate_amount: selectedCustomer.totalRebate,
         recipient_email: emailRecipient,
         sent_by: user?.id,
       });
 
       if (logError) throw logError;
 
       toast({
         title: "Email Sent",
         description: `Rebate notification sent to ${emailRecipient}`,
       });
 
       setEmailDialogOpen(false);
       
       // Refresh to show new email log
       generateSummaries();
     } catch (error: any) {
       console.error("Error sending email:", error);
       toast({
         title: "Error",
         description: error?.message || "Failed to send email",
         variant: "destructive",
       });
     } finally {
       setSendingEmail(false);
     }
   };
 
   const grandTotal = customerSummaries.reduce((sum, s) => sum + s.totalRebate, 0);
 
   return (
     <div className="space-y-6">
       <div className="flex flex-wrap gap-4 items-end">
         <div className="space-y-2">
           <Label>Period</Label>
           <Popover>
             <PopoverTrigger asChild>
               <Button
                 variant="outline"
                 className={cn(
                   "w-[280px] justify-start text-left font-normal",
                   !dateRange?.from && "text-muted-foreground"
                 )}
               >
                 <CalendarIcon className="mr-2 h-4 w-4" />
                 {dateRange?.from ? (
                   dateRange.to ? (
                     <>
                       {format(dateRange.from, "d MMM yyyy")} – {format(dateRange.to, "d MMM yyyy")}
                     </>
                   ) : (
                     format(dateRange.from, "d MMM yyyy")
                   )
                 ) : (
                   <span>Pick a date range</span>
                 )}
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-auto p-0 z-[100]" align="start">
               <Calendar
                 mode="range"
                 selected={dateRange}
                 onSelect={setDateRange}
                 numberOfMonths={2}
                 initialFocus
               />
             </PopoverContent>
           </Popover>
         </div>
 
         <Button onClick={generateSummaries} disabled={loading}>
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
 
       {generated && (
         <div className="space-y-4">
           {/* Summary Header */}
           <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
             <div>
               <h3 className="text-lg font-semibold">
                 Rebates Due: {dateRange?.from && format(dateRange.from, "d MMM yyyy")}
                 {dateRange?.to && dateRange.to !== dateRange.from && ` to ${format(dateRange.to, "d MMM yyyy")}`}
               </h3>
               <p className="text-sm text-muted-foreground">
                 {customerSummaries.length} customers with rebates due
               </p>
             </div>
             <Badge variant="default" className={cn("text-lg px-4 py-2", grandTotal >= 0 ? "bg-green-600" : "bg-red-600")}>
               Total: £{grandTotal.toFixed(2)}
             </Badge>
           </div>
 
           {/* Customer Cards */}
           <div className="grid gap-4">
             {customerSummaries.map((summary) => (
               <Card key={summary.customer.id} className="overflow-hidden">
                 <Collapsible
                   open={expandedCustomers.has(summary.customer.id)}
                   onOpenChange={() => toggleCustomer(summary.customer.id)}
                 >
                   <CollapsibleTrigger asChild>
                     <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           {expandedCustomers.has(summary.customer.id) ? (
                             <ChevronDown className="h-5 w-5 text-muted-foreground" />
                           ) : (
                             <ChevronRight className="h-5 w-5 text-muted-foreground" />
                           )}
                           <Building2 className="h-5 w-5 text-muted-foreground" />
                           <div>
                             <CardTitle className="text-lg">{summary.customer.customer_name}</CardTitle>
                             <CardDescription>
                               {summary.siteBreakdowns.length} site{summary.siteBreakdowns.length !== 1 ? "s" : ""} • 
                               {summary.totalWeight.toFixed(2)}t
                             </CardDescription>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           {summary.emailLogs.length > 0 && (
                             <Badge variant="outline" className="text-green-600 border-green-600">
                               <Check className="h-3 w-3 mr-1" />
                               Notified
                             </Badge>
                           )}
                           <Badge 
                             variant="default" 
                             className={cn("text-base px-3 py-1", summary.totalRebate >= 0 ? "bg-green-600" : "bg-red-600")}
                           >
                             £{summary.totalRebate.toFixed(2)}
                           </Badge>
                         </div>
                       </div>
                     </CardHeader>
                   </CollapsibleTrigger>
 
                   <CollapsibleContent>
                     <CardContent className="border-t pt-4 space-y-4">
                       {/* Site Breakdowns */}
                       {summary.siteBreakdowns.map((siteBreakdown) => (
                         <Collapsible
                           key={siteBreakdown.site.id}
                           open={expandedSites.has(siteBreakdown.site.id)}
                           onOpenChange={() => toggleSite(siteBreakdown.site.id)}
                         >
                           <CollapsibleTrigger asChild>
                             <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                               <div className="flex items-center gap-2">
                                 {expandedSites.has(siteBreakdown.site.id) ? (
                                   <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                 ) : (
                                   <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                 )}
                                 <span className="font-medium">{siteBreakdown.site.site_name}</span>
                                 <span className="text-sm text-muted-foreground">
                                   ({siteBreakdown.totalWeight.toFixed(2)}t)
                                 </span>
                               </div>
                               <span className={cn("font-semibold", siteBreakdown.totalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                                 £{siteBreakdown.totalRebate.toFixed(2)}
                               </span>
                             </div>
                           </CollapsibleTrigger>
 
                            <CollapsibleContent>
                              {(() => {
                                // Consolidate materials into categories like the Rebate Reports Total tab
                                const categories: Record<string, { 
                                  weight: number; 
                                  rebate: number; 
                                  sources: typeof siteBreakdown.materials 
                                }> = {};

                                for (const mat of siteBreakdown.materials) {
                                  const name = mat.name.toLowerCase();
                                  const isPalletWeightCharge = name.includes("pallet weight");
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

                                  if (!categories[category]) {
                                    categories[category] = { weight: 0, rebate: 0, sources: [] };
                                  }
                                  // Pallet Weight Charge: include rebate but NOT weight in category totals
                                  if (!isPalletWeightCharge) {
                                    categories[category].weight += mat.weight;
                                  }
                                  categories[category].rebate += mat.rebate;
                                  categories[category].sources.push(mat);
                                }

                                const consolidated = Object.entries(categories)
                                  .filter(([_, data]) => data.weight > 0 || data.rebate !== 0)
                                  .map(([name, data]) => ({ category: name, ...data }))
                                  .sort((a, b) => b.rebate - a.rebate);

                                const rebateRows = consolidated.filter((c) => c.rebate >= 0);
                                const chargeRows = consolidated.filter((c) => c.rebate < 0);
                                const rebatesTotal = rebateRows.reduce((sum, c) => sum + c.rebate, 0);
                                const rebatesWeight = rebateRows.reduce((sum, c) => sum + c.weight, 0);
                                const chargesTotal = chargeRows.reduce((sum, c) => sum + c.rebate, 0);
                                const chargesWeight = chargeRows.reduce((sum, c) => sum + c.weight, 0);

                                const renderCategoryRows = (rows: typeof consolidated) =>
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
                                  <div className="mt-2 ml-6 border rounded-lg overflow-hidden">
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
                                          <TableCell className="text-right">{siteBreakdown.totalWeight.toFixed(2)}</TableCell>
                                          <TableCell colSpan={2}></TableCell>
                                          <TableCell className={cn("text-right", siteBreakdown.totalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                                            £{siteBreakdown.totalRebate.toFixed(2)}
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>
                                );
                              })()}
                            </CollapsibleContent>
                         </Collapsible>
                       ))}
 
                       {/* Email Logs */}
                       {summary.emailLogs.length > 0 && (
                         <div className="border-t pt-4">
                           <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                             <Clock className="h-4 w-4" />
                             Notification History
                           </h4>
                           <div className="space-y-1">
                             {summary.emailLogs.map((log) => (
                               <div key={log.id} className="text-sm text-muted-foreground flex justify-between">
                                 <span>Sent to {log.recipient_email}</span>
                                 <span>{format(new Date(log.sent_at), "d MMM yyyy HH:mm")}</span>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
 
                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadCustomerExcel(summary)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Excel
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openEmailDialog(summary)}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Send Rebate Notification
                          </Button>
                        </div>
                     </CardContent>
                   </CollapsibleContent>
                 </Collapsible>
               </Card>
             ))}
 
             {customerSummaries.length === 0 && (
               <Card>
                 <CardContent className="py-8 text-center text-muted-foreground">
                   No customers with rebates due for this period.
                 </CardContent>
               </Card>
             )}
           </div>
         </div>
       )}
 
       {/* Email Dialog */}
       <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
         <DialogContent className="max-w-lg">
           <DialogHeader>
             <DialogTitle>Send Rebate Notification</DialogTitle>
             <DialogDescription>
               Notify {selectedCustomer?.customer.customer_name} about their rebate.
             </DialogDescription>
           </DialogHeader>
 
           <div className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="email-to">Recipient Email</Label>
               <Input
                 id="email-to"
                 type="email"
                 value={emailRecipient}
                 onChange={(e) => setEmailRecipient(e.target.value)}
                 placeholder="customer@example.com"
               />
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="email-subject">Subject</Label>
               <Input
                 id="email-subject"
                 value={emailSubject}
                 onChange={(e) => setEmailSubject(e.target.value)}
               />
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="email-body">Message</Label>
               <Textarea
                 id="email-body"
                 value={emailBody}
                 onChange={(e) => setEmailBody(e.target.value)}
                 rows={12}
                 className="font-mono text-sm"
               />
             </div>
 
             <div className="bg-muted/50 rounded-lg p-3 text-sm">
               <strong>Rebate Amount:</strong> £{selectedCustomer?.totalRebate.toFixed(2)}
             </div>
           </div>
 
           <DialogFooter>
             <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
               Cancel
             </Button>
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