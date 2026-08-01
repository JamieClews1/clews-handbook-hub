import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { missingFinanceFields, type FinanceDetails } from "@/lib/finance";

const EMPTY = (customerId: string): FinanceDetails => ({
  customer_id: customerId,
  finance_contact_name: "",
  finance_contact_email: "",
  finance_contact_phone: "",
  billing_address_line1: "",
  billing_address_line2: "",
  billing_city: "",
  billing_county: "",
  billing_postcode: "",
  billing_country: "United Kingdom",
  vat_number: "",
  po_required: false,
  payment_terms_days: 30,
  accounting_provider: "sage50",
  accounting_customer_ref: "",
  notes: "",
});

interface Props {
  customerId: string;
  customerName?: string;
}

/** Finance Details tab for a customer — billing contact, address and accounting reference. */
export function CustomerFinanceDetails({ customerId, customerName }: Props) {
  const [form, setForm] = useState<FinanceDetails>(EMPTY(customerId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("customer_finance_details")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();
      if (!cancelled) {
        setForm(data ? ({ ...EMPTY(customerId), ...(data as any) } as FinanceDetails) : EMPTY(customerId));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const set = <K extends keyof FinanceDetails>(k: K, v: FinanceDetails[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = { ...form, customer_id: customerId } as any;
    delete payload.id;
    const { error } = await supabase
      .from("customer_finance_details")
      .upsert(payload, { onConflict: "customer_id" });
    setSaving(false);
    if (error) {
      toast.error("Could not save finance details", { description: error.message });
      return;
    }
    toast.success("Finance details saved");
  };

  const missing = missingFinanceFields(form);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading finance details…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missing.length ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Invoices cannot be raised for {customerName || "this customer"} until these are completed:{" "}
            <strong>{missing.join(", ")}</strong>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Finance details complete — this customer can be invoiced.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Finance contact</CardTitle>
          <CardDescription>Kept separate from the operational site contact.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Contact name *</Label>
            <Input
              value={form.finance_contact_name ?? ""}
              onChange={(e) => set("finance_contact_name", e.target.value)}
              placeholder="Accounts Payable"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email *</Label>
            <Input
              type="email"
              value={form.finance_contact_email ?? ""}
              onChange={(e) => set("finance_contact_email", e.target.value)}
              placeholder="accounts@customer.co.uk"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contact phone</Label>
            <Input
              value={form.finance_contact_phone ?? ""}
              onChange={(e) => set("finance_contact_phone", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Billing address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Address line 1 *</Label>
            <Input
              value={form.billing_address_line1 ?? ""}
              onChange={(e) => set("billing_address_line1", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Address line 2</Label>
            <Input
              value={form.billing_address_line2 ?? ""}
              onChange={(e) => set("billing_address_line2", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>City / town *</Label>
            <Input value={form.billing_city ?? ""} onChange={(e) => set("billing_city", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>County / state</Label>
            <Input value={form.billing_county ?? ""} onChange={(e) => set("billing_county", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Postcode *</Label>
            <Input
              value={form.billing_postcode ?? ""}
              onChange={(e) => set("billing_postcode", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Input value={form.billing_country ?? ""} onChange={(e) => set("billing_country", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoicing &amp; accounting</CardTitle>
          <CardDescription>
            The accounting reference links this customer to their record in the accounts package.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>VAT / tax number</Label>
            <Input value={form.vat_number ?? ""} onChange={(e) => set("vat_number", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment terms (days)</Label>
            <Input
              type="number"
              value={form.payment_terms_days ?? 30}
              onChange={(e) => set("payment_terms_days", Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sage customer reference</Label>
            <Input
              value={form.accounting_customer_ref ?? ""}
              onChange={(e) => set("accounting_customer_ref", e.target.value)}
              placeholder="e.g. CLEW001"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label className="cursor-pointer">Purchase order required</Label>
              <p className="text-xs text-muted-foreground">Warn if an invoice is raised without a PO.</p>
            </div>
            <Switch checked={!!form.po_required} onCheckedChange={(v) => set("po_required", v)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save finance details
        </Button>
      </div>
    </div>
  );
}

export default CustomerFinanceDetails;
