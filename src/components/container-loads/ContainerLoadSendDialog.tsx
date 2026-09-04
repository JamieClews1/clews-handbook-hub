import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Loader2, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContainerLoad } from "@/lib/container-loads";

interface Props {
  load: ContainerLoad;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: () => void;
}

function applyTemplate(str: string, load: ContainerLoad): string {
  const vars: Record<string, string> = {
    reference: load.reference || "",
    container_number: load.container_number || "",
    seal_number: load.seal_number || "",
    material: load.material || "",
    bale_count: String(load.bale_count ?? ""),
    total_weight_t: load.total_weight_t != null ? String(load.total_weight_t) : "",
    destination_facility: load.destination_facility || "",
    destination_country: load.destination_country || "",
    export_date: load.export_date || "",
    customer_name: load.customer_name || "",
  };
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

const ORDERS_EMAIL = "orders@clewsrecycling.co.uk";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ContainerLoadSendDialog = ({ load, open, onOpenChange, onSent }: Props) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"compose" | "review">("compose");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState(ORDERS_EMAIL);
  const [replyTo, setReplyTo] = useState(ORDERS_EMAIL);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contacts, setContacts] = useState<
    { id: string; name: string; company: string | null; email: string; is_default: boolean }[]
  >([]);

  useEffect(() => {
    if (!open) return;
    setStep("compose");
    (async () => {
      setLoading(true);
      const [{ data }, { data: contactData }] = await Promise.all([
        supabase.from("container_load_email_settings").select("*").limit(1).maybeSingle(),
        supabase
          .from("container_load_contacts")
          .select("id, name, company, email, is_default")
          .order("company")
          .order("name"),
      ]);
      const list = (contactData || []).filter((c) => c.email);
      setContacts(list);
      setCc(data?.cc_email || ORDERS_EMAIL);
      setReplyTo(data?.reply_to_email || ORDERS_EMAIL);
      setSubject(applyTemplate(data?.default_subject || `Container load ${load.reference}`, load));
      setBody(applyTemplate(data?.default_body || "", load));
      setTo(
        load.supplier_email ||
          list.find((c) => c.is_default)?.email ||
          load.annex7?.consignee_email ||
          "",
      );
      setLoading(false);
    })();
  }, [open, load]);

  const toList = to
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const toSet = new Set(toList.map((t) => t.toLowerCase()));

  const toggleRecipient = (email: string) => {
    const lower = email.toLowerCase();
    const next = toSet.has(lower)
      ? toList.filter((t) => t.toLowerCase() !== lower)
      : [...toList, email];
    setTo(next.join(", "));
  };

  const groupedContacts = contacts.reduce<Record<string, typeof contacts>>((acc, c) => {
    const key = c.company || "Other";
    (acc[key] ||= []).push(c);
    return acc;
  }, {});

  const ccList = cc
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const finalCc =
    ccList.some((c) => c.toLowerCase() === ORDERS_EMAIL) ||
    toSet.has(ORDERS_EMAIL)
      ? ccList
      : [...ccList, ORDERS_EMAIL];

  const attachmentNames = [
    ...(load.photos || []).map((p, i) => p.caption || p.path.split("/").pop() || `Photo ${i + 1}`),
    ...(load.annex7_upload ? [load.annex7_upload.name || "Annex 7"] : []),
    ...(load.packing_upload ? [load.packing_upload.name || "Packing list"] : []),
  ];

  const invalidTo = toList.filter((t) => !EMAIL_RE.test(t));
  const toValid = toList.length > 0 && invalidTo.length === 0;


  const handleSend = async () => {
    if (!toValid) {
      toast({ title: "Enter a valid recipient email", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-container-load", {
        body: { loadId: load.id, to: to.trim(), cc: finalCc.join(", "), replyTo, subject, body },
      });
      if (error) throw error;
      toast({
        title: "Email sent",
        description: `Sent to ${to} with ${data?.attachments ?? 0} attachment(s).`,
      });
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "compose" ? "Create email" : "Check and send"}
          </DialogTitle>
          <DialogDescription>
            {step === "compose"
              ? "All photos and uploaded paperwork will be attached automatically."
              : "Check the receiving email address and attachments before sending."}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : step === "compose" ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>To (supplier)</Label>
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="supplier@example.com"
                />
                {to.trim() && !toValid && (
                  <p className="text-xs text-destructive">That doesn't look like a valid email address.</p>
                )}
                {contacts.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {contacts.map((c) => (
                      <Button
                        key={c.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setTo(c.email)}
                      >
                        {c.name}
                        {c.company ? ` · ${c.company}` : ""}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>CC</Label>
                <Input value={cc} onChange={(e) => setCc(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {ORDERS_EMAIL} is always copied in.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reply-to</Label>
              <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded p-2">
              <Paperclip className="h-4 w-4" />
              {attachmentNames.length} attachment(s): {load.photos?.length || 0} photo(s)
              {load.annex7_upload ? ", Annex 7" : ""}
              {load.packing_upload ? ", Packing List" : ""}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border divide-y">
              <div className="flex gap-3 p-3">
                <span className="w-24 shrink-0 text-muted-foreground">To</span>
                <span className="font-medium break-all">{to}</span>
              </div>
              <div className="flex gap-3 p-3">
                <span className="w-24 shrink-0 text-muted-foreground">CC</span>
                <span className="break-all">{finalCc.join(", ") || "—"}</span>
              </div>
              <div className="flex gap-3 p-3">
                <span className="w-24 shrink-0 text-muted-foreground">Reply to</span>
                <span className="break-all">{replyTo}</span>
              </div>
              <div className="flex gap-3 p-3">
                <span className="w-24 shrink-0 text-muted-foreground">Subject</span>
                <span className="font-medium">{subject}</span>
              </div>
            </div>
            <div className="rounded-lg border p-3 whitespace-pre-wrap bg-muted/30 max-h-56 overflow-y-auto">
              {body || <span className="text-muted-foreground">No message</span>}
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <Paperclip className="h-4 w-4" /> {attachmentNames.length} attachment(s)
              </div>
              {attachmentNames.length === 0 ? (
                <p className="text-muted-foreground">Nothing attached to this load yet.</p>
              ) : (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {attachmentNames.map((n, i) => (
                    <li key={i} className="break-all">{n}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          {step === "compose" ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => setStep("review")} disabled={loading || !toValid}>
                Check &amp; continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("compose")} disabled={sending}>
                Back
              </Button>
              <Button onClick={handleSend} disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send email
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
