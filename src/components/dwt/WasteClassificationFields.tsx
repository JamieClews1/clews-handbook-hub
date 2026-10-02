import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEwcCodes } from "@/hooks/useCodeRegisters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type WasteClassification = {
  hazardous?: boolean;
  contains_pops?: boolean;
  recovery_code?: string;
  consignment_code?: string;
  missing_consignment_reason?: string;
  hazard_codes?: string;
  hazard_components?: string;
  pop_components?: string;
  special_handling?: string;
  units?: string;
  estimated_weight?: boolean;
};

export const asClassification = (value: unknown): WasteClassification =>
  value && typeof value === "object" && !Array.isArray(value) ? value as WasteClassification : {};

export const codeKey = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 6);

type Props = {
  value: WasteClassification;
  onChange: (value: WasteClassification) => void;
  ewcCode: string;
  settings?: boolean;
  compact?: boolean;
};

export function WasteClassificationFields({ value, onChange, ewcCode, settings = false, compact = false }: Props) {
  const { data: codes = [] } = useEwcCodes(true);
  const matched = useMemo(() => codes.find((c) => codeKey(c.code) === codeKey(ewcCode) && !!ewcCode), [codes, ewcCode]);
  const defaults = asClassification(matched?.dwt_defaults);
  const set = (field: keyof WasteClassification, next: string | boolean) => onChange({ ...value, [field]: next });
  const needsConsignment = !!value.hazardous;
  const missing = needsConsignment && !value.consignment_code?.trim() && !value.missing_consignment_reason?.trim();

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      {!settings && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Hazardous & POPs details</p>
            <p className="text-xs text-muted-foreground">Saved on this job; not yet included in DEFRA uploads.</p>
          </div>
          {matched && Object.keys(defaults).length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, ...defaults })}>Apply EWC defaults</Button>
          )}
          {!compact && <Button type="button" variant="link" size="sm" asChild><Link to="/admin/settings?tab=codes">Edit code defaults</Link></Button>}
        </div>
      )}
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm"><Switch checked={!!value.hazardous} onCheckedChange={(v) => set("hazardous", v)} /> Hazardous waste</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={!!value.contains_pops} onCheckedChange={(v) => set("contains_pops", v)} /> Contains POPs</label>
        {!settings && <label className="flex items-center gap-2 text-sm"><Switch checked={!!value.estimated_weight} onCheckedChange={(v) => set("estimated_weight", v)} /> Weight estimated</label>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Disposal / recovery code</Label><Input value={value.recovery_code ?? ""} onChange={(e) => set("recovery_code", e.target.value.toUpperCase())} placeholder="e.g. R13 or D10" /></div>
        {!settings && <div className="space-y-1"><Label>Number of items</Label><Input type="number" min="0" value={value.units ?? ""} onChange={(e) => set("units", e.target.value)} placeholder="e.g. 4 fridges" /></div>}
      </div>
      {(value.hazardous || settings) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {!settings && <div className="space-y-1"><Label>Consignment note code</Label><Input value={value.consignment_code ?? ""} onChange={(e) => set("consignment_code", e.target.value.toUpperCase())} placeholder="ABCDEF/12345" />{value.consignment_code && !/^[A-Z0-9]{6}\/[A-Z0-9]{5}$/.test(value.consignment_code.trim()) && <p className="text-xs text-destructive">Check the code format (ABCDEF/12345).</p>}</div>}
          {!settings && <div className="space-y-1"><Label>Reason if no consignment note</Label><Input value={value.missing_consignment_reason ?? ""} onChange={(e) => set("missing_consignment_reason", e.target.value)} placeholder="e.g. local authority receipt" /></div>}
          <div className="space-y-1"><Label>Hazard codes</Label><Input value={value.hazard_codes ?? ""} onChange={(e) => set("hazard_codes", e.target.value.toUpperCase())} placeholder="e.g. HP14 (confirm classification)" /></div>
          <div className="space-y-1"><Label>Hazardous components & concentration</Label><Input value={value.hazard_components ?? ""} onChange={(e) => set("hazard_components", e.target.value)} placeholder="Component, mg/kg, source" /></div>
        </div>
      )}
      {(value.contains_pops || settings) && <div className="space-y-1"><Label>POP components & concentration</Label><Textarea rows={2} value={value.pop_components ?? ""} onChange={(e) => set("pop_components", e.target.value)} placeholder="Each component, concentration in mg/kg and source (test / guidance / estimate)" /></div>}
      {(value.hazardous || value.contains_pops || settings) && <div className="space-y-1"><Label>Special handling</Label><Textarea rows={2} value={value.special_handling ?? ""} onChange={(e) => set("special_handling", e.target.value)} placeholder="Handling or segregation instructions" /></div>}
      {missing && !settings && <p className="text-xs text-destructive">A hazardous load needs a consignment code or a reason why it is missing before reporting.</p>}
    </div>
  );
}