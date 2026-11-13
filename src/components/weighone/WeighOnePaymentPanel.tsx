import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  paymentFromStored, paymentNeedsReference, paymentPatch, paymentProblem,
  type PaymentInput, type PaymentMethod, type StoredPayment,
} from "@/lib/weighone-payment";

/** Method / Paid / card number inputs, shared by the ticket form and the ticket view. */
export function PaymentFields({ id, value, onChange, amountDue }: {
  id: string;
  value: PaymentInput;
  onChange: (next: PaymentInput) => void;
  amountDue?: number | null;
}) {
  const needsRef = paymentNeedsReference(value.method);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Payment</span>
        <span className={value.paid ? "text-primary font-semibold" : value.method === "account" ? "text-muted-foreground font-semibold" : "text-destructive font-semibold"}>
          {value.paid ? "Paid" : value.method === "account" ? "On account" : "Not paid"}
          {amountDue != null && amountDue > 0 && <span className="ml-1 tabular-nums">£{amountDue.toFixed(2)}</span>}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`pay-method-${id}`}>Payment method</Label>
          <Select value={value.method} onValueChange={(v) => onChange({ ...value, method: v as PaymentMethod })}>
            <SelectTrigger id={`pay-method-${id}`}><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="account">Account</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Switch id={`paid-${id}`} checked={value.paid} onCheckedChange={(paid) => onChange({ ...value, paid })} />
          <Label htmlFor={`paid-${id}`}>Paid</Label>
        </div>
      </div>
      {needsRef && (
        <div className="space-y-1">
          <Label htmlFor={`pay-ref-${id}`}>{value.method === "card" ? "Card / cheque number" : "Cheque number"}</Label>
          <Input id={`pay-ref-${id}`} value={value.reference} onChange={(e) => onChange({ ...value, reference: e.target.value })} placeholder="e.g. 004512" />
        </div>
      )}
    </div>
  );
}

interface Props {
  transaction: StoredPayment & { id: string; total_price?: number | null };
  onSaved?: (patch: Record<string, unknown>) => void;
}

export function WeighOnePaymentPanel({ transaction, onSaved }: Props) {
  const qc = useQueryClient();
  const [value, setValue] = useState<PaymentInput>(paymentFromStored(transaction));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(paymentFromStored(transaction));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction.id, transaction.payment_method, transaction.payment_paid, transaction.payment_reference]);

  const save = async () => {
    const problem = paymentProblem(value);
    if (problem) return toast.error(problem);
    setSaving(true);
    const patch = paymentPatch(value, transaction);
    const { error } = await supabase.from("weighbridge_transactions").update(patch).eq("id", transaction.id);
    setSaving(false);
    if (error) return toast.error("Could not save payment: " + error.message);
    toast.success("Payment saved");
    qc.invalidateQueries({ queryKey: ["weighbridge-transactions"] });
    onSaved?.(patch);
  };

  const due = transaction.total_price != null ? Math.round(Number(transaction.total_price) * 120) / 100 : null;
  return (
    <div className="p-3 rounded-lg border border-border space-y-3 text-sm">
      <PaymentFields id={transaction.id} value={value} onChange={setValue} amountDue={due} />
      <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save payment"}</Button>
    </div>
  );
}
