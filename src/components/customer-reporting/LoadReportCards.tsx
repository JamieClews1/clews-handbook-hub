import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Calendar, Truck, Package, AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export type LoadReportCardData = {
  id: string;
  report_date: string;
  operator_name: string;
  vehicle_reg: string | null;
  total_pallets: number;
  total_weight_kg: number;
  notes: string | null;
  no_pallets_on_load?: boolean | null;
  wet_charge_percent?: number | null;
  line_items: {
    waste_type: string;
    pallet_count: number;
    total_weight_kg: number;
    wet_charge_applied?: boolean;
  }[];
  calculated_rebate: number;
  weighbridge_weight_kg?: number | null;
};

interface LoadReportCardsProps {
  reports: LoadReportCardData[];
  rebateConfigs: {
    material_name: string;
    rate_per_tonne: number;
  }[];
  palletWeightKg?: number;
  palletChargeRate?: number; // Rate per pallet (e.g., -£47)
  onEditReport?: (reportId: string) => void;
}

export function LoadReportCards({ reports, rebateConfigs, palletWeightKg = 20, palletChargeRate = 0, onEditReport }: LoadReportCardsProps) {
  const navigate = useNavigate();
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [minimumWeightThreshold, setMinimumWeightThreshold] = useState<number>(1.5);
  const [thresholdEnabled, setThresholdEnabled] = useState<boolean>(true);
  const [fetchedPalletChargeRate, setFetchedPalletChargeRate] = useState<number | null>(null);

  // Fetch rebate rules
  useEffect(() => {
    const fetchRules = async () => {
      const { data } = await supabase
        .from("rebate_rules")
        .select("rule_key, rule_value, is_enabled")
        .eq("rule_key", "minimum_weight_threshold")
        .maybeSingle();

      if (data) {
        setMinimumWeightThreshold(Number(data.rule_value) || 1.5);
        setThresholdEnabled(data.is_enabled ?? true);
      }
    };
    fetchRules();
  }, []);

  // Look up pallet charge rate from rebate configs if not passed
  useEffect(() => {
    // Check for a "Pallet" or "Pallet Charge" material in the rebate configs
    const palletConfig = rebateConfigs.find(
      (c) => c.material_name.toLowerCase().includes("pallet")
    );
    if (palletConfig) {
      setFetchedPalletChargeRate(palletConfig.rate_per_tonne);
    }
  }, [rebateConfigs]);

  // The effective pallet charge rate (prop takes priority, else fetched from configs)
  const effectivePalletChargeRate = palletChargeRate !== 0 ? palletChargeRate : (fetchedPalletChargeRate ?? 0);

  const toggleCard = (id: string) => {
    setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Create a rate lookup map
  const rateMap: Record<string, number> = {};
  for (const config of rebateConfigs) {
    rateMap[config.material_name] = config.rate_per_tonne;
  }

  const isNoPalletsOnLoad = (report: LoadReportCardData) => !!report.no_pallets_on_load;

  // Filter out any legacy "Pallet Weight Charge" line items if they exist
  const filterLineItems = (items: LoadReportCardData["line_items"]) => {
    return items.filter((item) => !item.waste_type.toLowerCase().includes("pallet weight"));
  };

  // Total pallets are derived from line items to ensure deductions are truly "line-by-line"
  const calculateLineItemPallets = (report: LoadReportCardData) => {
    if (isNoPalletsOnLoad(report)) return 0;
    return filterLineItems(report.line_items).reduce(
      (sum, item) => sum + (Number(item.pallet_count) || 0),
      0,
    );
  };

  // Calculate pallet weight for a report (in tonnes)
  const calculatePalletWeight = (report: LoadReportCardData) => {
    const pallets = calculateLineItemPallets(report);
    return (pallets * palletWeightKg) / 1000;
  };

  // Calculate gross weight (total of all material weights)
  const calculateGrossWeight = (report: LoadReportCardData) => {
    let gross = 0;
    for (const item of filterLineItems(report.line_items)) {
      gross += item.total_weight_kg / 1000;
    }
    return gross;
  };

  // Calculate net weight (gross minus pallet weight)
  const calculateNetWeight = (report: LoadReportCardData) => {
    const gross = calculateGrossWeight(report);
    const palletWeight = calculatePalletWeight(report);
    return gross - palletWeight;
  };

  // Check if weight is below threshold
  const isBelowThreshold = (report: LoadReportCardData) => {
    if (!thresholdEnabled) return false;
    const netWeight = calculateNetWeight(report);
    return netWeight < minimumWeightThreshold;
  };

  // Check if load report weight doesn't match weighbridge weight (tolerance of 50kg)
  const needsReconciliation = (report: LoadReportCardData) => {
    if (report.weighbridge_weight_kg == null) return false;
    const loadReportWeightKg = report.total_weight_kg;
    const difference = Math.abs(loadReportWeightKg - report.weighbridge_weight_kg);
    return difference > 50; // 50kg tolerance
  };

  const calcLinePalletWeightKg = (report: LoadReportCardData, item: LoadReportCardData["line_items"][number]) => {
    if (isNoPalletsOnLoad(report)) return 0;
    const pallets = Number(item.pallet_count) || 0;
    return pallets * palletWeightKg;
  };

  const calcLineActualWeightKg = (report: LoadReportCardData, item: LoadReportCardData["line_items"][number]) => {
    const grossKg = Number(item.total_weight_kg) || 0;
    const palletKg = calcLinePalletWeightKg(report, item);
    return Math.max(0, grossKg - palletKg);
  };

  // Calculate pallet charge value for a report (rate per tonne × pallet weight in tonnes)
  const calculatePalletChargeValue = (report: LoadReportCardData) => {
    if (isNoPalletsOnLoad(report)) return 0;
    const palletWeightTonnes = calculatePalletWeight(report); // Already in tonnes
    return palletWeightTonnes * effectivePalletChargeRate;
  };

  // Calculate rebate for a single report (rebate on actual recyclable/waste weight + pallet charge)
  // Applies wet charge discount to affected line items
  const calculateReportRebate = (report: LoadReportCardData) => {
    if (isBelowThreshold(report)) return 0;

    const wetChargePercent = report.wet_charge_percent ?? 0;
    
    let rebate = 0;
    for (const item of filterLineItems(report.line_items)) {
      const rate = rateMap[item.waste_type] ?? 0;
      const actualKg = calcLineActualWeightKg(report, item);
      let lineRebate = (actualKg / 1000) * rate;
      
      // Apply wet charge discount if this line item is affected
      if (item.wet_charge_applied && wetChargePercent > 0) {
        lineRebate = lineRebate * (1 - wetChargePercent / 100);
      }
      
      rebate += lineRebate;
    }

    // Add pallet charge (usually negative)
    rebate += calculatePalletChargeValue(report);

    return rebate;
  };

  // Calculate totals for a report (gross/pallet/actual + value including pallet charge)
  // Applies wet charge discount to affected line items
  const calculateTotals = (report: LoadReportCardData) => {
    const filteredItems = filterLineItems(report.line_items);
    const belowThreshold = isBelowThreshold(report);
    const wetChargePercent = report.wet_charge_percent ?? 0;

    let totalPallets = 0;
    let totalGrossKg = 0;
    let totalPalletWeightKg = 0;
    let totalActualKg = 0;
    let totalValue = 0;

    for (const item of filteredItems) {
      const rate = rateMap[item.waste_type] ?? 0;
      const grossKg = Number(item.total_weight_kg) || 0;
      const palletKg = calcLinePalletWeightKg(report, item);
      const actualKg = Math.max(0, grossKg - palletKg);

      totalPallets += Number(item.pallet_count) || 0;
      totalGrossKg += grossKg;
      totalPalletWeightKg += palletKg;
      totalActualKg += actualKg;

      if (!belowThreshold) {
        let lineValue = (actualKg / 1000) * rate;
        // Apply wet charge discount if this line item is affected
        if (item.wet_charge_applied && wetChargePercent > 0) {
          lineValue = lineValue * (1 - wetChargePercent / 100);
        }
        totalValue += lineValue;
      }
    }

    // Add pallet charge to total value
    if (!belowThreshold) {
      totalValue += calculatePalletChargeValue(report);
    }

    return { totalPallets, totalGrossKg, totalPalletWeightKg, totalActualKg, totalValue };
  };

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No load reports found for the selected period.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        Individual Load Reports ({reports.length})
      </h4>

      {reports.map((report) => {
        const isOpen = openCards[report.id] ?? false;
        const reportRebate = calculateReportRebate(report);
        const belowThreshold = isBelowThreshold(report);
        const grossWeight = calculateGrossWeight(report);
        const palletWeight = calculatePalletWeight(report);
        const lineItemPallets = calculateLineItemPallets(report);
        const netWeight = calculateNetWeight(report);
        const requiresReconciliation = needsReconciliation(report);

        return (
          <Collapsible key={report.id} open={isOpen} onOpenChange={() => toggleCard(report.id)}>
            <Card
              className={cn(
                "overflow-hidden",
                belowThreshold && "border-amber-300 bg-amber-50/30",
                requiresReconciliation && !belowThreshold && "border-orange-400 bg-orange-50/30",
              )}
            >
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
                        <Calendar className="h-4 w-4 text-muted-foreground" />
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
                    <div className="flex items-center flex-wrap justify-end gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {grossWeight.toFixed(2)} t
                      </Badge>

                      {!isNoPalletsOnLoad(report) && palletWeight > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Pallets {lineItemPallets} (-{Math.round(palletWeight * 1000).toLocaleString()} kg)
                        </Badge>
                      )}

                      <Badge variant="secondary" className="text-xs">
                        Actual {Math.round(Math.max(0, netWeight) * 1000).toLocaleString()} kg
                      </Badge>
                      {requiresReconciliation && (
                        <Badge
                          variant="outline"
                          className="text-xs border-orange-500 text-orange-700 bg-orange-100"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Needs Reconciliation
                        </Badge>
                      )}
                      {belowThreshold ? (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 bg-amber-100">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Below threshold
                        </Badge>
                      ) : (
                        <Badge
                          variant="default"
                          className={cn("text-xs", reportRebate >= 0 ? "bg-green-600" : "bg-red-600")}
                        >
                          £{reportRebate.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {report.notes && (
                    <p className="text-xs text-muted-foreground ml-7 mt-1">Job: {report.notes}</p>
                  )}
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4 space-y-3">
                  {/* Edit Button */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditReport) {
                          onEditReport(report.id);
                        } else {
                          navigate(`/load-reports?edit=${report.id}`);
                        }
                      }}
                      className="text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open & Edit Report
                    </Button>
                  </div>

                  {/* Reconciliation Warning */}
                  {requiresReconciliation && (
                    <div className="flex items-center gap-2 text-orange-700 bg-orange-100 rounded-md py-2 px-3">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="font-medium">Weight mismatch detected:</span>{" "}
                        Load report shows {(report.total_weight_kg / 1000).toFixed(2)}t but weighbridge shows
                        {" "}
                        {((report.weighbridge_weight_kg ?? 0) / 1000).toFixed(2)}t.
                        <span className="font-medium"> Reconciliation required.</span>
                      </div>
                    </div>
                  )}

                  {/* Weight Breakdown Summary */}
                  <div className="bg-muted/30 rounded-md p-3 text-sm">
                    <div
                      className={cn(
                        "grid gap-4 text-center",
                        report.weighbridge_weight_kg != null ? "grid-cols-4" : "grid-cols-3",
                      )}
                    >
                      <div>
                        <p className="text-muted-foreground text-xs">Gross Weight</p>
                        <p className="font-semibold">{grossWeight.toFixed(2)} t</p>
                      </div>
                      {report.weighbridge_weight_kg != null && (
                        <div>
                          <p className="text-muted-foreground text-xs">Weighbridge</p>
                          <p
                            className={cn(
                              "font-semibold",
                              requiresReconciliation ? "text-orange-600" : "text-green-600",
                            )}
                          >
                            {(report.weighbridge_weight_kg / 1000).toFixed(2)} t
                          </p>
                        </div>
                      )}
                      <div>
                          <p className="text-muted-foreground text-xs">
                            Pallet Weight ({isNoPalletsOnLoad(report) ? 0 : lineItemPallets} × {palletWeightKg}kg)
                          </p>
                        <p className="font-semibold text-amber-600">-{palletWeight.toFixed(2)} t</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Net Weight</p>
                        <p className={cn("font-semibold", belowThreshold ? "text-amber-600" : "text-green-600")}>
                          {netWeight.toFixed(2)} t
                        </p>
                      </div>
                    </div>
                    {belowThreshold && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-amber-700 bg-amber-100 rounded-md py-2 px-3">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs font-medium">
                          No rebate due - net weight below {minimumWeightThreshold}T minimum threshold
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs py-2">Material</TableHead>
                          <TableHead className="text-xs py-2 text-right">Pallets</TableHead>
                          <TableHead className="text-xs py-2 text-right">Gross (kg)</TableHead>
                          <TableHead className="text-xs py-2 text-right">Total Pallet Weight (kg)</TableHead>
                          <TableHead className="text-xs py-2 text-right">Actual Recyclable/Waste (kg)</TableHead>
                          <TableHead className="text-xs py-2 text-right">Rate (£/t)</TableHead>
                          <TableHead className="text-xs py-2 text-right">Value (£)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterLineItems(report.line_items).map((item, idx) => {
                          const rate = rateMap[item.waste_type] ?? 0;
                          const grossKg = Number(item.total_weight_kg) || 0;
                          const palletKg = calcLinePalletWeightKg(report, item);
                          const actualKg = Math.max(0, grossKg - palletKg);
                          const wetChargePercent = report.wet_charge_percent ?? 0;
                          const hasWetCharge = item.wet_charge_applied && wetChargePercent > 0;
                          let value = belowThreshold ? 0 : (actualKg / 1000) * rate;
                          if (!belowThreshold && hasWetCharge) {
                            value = value * (1 - wetChargePercent / 100);
                          }

                          return (
                            <TableRow key={idx} className={cn(belowThreshold && "opacity-60", hasWetCharge && !belowThreshold && "bg-blue-50/50")}>
                              <TableCell className="text-xs py-1.5">
                                {item.waste_type}
                                {hasWetCharge && (
                                  <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 border-blue-400 text-blue-600">
                                    -{wetChargePercent}%
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-right">{item.pallet_count}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">{Math.round(grossKg).toLocaleString()}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">{Math.round(palletKg).toLocaleString()}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right font-medium">{Math.round(actualKg).toLocaleString()}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">
                                {rate !== 0 ? `£${rate.toFixed(2)}` : "-"}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-xs py-1.5 text-right font-medium",
                                  belowThreshold
                                    ? "text-muted-foreground"
                                    : value >= 0
                                      ? "text-green-600"
                                      : "text-red-600",
                                )}
                              >
                                {belowThreshold ? "-" : `£${value.toFixed(2)}`}
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Pallet Charge Row */}
                        {!isNoPalletsOnLoad(report) && effectivePalletChargeRate !== 0 && (() => {
                          const palletCount = calculateLineItemPallets(report);
                          const palletWeightT = calculatePalletWeight(report);
                          const palletChargeValue = calculatePalletChargeValue(report);
                          return (
                            <TableRow className={cn("bg-amber-50/50 border-t", belowThreshold && "opacity-60")}>
                              <TableCell className="text-xs py-1.5 font-medium">Pallet Charge</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">{palletCount}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">-</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">-</TableCell>
                              <TableCell className="text-xs py-1.5 text-right font-medium">
                                {palletWeightT.toFixed(2)} t
                              </TableCell>
                              <TableCell className="text-xs py-1.5 text-right">
                                £{effectivePalletChargeRate.toFixed(2)}/t
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-xs py-1.5 text-right font-medium",
                                  belowThreshold
                                    ? "text-muted-foreground"
                                    : palletChargeValue >= 0
                                      ? "text-green-600"
                                      : "text-red-600",
                                )}
                              >
                                {belowThreshold ? "-" : `£${palletChargeValue.toFixed(2)}`}
                              </TableCell>
                            </TableRow>
                          );
                        })()}

                        {/* Totals Row */}
                        {(() => {
                          const totals = calculateTotals(report);
                          return (
                            <TableRow className="bg-muted/50 font-semibold border-t-2">
                              <TableCell className="text-xs py-2">Total</TableCell>
                              <TableCell className="text-xs py-2 text-right">{totals.totalPallets}</TableCell>
                              <TableCell className="text-xs py-2 text-right">
                                {Math.round(totals.totalGrossKg).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs py-2 text-right">
                                {Math.round(totals.totalPalletWeightKg).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs py-2 text-right">
                                {Math.round(totals.totalActualKg).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs py-2 text-right"></TableCell>
                              <TableCell
                                className={cn(
                                  "text-xs py-2 text-right",
                                  belowThreshold
                                    ? "text-muted-foreground"
                                    : totals.totalValue >= 0
                                      ? "text-green-600"
                                      : "text-red-600",
                                )}
                              >
                                {belowThreshold ? "£0.00" : `£${totals.totalValue.toFixed(2)}`}
                              </TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
