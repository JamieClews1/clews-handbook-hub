import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Calendar as CalendarIcon, Truck, Package, ChevronDown, ChevronRight, ChevronLeft, ExternalLink, Scale } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import {
  STACI_PALLET_RATES,
  STACI_PALLET_GOOD_REBATE,
  STACI_COLOUR_CONFIG,
  StaciPalletColour,
  StaciColourSummary,
  getTotalPercentage,
  calculatePalletColour,
} from "@/components/load-reports/staci/types";

interface StaciReport {
  id: string;
  report_date: string;
  operator_name: string;
  vehicle_reg: string | null;
  notes: string | null;
  total_pallets: number;
  total_weight_kg: number;
  pallets_out: number;
  pallets_scrap_count: number;
  card_bales_count: number;
  card_bales_weight_kg: number;
  films_bale_count: number;
  films_bale_weight_kg: number;
  papers_dolav_count: number;
  papers_dolav_weight_kg: number;
  glass_dolav_count: number;
  glass_dolav_weight_kg: number;
  scrap_metal_loose_count: number;
  scrap_metal_loose_weight_kg: number;
  status: string;
  pallet_entries: {
    colour: StaciPalletColour;
    weight_kg: number;
    pallet_count: number;
    waste_breakdown: Record<string, number>;
    description: string;
  }[];
}

interface StaciLoadReportCardsProps {
  dateFrom?: string;
  dateTo?: string;
}

