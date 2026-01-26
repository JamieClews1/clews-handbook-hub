import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, DollarSign, Loader2, FileSpreadsheet } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

type Site = {
  id: string;
  site_name: string;
  data_hub_site: string | null;
  data_hub_site_2: string | null;
  data_hub_site_3: string | null;
  data_hub_site_4: string | null;
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

interface CustomerPortalRebateReportProps {
  customerId: string;
  customerName: string;
}

export function CustomerPortalRebateReport({ customerId, customerName }: CustomerPortalRebateReportProps) {
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<RebateReportRow[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [priceSetName, setPriceSetName] = useState("");

  useEffect(() => {
    loadSites();
  }, [customerId]);

  const loadSites = async () => {
    // RLS will filter to only sites the portal user has access to
    const { data } = await supabase
      .from("customer_sites")
      .select("id, site_name, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, load_report_type")
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
          .select("waste_type")
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
      
      const { data: loadReports } = await supabase
        .from("load_reports")
        .select("id, report_date, status, total_pallets")
        .eq("site_id", selectedSiteId)
        .gte("report_date", monthStart)
        .lte("report_date", monthEnd)
        .eq("status", "submitted");

      const { data: palletWeightSetting } = await supabase
        .from("load_report_settings")
        .select("setting_value")
        .eq("setting_key", "default_pallet_weight_kg")
        .single();
      
      const palletWeightKg = palletWeightSetting ? Number(palletWeightSetting.setting_value) : 20;

      const loadReportIds = (loadReports ?? []).map((r) => r.id);
      
      const totalPalletCount = (loadReports ?? []).reduce((sum, r) => sum + (r.total_pallets ?? 0), 0);
      const totalPalletWeightTonnes = (totalPalletCount * palletWeightKg) / 1000;
      
      let lineItemWeights: Record<string, number> = {};
      
      lineItemWeights["Pallet Weight Charge"] = totalPalletWeightTonnes;
      
      if (loadReportIds.length > 0) {
        const { data: lineItems } = await supabase
          .from("load_line_items")
          .select("waste_type, total_weight_kg")
          .in("load_report_id", loadReportIds);
        
        for (const item of lineItems ?? []) {
          const weightTonnes = Number(item.total_weight_kg) / 1000;
          lineItemWeights[item.waste_type] = (lineItemWeights[item.waste_type] ?? 0) + weightTonnes;
        }
      }

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

  const exportToExcel = () => {
    if (!selectedSite) return;

    const wb = XLSX.utils.book_new();

    const headerData = [
      ["Rebate Report"],
      [],
      ["Customer:", customerName],
      ["Site:", selectedSite.site_name],
      ["Month:", format(selectedMonth, "MMMM yyyy")],
      ["Rebate Set:", priceSetName],
      ["Generated:", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Total Weight (t):", totalWeight.toFixed(2)],
      ["Total Rebate (£):", totalRebate.toFixed(2)],
      [],
      [],
    ];

    const detailHeaders = ["Material", "Weight (t)", "Rate (£/t)", "Rate Source", "Value (£)"];
    const detailData = reportData.map((row) => [
      row.material_name,
      row.weight_tonnes.toFixed(2),
      row.rate_per_tonne !== 0 ? row.rate_per_tonne.toFixed(2) : "-",
      row.rate_source,
      row.rebate_value.toFixed(2),
    ]);

    // Add total row
    detailData.push([
      "Total",
      totalWeight.toFixed(2),
      "",
      "",
      totalRebate.toFixed(2),
    ]);

    const wsData = [...headerData, detailHeaders, ...detailData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Rebate Report");

    const fileName = `${customerName}_${selectedSite.site_name}_Rebate_${format(selectedMonth, "yyyyMM")}.xlsx`;
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
            <PopoverContent className="w-auto p-0" align="start">
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

      <div className="flex gap-2 flex-wrap">
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

          <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Data Source:</p>
            <p>
              Weights are pulled from submitted Load Reports linked to this site for {format(selectedMonth, "MMMM yyyy")}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
