import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { convertWeightToTonnes } from "@/lib/weighbridge-source";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ChevronDown, ChevronRight, Loader2, FileSpreadsheet, Building2, Download, Check, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";

type WasteTypeSummary = {
  waste_description: string;
  job_count: number;
  total_weight: number;
  material_type: string | null;
};

type CustomerRebateData = {
  customer: string;
  source: string;
  wasteTypes: WasteTypeSummary[];
  totalWeight: number;
  totalJobs: number;
  isConfigured: boolean;
  configuredSiteName?: string;
};

export function RebateCheckReport() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerRebateData[]>([]);
  const [generated, setGenerated] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const toggleCustomer = (customerKey: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerKey)) {
        next.delete(customerKey);
      } else {
        next.add(customerKey);
      }
      return next;
    });
  };

  const generateReport = async () => {
    if (!dateRange?.from) return;

    setLoading(true);
    setGenerated(false);

    try {
      const periodStart = format(dateRange.from, "yyyy-MM-dd");
      const periodEnd = format(dateRange?.to ?? dateRange.from, "yyyy-MM-dd");

      // Get all rebate mappings (waste descriptions that are mapped to rebateable materials)
      const { data: rebateMappings } = await supabase
        .from("data_hub_rebate_mappings")
        .select("waste_description, material_type_id, rebate_item_id");

      // Filter to only rebateable mappings
      const rebateableWasteDescriptions = (rebateMappings ?? [])
        .filter((m) => m.rebate_item_id !== null || m.material_type_id !== null)
        .map((m) => m.waste_description);

      if (rebateableWasteDescriptions.length === 0) {
        setCustomerData([]);
        setGenerated(true);
        setLoading(false);
        toast({
          title: "No Mappings",
          description: "No rebateable waste type mappings are configured.",
          variant: "destructive",
        });
        return;
      }

      // Get material type names for display
      const materialTypeIds = (rebateMappings ?? [])
        .filter((m) => m.material_type_id !== null)
        .map((m) => m.material_type_id)
        .filter((id, i, arr) => id && arr.indexOf(id) === i) as string[];

      let materialTypeNames: Record<string, string> = {};
      if (materialTypeIds.length > 0) {
        const { data: materialTypes } = await supabase
          .from("load_waste_types")
          .select("id, waste_type")
          .in("id", materialTypeIds);

        for (const mt of materialTypes ?? []) {
          materialTypeNames[mt.id] = mt.waste_type;
        }
      }

      // Build waste description to material type mapping
      const wasteToMaterialType: Record<string, string | null> = {};
      for (const mapping of rebateMappings ?? []) {
        if (mapping.material_type_id && materialTypeNames[mapping.material_type_id]) {
          wasteToMaterialType[mapping.waste_description] = materialTypeNames[mapping.material_type_id];
        } else {
          wasteToMaterialType[mapping.waste_description] = null;
        }
      }

      // Get jobs for rebateable waste types in the date range
      const { data: jobs } = await supabase
        .from("data_hub_jobs")
        .select("customer, source, waste_description, weight_t, site")
        .in("waste_description", rebateableWasteDescriptions)
        .gte("job_date", periodStart)
        .lte("job_date", periodEnd)
        .not("customer", "is", null);

      if (!jobs || jobs.length === 0) {
        setCustomerData([]);
        setGenerated(true);
        setLoading(false);
        return;
      }

      // Get configured customer sites to check which customers are already set up
      const [{ data: configuredSites }, { data: configuredCustomers }] = await Promise.all([
        supabase
          .from("customer_sites")
          .select(`
            id,
            site_name,
            data_hub_site,
            data_hub_site_2,
            data_hub_site_3,
            data_hub_site_4,
            data_hub_site_5,
            data_hub_customer,
            customer_id,
            customers!inner(customer_name)
          `),
        supabase
          .from("customers")
          .select("id, customer_name, data_hub_customer")
          .not("data_hub_customer", "is", null),
      ]);

      // Build a map of data hub customer names to configured site info
      const configuredCustomerMap: Record<string, { siteName: string; customerName: string }> = {};
      
      // Check customer-level data_hub_customer mappings first
      for (const cust of configuredCustomers ?? []) {
        if (cust.data_hub_customer) {
          configuredCustomerMap[cust.data_hub_customer.toLowerCase()] = {
            siteName: "",
            customerName: cust.customer_name,
          };
        }
      }
      
      for (const site of configuredSites ?? []) {
        if (site.data_hub_customer) {
          configuredCustomerMap[site.data_hub_customer.toLowerCase()] = {
            siteName: site.site_name,
            customerName: (site.customers as any)?.customer_name ?? "",
          };
        }
        // Also check the data_hub_site fields as they sometimes contain customer mappings
        const siteFields = [
          site.data_hub_site,
          site.data_hub_site_2,
          site.data_hub_site_3,
          site.data_hub_site_4,
          site.data_hub_site_5,
        ].filter(Boolean);
        
        for (const siteField of siteFields) {
          if (siteField) {
            configuredCustomerMap[siteField.toLowerCase()] = {
              siteName: site.site_name,
              customerName: (site.customers as any)?.customer_name ?? "",
            };
          }
        }
      }

      // Aggregate by customer + source
      const customerMap: Record<string, CustomerRebateData> = {};

      for (const job of jobs) {
        const key = `${job.customer}|${job.source}`;
        
        if (!customerMap[key]) {
          // Check if this customer or their site is configured
          const customerLower = job.customer!.toLowerCase();
          const siteLower = job.site?.toLowerCase() ?? "";
          const configInfo = configuredCustomerMap[customerLower] || configuredCustomerMap[siteLower];
          
          customerMap[key] = {
            customer: job.customer!,
            source: job.source,
            wasteTypes: [],
            totalWeight: 0,
            totalJobs: 0,
            isConfigured: !!configInfo,
            configuredSiteName: configInfo?.siteName,
          };
        }

        // Find or create waste type entry
        let wasteEntry = customerMap[key].wasteTypes.find(
          (w) => w.waste_description === job.waste_description
        );

        if (!wasteEntry) {
          wasteEntry = {
            waste_description: job.waste_description!,
            job_count: 0,
            total_weight: 0,
            material_type: wasteToMaterialType[job.waste_description!] ?? null,
          };
          customerMap[key].wasteTypes.push(wasteEntry);
        }

        // Convert weight to tonnes - Midweigh stores KG, Skiptrak stores tonnes
        const weightInTonnes = convertWeightToTonnes(Number(job.weight_t) || 0, job.source as "skiptrak" | "midweigh") || 0;
        
        wasteEntry.job_count += 1;
        wasteEntry.total_weight += weightInTonnes;
        customerMap[key].totalWeight += weightInTonnes;
        customerMap[key].totalJobs += 1;
      }

      // Sort waste types within each customer
      for (const customerData of Object.values(customerMap)) {
        customerData.wasteTypes.sort((a, b) => b.total_weight - a.total_weight);
      }

      // Sort customers by total weight
      const sortedCustomers = Object.values(customerMap).sort(
        (a, b) => b.totalWeight - a.totalWeight
      );

      setCustomerData(sortedCustomers);
      setGenerated(true);

      toast({
        title: "Report Generated",
        description: `Found ${sortedCustomers.length} customers with rebateable waste types.`,
      });
    } catch (error: any) {
      console.error("Error generating rebate check report:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (customerData.length === 0) return;

    const rows: Array<Record<string, any>> = [];

    for (const customer of customerData) {
      for (const wasteType of customer.wasteTypes) {
        rows.push({
          Customer: customer.customer,
          "Configured for Rebates": customer.isConfigured ? "Yes" : "No",
          "Configured Site": customer.configuredSiteName || "",
          Source: customer.source,
          "Waste Description": wasteType.waste_description,
          "Material Type": wasteType.material_type || "Unmapped",
          Jobs: wasteType.job_count,
          "Weight (t)": wasteType.total_weight.toFixed(2),
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rebate Check");

    const periodLabel = dateRange?.from
      ? format(dateRange.from, "MMM-yyyy") +
        (dateRange.to ? `-${format(dateRange.to, "MMM-yyyy")}` : "")
      : "Report";

    XLSX.writeFile(workbook, `Rebate-Check-Report-${periodLabel}.xlsx`);
  };

  const grandTotalWeight = customerData.reduce((sum, c) => sum + c.totalWeight, 0);
  const grandTotalJobs = customerData.reduce((sum, c) => sum + c.totalJobs, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Rebate Check Report
        </CardTitle>
        <CardDescription>
          View all rebateable waste types by customer from Performance Hub data (Midweigh &
          Skiptrak). This shows all customers with mapped waste types, regardless of Customer Setup
          configuration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

          <Button onClick={generateReport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>

          {generated && customerData.length > 0 && (
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>

        {generated && (
          <>
            {customerData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No rebateable waste types found for this period.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex gap-4 flex-wrap">
                  <Badge variant="secondary" className="text-base px-4 py-2">
                    {customerData.length} Customers
                  </Badge>
                  <Badge variant="secondary" className="text-base px-4 py-2">
                    {customerData.filter(c => c.isConfigured).length} Configured
                  </Badge>
                  <Badge variant="outline" className="text-base px-4 py-2 border-amber-500 text-amber-600">
                    {customerData.filter(c => !c.isConfigured).length} Not Set Up
                  </Badge>
                  <Badge variant="secondary" className="text-base px-4 py-2">
                    {grandTotalJobs.toLocaleString()} Jobs
                  </Badge>
                  <Badge variant="default" className="text-base px-4 py-2">
                    {grandTotalWeight.toFixed(2)} Tonnes Total
                  </Badge>
                </div>

                {/* Customer list */}
                <div className="space-y-2">
                  {customerData.map((customer) => {
                    const customerKey = `${customer.customer}|${customer.source}`;
                    const isExpanded = expandedCustomers.has(customerKey);

                    return (
                      <Collapsible key={customerKey} open={isExpanded}>
                        <Card className={cn(
                          "border",
                          customer.isConfigured 
                            ? "border-l-4 border-l-green-500" 
                            : "border-l-4 border-l-amber-500"
                        )}>
                          <CollapsibleTrigger
                            onClick={() => toggleCustomer(customerKey)}
                            className="w-full"
                          >
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                                <div className="text-left">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{customer.customer}</p>
                                    {customer.isConfigured ? (
                                      <Badge variant="outline" className="text-xs border-green-500 text-green-600 gap-1">
                                        <Check className="h-3 w-3" />
                                        Configured
                                        {customer.configuredSiteName && (
                                          <span className="text-muted-foreground ml-1">
                                            ({customer.configuredSiteName})
                                          </span>
                                        )}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Not Set Up
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {customer.wasteTypes.length} waste type
                                    {customer.wasteTypes.length !== 1 ? "s" : ""} •{" "}
                                    {customer.totalJobs} job{customer.totalJobs !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <Badge
                                  variant={
                                    customer.source === "skiptrak" ? "default" : "secondary"
                                  }
                                >
                                  {customer.source}
                                </Badge>
                                <span className="font-semibold text-lg">
                                  {customer.totalWeight.toFixed(2)}t
                                </span>
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="border-t px-4 pb-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Waste Description</TableHead>
                                    <TableHead>Material Type</TableHead>
                                    <TableHead className="text-right">Jobs</TableHead>
                                    <TableHead className="text-right">Weight (t)</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {customer.wasteTypes.map((wt, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{wt.waste_description}</TableCell>
                                      <TableCell>
                                        {wt.material_type ? (
                                          <Badge variant="outline">{wt.material_type}</Badge>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">{wt.job_count}</TableCell>
                                      <TableCell className="text-right font-medium">
                                        {wt.total_weight.toFixed(2)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
