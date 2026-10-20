import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PL_SHEET_NAMES, plSheetLabel, type PlSheetName } from "@/lib/company-pl";

export const PL_SOURCE_STORAGE_KEY = "company-pl-source-tab";

export function readPlSourcePreference(): PlSheetName {
  try {
    const stored = localStorage.getItem(PL_SOURCE_STORAGE_KEY);
    if (stored && (PL_SHEET_NAMES as readonly string[]).includes(stored)) return stored as PlSheetName;
  } catch {
    // localStorage unavailable — fall back to the default
  }
  return "Full set";
}

type Props = { value: PlSheetName; onChange: (value: PlSheetName) => void };

/** Jamie-only preferences for the Company P&L performance analysis. */
export default function CompanyPlSettingsTab({ value, onChange }: Props) {
  return (
    <Card className="max-w-xl border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Performance data source</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose which worksheet the Performance tab analyses. The Clews vs RFS view always uses both division tabs.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pl-source">Worksheet to analyse</Label>
          <Select value={value} onValueChange={(v) => onChange(v as PlSheetName)}>
            <SelectTrigger id="pl-source" className="w-64 max-w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PL_SHEET_NAMES.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          The 2023 and 2024 imports contain Full set only, so division tabs compare 2025 onwards. This preference is saved on this device.
        </p>
      </CardContent>
    </Card>
  );
}
