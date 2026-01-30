import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, DollarSign, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LoadReportCards, LoadReportCardData } from "./LoadReportCards";
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
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<RebateReportRow[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [priceSetName, setPriceSetName] = useState("");
  const [individualReports, setIndividualReports] = useState<LoadReportCardData[]>([]);
  const [palletWeightKgState, setPalletWeightKgState] = useState(20);

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

      // Get monthly values for the selected month
      const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const { data: monthlyValues } = await supabase
        .from("rebate_monthly_values")
        .select("item_id, lower_range, higher_range")
        .eq("month_start", monthStart);

      const monthlyValueMap: Record<string, { lower: number; higher: number }> = {};
      for (const mv of monthlyValues ?? []) {
        monthlyValueMap[mv.item_id] = {
          lower: mv.lower_range ?? 0,
          higher: mv.higher_range ?? 0,
        };
      }

      // Get Load Report data for this site/month
      const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
      
      // Fetch load reports for this site in the selected month
      const { data: loadReports } = await supabase
        .from("load_reports")
        .select("id, report_date, status, total_pallets, operator_name, vehicle_reg, total_weight_kg, notes")
        .eq("site_id", selectedSiteId)
        .gte("report_date", monthStart)
        .lte("report_date", monthEnd)
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

  const totalRebate = reportData.reduce((sum, r) => sum + r.rebate_value, 0);
  const totalWeight = reportData.reduce((sum, r) => sum + r.weight_tonnes, 0);

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

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
          <Label>Month</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedMonth && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedMonth, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto z-50" align="start">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => date && setSelectedMonth(startOfMonth(date))}
                initialFocus
                className="pointer-events-auto"
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
                {selectedSite?.site_name} - {format(selectedMonth, "MMMM yyyy")}
              </h3>
              <p className="text-sm text-muted-foreground">
                Rebate Set: <span className="font-medium">{priceSetName}</span>
              </p>
            </div>
            <div className="flex gap-4">
              <Badge variant="secondary" className="text-sm">
                {totalWeight.toFixed(2)} tonnes
              </Badge>
              <Badge variant="default" className={cn("text-sm", totalRebate >= 0 ? "bg-green-600" : "bg-red-600")}>
                £{totalRebate.toFixed(2)}
              </Badge>
            </div>
          </div>

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
                    <TableCell className="text-right">{totalWeight.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className={cn("text-right", totalRebate >= 0 ? "text-green-600" : "text-red-600")}>
                      £{totalRebate.toFixed(2)}
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

          <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Data Source:</p>
            <p>
              Weights are pulled from submitted Load Reports linked to this site for {format(selectedMonth, "MMMM yyyy")}.
              Make sure Load Reports have the correct site selected when created.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
