import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Method = "card" | "cash" | "cheque" | "account";

interface Props {
  transaction: {
    id: string;
    payment_method?: string | null;
    payment_paid?: boolean | null;
    payment_reference?: string | null;
    payment_paid_at?: string | null;
  };
  onSaved?: (patch: Record<string, unknown>) => void;
}

export function WeighOnePaymentPanel({ transaction, onSaved }: Props) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<Method | "">((transaction.payment_method as Method) ?? "");
  const [paid, setPaid] = useState(!!transaction.payment_paid);
  const [reference, setReference] = useState(transaction.payment_reference ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMethod((transaction.payment_method as Method) ?? "");
    setPaid(!!transaction.payment_paid);
    setReference(transaction.payment_reference ?? "");
  }, [transaction.id, transaction.payment_method, transaction.payment_paid, transaction.payment_reference]);

  const needsRef = method === "card" || method === "cheque";

  const save = async () => {
    if (paid && !method) return toast.error("Choose how it was paid");
    if (paid && needsRef && !reference.trim()) return toast.error("Enter the card / cheque number");
    setSaving(true);
    const patch = {
      payment_method: method || null,
      payment_paid: paid,
      payment_reference: needsRef ? reference.trim() || null : null,
      // Keep the original paid time when the ticket is saved again.
      payment_paid_at: paid ? (transaction.payment_paid && transaction.payment_paid_at ? transaction.payment_paid_at : new Date().toISOString()) : null,
    };
    const { error } = await supabase.from("weighbridge_transactions").update(patch).eq("id", transaction.id);
    setSaving(false);
    if (error) return toast.error("Could not save payment: " + error.message);
    toast.success("Payment saved");
    qc.invalidateQueries({ queryKey: ["weighbridge-transactions"] });
    onSaved?.(patch);
  };

  return (
    <div className="p-3 rounded-lg border border-border space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Payment</span>
        <span className={paid ? "text-primary font-semibold" : "text-destructive font-semibold"}>
          {paid ? "Paid" : "Not paid"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Payment method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="account">Account</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Switch id={`paid-${transaction.id}`} checked={paid} onCheckedChange={setPaid} />
          <Label htmlFor={`paid-${transaction.id}`}>Paid</Label>
        </div>
      </div>
      {needsRef && (
        <div className="space-y-1">
          <Label>{method === "card" ? "Card / cheque number" : "Cheque number"}</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 004512" />
        </div>
      )}
      <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save payment"}</Button>
    </div>
  );
}
