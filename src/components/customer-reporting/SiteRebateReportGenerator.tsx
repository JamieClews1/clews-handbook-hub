import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, DollarSign, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LoadReportCards, LoadReportCardData } from "./LoadReportCards";
import { SkipRoroRebateTab } from "./SkipRoroRebateTab";
import { useSkipRoroRebates } from "@/hooks/useSkipRoroRebates";
import { DateRange } from "react-day-picker";

type Customer = {
  id: string;
  customer_name: string;
  customer_code: string;
};

type Site = {
  id: string;
  site_name: string;
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
};

type RebateReportRow = {
  material_name: string;
  weight_tonnes: number;
  rate_per_tonne: number;
  rebate_value: number;
  rate_source: string;
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
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<RebateReportRow[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [priceSetName, setPriceSetName] = useState("");
  const [individualReports, setIndividualReports] = useState<LoadReportCardData[]>([]);
  const [palletWeightKgState, setPalletWeightKgState] = useState(20);

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
    siteDataHubMappings
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
      .select("id, customer_name, customer_code")
      .order("customer_name");
    setCustomers(data ?? []);
  };

  const loadSites = async (customerId: string) => {
    const { data } = await supabase
      .from("customer_sites")
      .select("id, site_name, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, load_report_type")
      .eq("customer_id", customerId)
      .order("site_name");
    setSites(data ?? []);
  };

  const generateReport = async () => {
    if (!selectedSiteId) return;

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
          description: "This site doesn't have a rebate set configured. Please set one up in Customer Setup.",
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
          .select("waste_type")
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

      // Average the monthly values across the range
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

      // Get Load Report data for this site within the date range
      const periodStart = format(rangeStart, "yyyy-MM-dd");
      const periodEnd = format(rangeEnd, "yyyy-MM-dd");
      
      // Fetch load reports for this site in the selected date range
      const { data: loadReports } = await supabase
        .from("load_reports")
        .select("id, report_date, status, total_pallets, operator_name, vehicle_reg, total_weight_kg, notes")
        .eq("site_id", selectedSiteId)
        .gte("report_date", periodStart)
        .lte("report_date", periodEnd)
        .eq("status", "submitted")
        .order("report_date", { ascending: false });

      // Get pallet weight setting
      const { data: palletWeightSetting } = await supabase
        .from("load_report_settings")
        .select("setting_value")
        .eq("setting_key", "default_pallet_weight_kg")
        .single();
      
      const palletWeightKg = palletWeightSetting ? Number(palletWeightSetting.setting_value) : 20;

      // Get all line items from matching load reports
      const loadReportIds = (loadReports ?? []).map((r) => r.id);
      
      // Calculate total pallet count from all load reports
      const totalPalletCount = (loadReports ?? []).reduce((sum, r) => sum + (r.total_pallets ?? 0), 0);
      const totalPalletWeightTonnes = (totalPalletCount * palletWeightKg) / 1000;
      
      let lineItemWeights: Record<string, number> = {};
      
      // Add pallet weight charge as a special entry
      lineItemWeights["Pallet Weight Charge"] = totalPalletWeightTonnes;
      
      // Fetch individual reports with their line items for the cards
      const loadReportsWithItems: LoadReportCardData[] = [];
      
      if (loadReportIds.length > 0) {
        const { data: lineItems } = await supabase
          .from("load_line_items")
          .select("load_report_id, waste_type, pallet_count, total_weight_kg")
          .in("load_report_id", loadReportIds);
        
        // Build individual report data
        for (const report of loadReports ?? []) {
          const reportLineItems = (lineItems ?? []).filter((li) => li.load_report_id === report.id);
          loadReportsWithItems.push({
            id: report.id,
            report_date: (report as any).report_date,
            operator_name: (report as any).operator_name || "Unknown",
            vehicle_reg: (report as any).vehicle_reg || null,
            total_pallets: report.total_pallets ?? 0,
            total_weight_kg: (report as any).total_weight_kg ?? 0,
            notes: (report as any).notes || null,
            line_items: reportLineItems.map((li) => ({
              waste_type: li.waste_type,
              pallet_count: li.pallet_count,
              total_weight_kg: Number(li.total_weight_kg),
            })),
            calculated_rebate: 0, // Will be calculated by the component
          });
        }
        
        // Aggregate weights by waste type (convert kg to tonnes)
        for (const item of lineItems ?? []) {
          const weightTonnes = Number(item.total_weight_kg) / 1000;
          lineItemWeights[item.waste_type] = (lineItemWeights[item.waste_type] ?? 0) + weightTonnes;
        }
      }

      // Build report rows
      const reportRows: RebateReportRow[] = [];

      for (const config of rebateConfigs) {
        // Determine the rate
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

        // Get weight from load reports for this material
        const weight_tonnes = lineItemWeights[config.material_name] ?? 0;

        reportRows.push({
          material_name: config.material_name,
          weight_tonnes,
          rate_per_tonne: rate,
          rebate_value: weight_tonnes * rate,
          rate_source: rateSource,
        });
      }

      setReportData(reportRows);
      setIndividualReports(loadReportsWithItems);
      setPalletWeightKgState(palletWeightKg);
      setReportGenerated(true);
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
  const loadReportsTotalRebate = reportData.reduce((sum, r) => sum + r.rebate_value, 0);
  const loadReportsTotalWeight = reportData.reduce((sum, r) => sum + r.weight_tonnes, 0);

  // Combined totals (Load Reports + Skip/RoRo)
  const combinedTotalRebate = loadReportsTotalRebate + skipRoroTotalRebate;
  const combinedTotalWeight = loadReportsTotalWeight + skipRoroTotalWeight;

  // Consolidate materials into categories for the Total tab
  // Categories: Cardboard, Films, Scrap Metal, Other
  const consolidatedData = (() => {
    const categories: Record<string, { 
      weight: number; 
      rebate: number; 
      sources: { name: string; weight: number; rate: number; rebate: number; source: string }[] 
    }> = {
      "Cardboard": { weight: 0, rebate: 0, sources: [] },
      "Films": { weight: 0, rebate: 0, sources: [] },
      "Scrap Metal": { weight: 0, rebate: 0, sources: [] },
      "Other": { weight: 0, rebate: 0, sources: [] },
    };

    // Categorize Load Reports materials
    for (const row of reportData) {
      const name = row.material_name.toLowerCase();
      let category = "Other";
      
      if (name.includes("card") || name.includes("cardboard")) {
        category = "Cardboard";
      } else if (name.includes("film")) {
        category = "Films";
      } else if (name.includes("scrap") || name.includes("ferrous") || name.includes("metal")) {
        category = "Scrap Metal";
      } else if (name.includes("pallet")) {
        category = "Other"; // Pallet weight charge goes to Other
      }

      categories[category].weight += row.weight_tonnes;
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
      }));
  })();

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
          <Select
            value={selectedSiteId}
            onValueChange={setSelectedSiteId}
            disabled={!selectedCustomerId}
          >
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
          <Label>Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
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
            <PopoverContent className="w-auto p-0 z-[100] pointer-events-auto" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Button
        onClick={generateReport}
        disabled={!selectedSiteId || loading}
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
                {selectedSite?.site_name} – {dateRange?.from && format(dateRange.from, "d MMM yyyy")}
                {dateRange?.to && dateRange.to !== dateRange.from && ` to ${format(dateRange.to, "d MMM yyyy")}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                Rebate Set: <span className="font-medium">{priceSetName}</span>
              </p>
            </div>
            <div className="flex gap-4">
              <Badge variant="secondary" className="text-sm">
                {combinedTotalWeight.toFixed(2)} tonnes
              </Badge>
              <Badge variant="default" className={cn("text-sm", combinedTotalRebate >= 0 ? "bg-green-600" : "bg-red-600")}>
                £{combinedTotalRebate.toFixed(2)}
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="total" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="total">Total</TabsTrigger>
              <TabsTrigger value="load-reports">Load Reports</TabsTrigger>
              <TabsTrigger value="roro-skip">RoRo / Skip Rebates</TabsTrigger>
            </TabsList>

            <TabsContent value="total" className="mt-4">
              {consolidatedData.length > 0 ? (
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
                      {consolidatedData.map((cat, idx) => (
                        <TableRow key={idx} className="border-b">
                          <TableCell className="font-semibold align-top">{cat.category}</TableCell>
                          <TableCell className="text-right align-top font-medium">{cat.weight.toFixed(2)}</TableCell>
                          <TableCell colSpan={2} className="text-sm">
                            <div className="space-y-1">
                              {cat.sources.map((src, srcIdx) => (
                                <div key={srcIdx} className="flex justify-between text-muted-foreground">
                                  <span>{src.name}</span>
                                  <span className="ml-4">
                                    {src.weight.toFixed(2)}t @ £{src.rate.toFixed(2)} = £{src.rebate.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className={cn("text-right font-semibold align-top", cat.rebate >= 0 ? "text-green-600" : "text-red-600")}>
                            £{cat.rebate.toFixed(2)}
                        </TableCell>
                      </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
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
              ) : (
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

            <TabsContent value="load-reports" className="mt-4">
              <LoadReportCards
                reports={individualReports}
                rebateConfigs={reportData.map((r) => ({
                  material_name: r.material_name,
                  rate_per_tonne: r.rate_per_tonne,
                }))}
                palletWeightKg={palletWeightKgState}
              />
              {individualReports.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  No load reports found for this period.
                </p>
              )}
            </TabsContent>

            <TabsContent value="roro-skip" className="mt-4">
              {selectedSite && (
                <SkipRoroRebateTab
                  siteId={selectedSiteId}
                  dateRange={dateRange}
                  siteDataHubMappings={siteDataHubMappings}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
