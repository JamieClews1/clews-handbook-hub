import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSiteSelect } from "./MobileSiteSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Truck, ArrowRight, RefreshCw, Trash2 } from "lucide-react";

interface SiteOption {
  id: string;
  site_name: string;
}

interface NewLoadFormProps {
  operatorName: string;
  vehicleReg: string;
  jobNumber: string;
  selectedSiteId: string;
  sites: SiteOption[];
  onOperatorNameChange: (value: string) => void;
  onVehicleRegChange: (value: string) => void;
  onJobNumberChange: (value: string) => void;
  onSiteChange: (siteId: string) => void;
  weighbridgeWeightKg?: number | null;
  weighbridgeLoading?: boolean;
  onLookupWeighbridgeWeight?: () => void;
  noPalletsOnLoad?: boolean;
  onNoPalletsOnLoadChange?: (checked: boolean) => void;
  excludeFromRebate?: boolean;
  onExcludeFromRebateChange?: (checked: boolean) => void;
  onStartTally: () => void;
  isValid: boolean;
  isEditing?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
  customerType?: string | null;
  onCustomerTypeChange?: (value: string) => void;
}

const REPORT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "britvic", label: "Britvic" },
  { value: "vantiva", label: "Weighbridge Load" },
  { value: "amazon", label: "Amazon" },
  { value: "evri", label: "EVRi" },
  { value: "other", label: "Standard" },
];

export const NewLoadForm = ({
  operatorName,
  vehicleReg,
  jobNumber,
  selectedSiteId,
  sites,
  onOperatorNameChange,
  onVehicleRegChange,
  onJobNumberChange,
  onSiteChange,
  weighbridgeWeightKg,
  weighbridgeLoading,
  onLookupWeighbridgeWeight,
  noPalletsOnLoad = false,
  onNoPalletsOnLoadChange,
  excludeFromRebate = false,
  onExcludeFromRebateChange,
  onStartTally,
  isValid,
  isEditing = false,
  onDelete,
  isDeleting = false,
  customerType,
  onCustomerTypeChange,
}: NewLoadFormProps) => {
  const isEvri = customerType === "evri";
  const jobLabel = isEvri ? "Midweigh Ticket Number" : "Job Number";
  const jobPlaceholder = isEvri ? "Enter Midweigh ticket number" : "Enter job number";
  const isMobile = useIsMobile();
  const [frequentVehicles, setFrequentVehicles] = useState<string[]>([]);

  useEffect(() => {
    const fetchFrequentVehicles = async () => {
      const { data } = await supabase
        .from("load_reports")
        .select("vehicle_reg")
        .not("vehicle_reg", "is", null)
        .neq("vehicle_reg", "");
      
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((r) => {
          const reg = (r.vehicle_reg || "").toUpperCase().trim();
          if (reg) counts[reg] = (counts[reg] || 0) + 1;
        });
        const sorted = Object.entries(counts)
          .filter(([, c]) => c >= 2)
          .sort((a, b) => b[1] - a[1])
          .map(([reg]) => reg);
        setFrequentVehicles(sorted);
      }
    };
    fetchFrequentVehicles();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl">
                {isEditing ? "Edit Load Report" : "New Load Report"}
              </CardTitle>
            </div>
            {isEditing && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Load Report?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the load report and all its line items.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isEditing && onCustomerTypeChange && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
              <Label htmlFor="reportType" className="text-base font-medium">
                Report Type
              </Label>
              <Select
                value={customerType ?? "other"}
                onValueChange={onCustomerTypeChange}
              >
                <SelectTrigger id="reportType" className="h-14 text-lg bg-background">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Changing the report type updates the available sites below — pick the matching site to re-categorise this report.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="operator" className="text-base font-medium">
              Operator Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="operator"
              value={operatorName}
              onChange={(e) => onOperatorNameChange(e.target.value)}
              placeholder="Enter your name"
              className="h-14 text-lg"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle" className="text-base font-medium">
              Vehicle Registration
            </Label>
            <Input
              id="vehicle"
              value={vehicleReg}
              onChange={(e) => onVehicleRegChange(e.target.value.toUpperCase())}
              placeholder="e.g. AB12 CDE"
              className="h-14 text-lg uppercase"
              autoComplete="off"
              list="frequent-vehicles"
            />
            <datalist id="frequent-vehicles">
              {frequentVehicles.map((reg) => (
                <option key={reg} value={reg} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobNumber" className="text-base font-medium">
              {jobLabel}
            </Label>
            <Input
              id="jobNumber"
              value={jobNumber}
              onChange={(e) => onJobNumberChange(e.target.value)}
              placeholder={jobPlaceholder}
              className="h-14 text-lg"
              autoComplete="off"
            />

            {jobNumber.trim().length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Weighbridge Weight (kg)</span>
                  <span className="font-medium text-foreground">
                    {weighbridgeLoading ? (
                      <span className="text-muted-foreground">Looking up…</span>
                    ) : typeof weighbridgeWeightKg === "number" ? (
                      `${Math.round(weighbridgeWeightKg).toLocaleString()} kg`
                    ) : (
                      <span className="text-muted-foreground">Not found</span>
                    )}
                  </span>
                </div>

                {!!onLookupWeighbridgeWeight && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onLookupWeighbridgeWeight}
                      disabled={!jobNumber.trim() || !!weighbridgeLoading}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh weight
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="site" className="text-base font-medium">
              Site
            </Label>
            {isMobile ? (
              <MobileSiteSelect
                value={selectedSiteId}
                sites={sites}
                onValueChange={onSiteChange}
                placeholder="Select a site"
              />
            ) : (
              <Select value={selectedSiteId} onValueChange={onSiteChange}>
                <SelectTrigger id="site" className="h-14 text-lg">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.site_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* No Pallets on Load Checkbox */}
          {onNoPalletsOnLoadChange && (
            <div className="flex items-center space-x-3 rounded-lg border border-border bg-muted/30 p-4">
              <Checkbox
                id="noPalletsOnLoad"
                checked={noPalletsOnLoad}
                onCheckedChange={(checked) => onNoPalletsOnLoadChange(checked === true)}
                className="h-5 w-5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="noPalletsOnLoad"
                  className="text-base font-medium cursor-pointer"
                >
                  No pallets on load
                </Label>
                <p className="text-sm text-muted-foreground">
                  Bales were not on pallets, so pallet weight will not be deducted
                </p>
              </div>
            </div>
          )}

          {/* Exclude from Rebate Checkbox */}
          {onExcludeFromRebateChange && (
            <div className="flex items-center space-x-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
              <Checkbox
                id="excludeFromRebate"
                checked={excludeFromRebate}
                onCheckedChange={(checked) => onExcludeFromRebateChange(checked === true)}
                className="h-5 w-5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="excludeFromRebate"
                  className="text-base font-medium cursor-pointer"
                >
                  Exclude from Monthly Rebate Report
                </Label>
                <p className="text-sm text-muted-foreground">
                  This load will not be included in rebate calculations (e.g. liquid loads)
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={onStartTally}
            disabled={!isValid}
            size="lg"
            className="w-full h-16 text-xl gap-3 mt-4"
          >
            {isEditing ? "Continue to Tally" : "Start Tally"}
            <ArrowRight className="h-6 w-6" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
