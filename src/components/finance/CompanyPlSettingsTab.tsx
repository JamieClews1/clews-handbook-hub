import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PL_SHEET_NAMES, plSheetLabel, type PlSheetName } from "@/lib/company-pl";
import { PL_PROJECTION_METHODS, type PlProjectionMethod } from "@/lib/company-pl-analysis";
import CompanyPlTradingEvidence from "./CompanyPlTradingEvidence";
import type { TradingEvidence } from "@/lib/company-pl-trading";

export const PL_SOURCE_STORAGE_KEY = "company-pl-source-tab";
export const PL_METHOD_STORAGE_KEY = "company-pl-projection-method";

export function readPlSourcePreference(): PlSheetName {
  try {
    const stored = localStorage.getItem(PL_SOURCE_STORAGE_KEY);
    if (stored && (PL_SHEET_NAMES as readonly string[]).includes(stored)) return stored as PlSheetName;
  } catch {
    // localStorage unavailable — fall back to the default
  }
  return "Full set";
}

export function readPlMethodPreference(): PlProjectionMethod {
  try {
    const stored = localStorage.getItem(PL_METHOD_STORAGE_KEY);
    if (stored && PL_PROJECTION_METHODS.some((m) => m.key === stored)) return stored as PlProjectionMethod;
  } catch {
    // localStorage unavailable — fall back to the default
  }
  return "seasonal";
}

type Props = {
  value: PlSheetName;
  onChange: (value: PlSheetName) => void;
  method: PlProjectionMethod;
  onMethodChange: (method: PlProjectionMethod) => void;
  trading: TradingEvidence | null;
  tradingError: boolean;
  retry: () => void;
  useTrading: boolean;
  onTradingChange: (value: boolean) => void;
};

/** Jamie-only preferences for the Company P&L performance analysis. */
export default function CompanyPlSettingsTab({ value, onChange, method, onMethodChange, trading, tradingError, retry, useTrading, onTradingChange }: Props) {
  const selected = PL_PROJECTION_METHODS.find((m) => m.key === method) ?? PL_PROJECTION_METHODS[0];
  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Performance data source</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose which worksheet the Performance tab analyses. The Clews Only vs RFS Only view always uses both division tabs.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pl-source">Worksheet to analyse</Label>
            <Select value={value} onValueChange={(v) => onChange(v as PlSheetName)}>
              <SelectTrigger id="pl-source" className="w-64 max-w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PL_SHEET_NAMES.map((name) => <SelectItem key={name} value={name}>{plSheetLabel(name)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            The 2023 and 2024 imports contain Full set only, so division tabs compare 2025 onwards. This preference is saved on this device.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Projection model</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose how the Projections view estimates the rest of the year. The chosen model drives the year-end figures and the month-by-month forecast.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pl-method">Model</Label>
            <Select value={method} onValueChange={(v) => onMethodChange(v as PlProjectionMethod)}>
              <SelectTrigger id="pl-method" className="w-64 max-w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PL_PROJECTION_METHODS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm space-y-2">
            <p><span className="font-medium">How it works: </span>{selected.calculation}</p>
            <p><span className="font-medium">Best for: </span>{selected.bestFor}</p>
            <p><span className="font-medium">Watch out: </span>{selected.caution}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Prior-year seasonality needs a complete previous calendar year; without one, the Projections view falls back to the year-to-date average. This preference is saved on this device.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">All projection models</CardTitle>
          <p className="text-sm text-muted-foreground">
            Base models use the imported worksheets — actual months stay untouched and only unreported months are estimated. Gross margin stays at this year's year-to-date level. Seasonal overheads follow the previous year's monthly pattern; other models use this year's average overheads. The optional operational scenario below adjusts estimates only.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {PL_PROJECTION_METHODS.map((m) => (
            <div key={m.key} className="space-y-1 text-sm">
              <p className="font-medium">{m.label}{m.key === method ? " · in use" : ""}</p>
              <p className="text-muted-foreground">{m.summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <CompanyPlTradingEvidence data={trading} error={tradingError} retry={retry} enabled={useTrading} onChange={onTradingChange} source={value} />
    </div>
  );
}
