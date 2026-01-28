import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Calendar, Truck, Package } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type LoadReportCardData = {
  id: string;
  report_date: string;
  operator_name: string;
  vehicle_reg: string | null;
  total_pallets: number;
  total_weight_kg: number;
  notes: string | null;
  line_items: {
    waste_type: string;
    pallet_count: number;
    total_weight_kg: number;
  }[];
  calculated_rebate: number;
};

interface LoadReportCardsProps {
  reports: LoadReportCardData[];
  rebateConfigs: {
    material_name: string;
    rate_per_tonne: number;
  }[];
}

export function LoadReportCards({ reports, rebateConfigs }: LoadReportCardsProps) {
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});

  const toggleCard = (id: string) => {
    setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Create a rate lookup map
  const rateMap: Record<string, number> = {};
  for (const config of rebateConfigs) {
    rateMap[config.material_name] = config.rate_per_tonne;
  }

  // Calculate rebate for a single report
  const calculateReportRebate = (report: LoadReportCardData) => {
    let rebate = 0;
    for (const item of report.line_items) {
      const rate = rateMap[item.waste_type] ?? 0;
      const weightTonnes = item.total_weight_kg / 1000;
      rebate += weightTonnes * rate;
    }
    return rebate;
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
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(report.report_date), "dd MMM yyyy")}
                        </span>
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
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">
                        {(report.total_weight_kg / 1000).toFixed(2)} t
                      </Badge>
                      <Badge 
                        variant="default" 
                        className={cn(
                          "text-xs",
                          reportRebate >= 0 ? "bg-green-600" : "bg-red-600"
                        )}
                      >
                        £{reportRebate.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                  {report.notes && (
                    <p className="text-xs text-muted-foreground ml-7 mt-1">
                      Job: {report.notes}
                    </p>
                  )}
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs py-2">Material</TableHead>
                          <TableHead className="text-xs py-2 text-right">Pallets</TableHead>
                          <TableHead className="text-xs py-2 text-right">Weight (t)</TableHead>
                          <TableHead className="text-xs py-2 text-right">Rate (£/t)</TableHead>
                          <TableHead className="text-xs py-2 text-right">Value (£)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.line_items.map((item, idx) => {
                          const rate = rateMap[item.waste_type] ?? 0;
                          const weightTonnes = item.total_weight_kg / 1000;
                          const value = weightTonnes * rate;

                          return (
                            <TableRow key={idx}>
                              <TableCell className="text-xs py-1.5">{item.waste_type}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">{item.pallet_count}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">{weightTonnes.toFixed(2)}</TableCell>
                              <TableCell className="text-xs py-1.5 text-right">
                                {rate !== 0 ? `£${rate.toFixed(2)}` : "-"}
                              </TableCell>
                              <TableCell className={cn(
                                "text-xs py-1.5 text-right font-medium",
                                value >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                £{value.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
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
