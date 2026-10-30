import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export function licenceStatus(expiry: string | null, today = new Date()) {
  if (!expiry) return { label: "No expiry date", variant: "destructive" as const };
  const days = Math.floor((new Date(expiry + "T00:00:00").getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: "Expired", variant: "destructive" as const };
  if (days <= 60) return { label: `Expires in ${days} days`, variant: "secondary" as const };
  return { label: "Valid", variant: "default" as const };
}

export default function CustomerDutyOfCare({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({
    queryKey: ["customer-doc", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("waste_carrier_licence, waste_carrier_licence_expiry, sic_code")
        .eq("id", customerId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ licence: "", expiry: "", sic: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setForm({
      licence: data.waste_carrier_licence ?? "",
      expiry: data.waste_carrier_licence_expiry ?? "",
      sic: data.sic_code ?? "",
    });
  }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("customers").update({
      waste_carrier_licence: form.licence.trim().toUpperCase() || null,
      waste_carrier_licence_expiry: form.expiry || null,
      sic_code: form.sic.trim() || null,
    }).eq("id", customerId);
    setSaving(false);
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["customer-doc", customerId] });
    toast({ title: "Duty of Care details saved" });
  };

  const status = licenceStatus(form.expiry || null);
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">Duty of Care</h3>
        <p className="text-sm text-muted-foreground">Waste carrier licence and company SIC code for this customer.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-licence">Waste carrier licence</Label>
          <Input id="doc-licence" placeholder="e.g. CBDU123456" value={form.licence}
            onChange={e => setForm(f => ({ ...f, licence: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-expiry" className="flex items-center gap-2">
            Licence expiry {status && <Badge variant={status.variant}>{status.label}</Badge>}
          </Label>
          <Input id="doc-expiry" type="date" value={form.expiry}
            onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-sic">Company SIC code</Label>
          <Input id="doc-sic" placeholder="e.g. 38110" value={form.sic}
            onChange={e => setForm(f => ({ ...f, sic: e.target.value }))} />
        </div>
      </div>
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}