export const StaciLoadReportCards = ({ dateFrom: dateFromProp, dateTo: dateToProp }: StaciLoadReportCardsProps) => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateMode, setDateMode] = useState<"month" | "range">("month");
  const [customFrom, setCustomFrom] = useState<Date>(startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState<Date>(endOfMonth(new Date()));
  
  const dateFrom = dateFromProp ?? (dateMode === "month" ? format(startOfMonth(currentMonth), "yyyy-MM-dd") : format(customFrom, "yyyy-MM-dd"));
  const dateTo = dateToProp ?? (dateMode === "month" ? format(endOfMonth(currentMonth), "yyyy-MM-dd") : format(customTo, "yyyy-MM-dd"));
  const hasExternalDates = dateFromProp != null && dateToProp != null;
  
  const [reports, setReports] = useState<StaciReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [baleRates, setBaleRates] = useState<{ cardBalesRate: number; filmsRate: number }>({ cardBalesRate: 0, filmsRate: 0 });
  const palletWeightKg = 20;

  useEffect(() => {
    fetchReports();
    fetchBaleRates();
  }, [dateFrom, dateTo]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Get staci site IDs
      const { data: staciSites } = await supabase
        .from("customer_sites")
        .select("id")
        .eq("load_report_type", "staci");

      const siteIds = staciSites?.map((s) => s.id) || [];
      if (siteIds.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Fetch submitted reports
      const { data: reportData } = await supabase
        .from("load_reports")
        .select("*")
        .in("site_id", siteIds)
        .eq("status", "submitted")
        .gte("report_date", dateFrom)
        .lte("report_date", dateTo)
        .order("report_date", { ascending: false });

      if (!reportData || reportData.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Fetch pallet entries for all reports
      const reportIds = reportData.map((r) => r.id);
      const { data: palletData } = await supabase
        .from("staci_pallet_entries")
        .select("*")
        .in("load_report_id", reportIds)
        .order("display_order");

      const palletsByReport: Record<string, typeof palletData> = {};
      for (const entry of palletData || []) {
        if (!palletsByReport[entry.load_report_id]) {
          palletsByReport[entry.load_report_id] = [];
        }
        palletsByReport[entry.load_report_id].push(entry);
      }

      const mapped: StaciReport[] = reportData.map((r) => ({
        id: r.id,
        report_date: r.report_date,
        operator_name: r.operator_name,
        vehicle_reg: r.vehicle_reg,
        notes: r.notes,
        total_pallets: r.total_pallets,
        total_weight_kg: Number(r.total_weight_kg),
        pallets_out: r.pallets_out || 0,
        pallets_scrap_count: r.pallets_scrap_count || 0,
        card_bales_count: r.card_bales_count || 0,
        card_bales_weight_kg: Number(r.card_bales_weight_kg) || 0,
        films_bale_count: r.films_bale_count || 0,
        films_bale_weight_kg: Number(r.films_bale_weight_kg) || 0,
        papers_dolav_count: (r as any).papers_dolav_count || 0,
        papers_dolav_weight_kg: Number((r as any).papers_dolav_weight_kg) || 0,
        glass_dolav_count: (r as any).glass_dolav_count || 0,
        glass_dolav_weight_kg: Number((r as any).glass_dolav_weight_kg) || 0,
        scrap_metal_loose_count: (r as any).scrap_metal_loose_count || 0,
        scrap_metal_loose_weight_kg: Number((r as any).scrap_metal_loose_weight_kg) || 0,
        status: r.status,
        pallet_entries: (palletsByReport[r.id] || []).map((e: any) => ({
          colour: e.colour,
          weight_kg: Number(e.weight_kg),
          pallet_count: e.pallet_count || 1,
          waste_breakdown: e.waste_breakdown || {},
          description: e.description || "",
        })),
      }));

      setReports(mapped);
    } catch (error) {
      console.error("Error fetching staci reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBaleRates = async () => {
    try {
      const { data: staciSites } = await supabase
        .from("customer_sites")
        .select("id")
        .eq("load_report_type", "staci");
      const staciSiteId = staciSites?.[0]?.id;
      if (!staciSiteId) return;

      const { data: priceSetLink } = await supabase
        .from("customer_site_price_sets")
        .select("price_set_id")
        .eq("site_id", staciSiteId)
        .single();
      if (!priceSetLink?.price_set_id) return;

      const { data: psItems } = await supabase
        .from("rebate_price_set_items")
        .select("rebate_item_id, value_type, set_value, adjustment, value_type_item_id")
        .eq("price_set_id", priceSetLink.price_set_id);

      const { data: wasteTypes } = await supabase
        .from("load_waste_types")
        .select("id, waste_type")
        .in("waste_type", ["Card Bales", "Films Baled- Clear", "Films Baled- Mixed Colour"]);

      const wasteTypeMap = Object.fromEntries((wasteTypes ?? []).map(w => [w.id, w.waste_type]));

      const dfrom = new Date(dateFrom);
      const dto = new Date(dateTo);
      const monthsInRange = eachMonthOfInterval({ start: dfrom, end: dto });
      const monthStarts = monthsInRange.map(m => format(startOfMonth(m), "yyyy-MM-dd"));
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

      let cardRate = 0;
      let filmsRate = 0;
      for (const item of psItems ?? []) {
        const wtName = wasteTypeMap[item.rebate_item_id];
        if (!wtName) continue;
        let rate = 0;
        if (item.value_type === "set" && item.set_value != null) {
          rate = Number(item.set_value);
        } else if (item.value_type_item_id) {
          const acc = valueAccumulator[item.value_type_item_id];
          if (acc && acc.count > 0) {
            const avgVal = item.value_type === "higher" ? acc.higherSum / acc.count : acc.lowerSum / acc.count;
            rate = avgVal;
          }
        }
        rate += Number(item.adjustment ?? 0);
        if (wtName === "Card Bales") cardRate = rate;
        if (wtName.startsWith("Films Baled")) filmsRate = rate;
      }
      setBaleRates({ cardBalesRate: cardRate, filmsRate });
    } catch (e) {
      console.error("Failed to fetch bale rates:", e);
    }
  };

  const toggleCard = (id: string) => {
    setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const buildSummaries = (report: StaciReport) => {
    const colourMap = new Map<StaciPalletColour, { count: number; weight: number }>();

    for (const entry of report.pallet_entries) {
      const palletCount = entry.pallet_count || 1;
      const colour = entry.colour as StaciPalletColour;
      const existing = colourMap.get(colour) || { count: 0, weight: 0 };
      colourMap.set(colour, {
        count: existing.count + palletCount,
        weight: existing.weight + entry.weight_kg * palletCount,
      });
    }

    const summaries: StaciColourSummary[] = [];
    let totalPallets = 0;
    let totalWeightKg = 0;
    let totalValue = 0;

    for (const [colour, data] of colourMap) {
      const rate = STACI_PALLET_RATES[colour];
      const value = colour === "waste_wood" ? (data.weight / 1000) * rate : data.count * rate;

      summaries.push({
        colour,
        palletCount: data.count,
        totalWeightKg: data.weight,
        ratePerPallet: rate,
        totalValue: value,
      });

      totalPallets += data.count;
      totalWeightKg += data.weight;
      totalValue += value;
    }

    const colourOrder: StaciPalletColour[] = ["red", "yellow", "blue", "green", "waste_wood"];
    summaries.sort((a, b) => colourOrder.indexOf(a.colour) - colourOrder.indexOf(b.colour));

    const palletRebate = report.pallets_out * STACI_PALLET_GOOD_REBATE;
    const netTotal = totalValue - palletRebate;

    return { summaries, totalPallets, totalWeightKg, totalValue, netTotal, palletRebate };
  };

  // Period totals
  const periodTotals = useMemo(() => {
    let pallets = 0;
    let weightKg = 0;
    let grossValue = 0;
    let palletRebate = 0;

    for (const report of reports) {
      const s = buildSummaries(report);
      pallets += s.totalPallets;
      weightKg += s.totalWeightKg;
      grossValue += s.totalValue;
      palletRebate += s.palletRebate;
    }

    return { pallets, weightKg, grossValue, netValue: grossValue - palletRebate, palletRebate };
  }, [reports]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
        <p className="text-muted-foreground">Loading Staci reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Period selector (only when no external dates provided) */}
      {!hasExternalDates && (
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center gap-4">
            <Select value={dateMode} onValueChange={(v) => {
              const mode = v as "month" | "range";
              setDateMode(mode);
              if (mode === "month") {
                setCurrentMonth(customFrom);
              } else {
                setCustomFrom(startOfMonth(currentMonth));
                setCustomTo(endOfMonth(currentMonth));
              }
            }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="range">Date Range</SelectItem>
              </SelectContent>
            </Select>

            {dateMode === "month" ? (
              <>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[120px] text-center">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-muted-foreground">Period:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(customFrom, "dd MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={(d) => d && setCustomFrom(d)} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(customTo, "dd MMM yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={(d) => d && setCustomTo(d)} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Period summary */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{reports.length}</p>
              <p className="text-xs text-muted-foreground">Loads</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{periodTotals.pallets}</p>
              <p className="text-xs text-muted-foreground">Pallets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{(periodTotals.weightKg / 1000).toFixed(2)}t</p>
              <p className="text-xs text-muted-foreground">Weight</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${periodTotals.netValue < 0 ? "text-green-600" : "text-orange-600"}`}>
                {periodTotals.netValue < 0 ? "-" : ""}£{Math.abs(periodTotals.netValue).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Net Cost</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report cards */}
      {reports.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No Staci load reports found for this period.
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Individual Load Reports ({reports.length})
          </h4>
          {reports.map((report) => {
            const isOpen = openCards[report.id] ?? false;
            const { summaries, totalPallets, totalWeightKg, totalValue, netTotal, palletRebate } = buildSummaries(report);

            return (
              <Collapsible key={report.id} open={isOpen} onOpenChange={() => toggleCard(report.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{format(new Date(report.report_date), "dd MMM yyyy")}</span>
                          </div>
                          {report.vehicle_reg && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Truck className="h-3 w-3" />
                              {report.vehicle_reg}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Package className="h-3 w-3" />
                            {report.operator_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {totalPallets} pallets
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {((totalWeightKg + (report.card_bales_count || 0) * (report.card_bales_weight_kg || 0) + (report.films_bale_count || 0) * (report.films_bale_weight_kg || 0) + (report.papers_dolav_count || 0) * (report.papers_dolav_weight_kg || 0) + (report.glass_dolav_count || 0) * (report.glass_dolav_weight_kg || 0) + (report.scrap_metal_loose_count || 0) * (report.scrap_metal_loose_weight_kg || 0)) / 1000).toFixed(2)}t
                          </Badge>
                          <Badge
                            variant="default"
                            className={cn("text-xs", netTotal < 0 ? "bg-green-600" : "bg-orange-600")}
                          >
                            {netTotal < 0 ? "-" : ""}£{Math.abs(netTotal).toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                      {report.notes && (
                        <p className="text-xs text-muted-foreground ml-7 mt-1">Job: {report.notes}</p>
                      )}
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-3 px-4 space-y-3">
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/load-reports?edit=${report.id}`);
                          }}
                          className="text-xs"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open & Edit Report
                        </Button>
                      </div>

                      {/* Colour breakdown table */}
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-xs">Colour</TableHead>
                              <TableHead className="text-xs text-right">Pallets</TableHead>
                              <TableHead className="text-xs text-right">Weight (KG)</TableHead>
                              <TableHead className="text-xs text-right">Rate</TableHead>
                              <TableHead className="text-xs text-right">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summaries.map((s) => {
                              const config = STACI_COLOUR_CONFIG[s.colour];
                              return (
                                <TableRow key={s.colour}>
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded ${config.bgColor}`} />
                                      <span className="text-sm">{config.label}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{s.palletCount}</TableCell>
                                  <TableCell className="text-right text-sm">{s.totalWeightKg.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-sm">
                                    {s.ratePerPallet < 0 ? (
                                      <span className="text-green-600">-£{Math.abs(s.ratePerPallet).toFixed(2)}</span>
                                    ) : (
                                      `£${s.ratePerPallet.toFixed(2)}`
                                    )}
                                  </TableCell>
                                  <TableCell className={cn("text-right text-sm font-medium", s.totalValue < 0 && "text-green-600")}>
                                    {s.totalValue < 0 ? "-" : ""}£{Math.abs(s.totalValue).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {report.pallets_out > 0 && (
                              <TableRow>
                                <TableCell className="py-2 text-sm text-muted-foreground">Good Pallet Rebate</TableCell>
                                <TableCell className="text-right text-sm text-green-600">{report.pallets_out}</TableCell>
                                <TableCell className="text-right text-sm">-</TableCell>
                                <TableCell className="text-right text-sm text-green-600">-£{STACI_PALLET_GOOD_REBATE.toFixed(2)}</TableCell>
                                <TableCell className="text-right text-sm font-medium text-green-600">-£{palletRebate.toFixed(2)}</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                          <TableFooter>
                            <TableRow className="font-bold">
                              <TableCell>Net Total</TableCell>
                              <TableCell className="text-right">{totalPallets}</TableCell>
                              <TableCell className="text-right">{totalWeightKg.toLocaleString()}</TableCell>
                              <TableCell />
                              <TableCell className={cn("text-right", netTotal < 0 ? "text-green-600" : "")}>
                                {netTotal < 0 ? "-" : ""}£{Math.abs(netTotal).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>

                      {/* Bales & Dolavs breakdown */}
                      {(report.card_bales_count > 0 || report.films_bale_count > 0 || report.papers_dolav_count > 0 || report.glass_dolav_count > 0 || report.pallets_scrap_count > 0) && (
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-xs">Item</TableHead>
                                <TableHead className="text-xs text-right">Qty</TableHead>
                                <TableHead className="text-xs text-right">Weight (KG)</TableHead>
                                <TableHead className="text-xs text-right">Rate</TableHead>
                                <TableHead className="text-xs text-right">Value</TableHead>
                                <TableHead className="text-xs text-right">Category</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {report.card_bales_count > 0 && (() => {
                                const totalWt = report.card_bales_count * report.card_bales_weight_kg;
                                const tonnes = totalWt / 1000;
                                const value = tonnes * baleRates.cardBalesRate;
                                return (
                                  <TableRow>
                                    <TableCell className="py-2 text-sm">Card Bales</TableCell>
                                    <TableCell className="text-right text-sm">{report.card_bales_count}</TableCell>
                                    <TableCell className="text-right text-sm">{totalWt.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-sm text-green-600">
                                      {baleRates.cardBalesRate !== 0 ? `-£${Math.abs(baleRates.cardBalesRate).toFixed(2)}/t` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-medium text-green-600">
                                      {baleRates.cardBalesRate !== 0 ? `-£${value.toFixed(2)}` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right"><Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">Rebate</Badge></TableCell>
                                  </TableRow>
                                );
                              })()}
                              {report.films_bale_count > 0 && (() => {
                                const totalWt = report.films_bale_count * report.films_bale_weight_kg;
                                const tonnes = totalWt / 1000;
                                const value = tonnes * baleRates.filmsRate;
                                return (
                                  <TableRow>
                                    <TableCell className="py-2 text-sm">Film Bales</TableCell>
                                    <TableCell className="text-right text-sm">{report.films_bale_count}</TableCell>
                                    <TableCell className="text-right text-sm">{totalWt.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-sm text-green-600">
                                      {baleRates.filmsRate !== 0 ? `-£${Math.abs(baleRates.filmsRate).toFixed(2)}/t` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-medium text-green-600">
                                      {baleRates.filmsRate !== 0 ? `-£${value.toFixed(2)}` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right"><Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">Rebate</Badge></TableCell>
                                  </TableRow>
                                );
                              })()}
                              {report.papers_dolav_count > 0 && (
                                <TableRow>
                                  <TableCell className="py-2 text-sm">Papers Dolav</TableCell>
                                  <TableCell className="text-right text-sm">{report.papers_dolav_count}</TableCell>
                                  <TableCell className="text-right text-sm">{(report.papers_dolav_count * report.papers_dolav_weight_kg).toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-sm">-</TableCell>
                                  <TableCell className="text-right text-sm">-</TableCell>
                                  <TableCell className="text-right"><Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">Rebate</Badge></TableCell>
                                </TableRow>
                              )}
                              {report.glass_dolav_count > 0 && (
                                <TableRow>
                                  <TableCell className="py-2 text-sm">Glass Dolav</TableCell>
                                  <TableCell className="text-right text-sm">{report.glass_dolav_count}</TableCell>
                                  <TableCell className="text-right text-sm">{(report.glass_dolav_count * report.glass_dolav_weight_kg).toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-sm">-</TableCell>
                                  <TableCell className="text-right text-sm">-</TableCell>
                                  <TableCell className="text-right"><Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">Rebate</Badge></TableCell>
                                </TableRow>
                              )}
                              {report.pallets_scrap_count > 0 && (
                                <TableRow>
                                  <TableCell className="py-2 text-sm">Scrap Pallets</TableCell>
                                  <TableCell className="text-right text-sm">{report.pallets_scrap_count}</TableCell>
                                  <TableCell className="text-right text-sm">-</TableCell>
                                  <TableCell className="text-right text-sm">-</TableCell>
                                  <TableCell className="text-right text-sm">-</TableCell>
                                  <TableCell className="text-right"><Badge variant="outline" className="text-xs">Scrap</Badge></TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                            <TableFooter>
                              {(() => {
                                const cardValue = (report.card_bales_count * report.card_bales_weight_kg / 1000) * baleRates.cardBalesRate;
                                const filmsValue = (report.films_bale_count * report.films_bale_weight_kg / 1000) * baleRates.filmsRate;
                                const totalRebate = cardValue + filmsValue;
                                return (
                                  <TableRow className="font-bold">
                                    <TableCell>Total</TableCell>
                                    <TableCell className="text-right">
                                      {report.card_bales_count + report.films_bale_count + report.papers_dolav_count + report.glass_dolav_count + report.pallets_scrap_count}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {(report.card_bales_count * report.card_bales_weight_kg + report.films_bale_count * report.films_bale_weight_kg + report.papers_dolav_count * report.papers_dolav_weight_kg + report.glass_dolav_count * report.glass_dolav_weight_kg).toLocaleString()}
                                    </TableCell>
                                    <TableCell />
                                    <TableCell className="text-right font-medium text-green-600">
                                      {totalRebate > 0 ? `-£${totalRebate.toFixed(2)}` : "-"}
                                    </TableCell>
                                    <TableCell />
                                  </TableRow>
                                );
                              })()}
                            </TableFooter>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
};
