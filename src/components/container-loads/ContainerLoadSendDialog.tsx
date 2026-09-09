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

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/\b(ltd|limited|uk|group|trading|resources|environmentals?)\b/g, "").replace(/[^a-z0-9]/g, "");

/** Does this contact belong to the company this container load is for? */
function isLoadCompany(
  c: { company: string | null; customer_id?: string | null },
  load: ContainerLoad,
): boolean {
  if (c.customer_id && load.customer_id && c.customer_id === load.customer_id) return true;
  const a = norm(c.company);
  const b = norm(load.customer_name);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
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
    {
      id: string;
      name: string;
      company: string | null;
      email: string;
      is_default: boolean;
      customer_id?: string | null;
    }[]
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
          .select("id, name, company, email, is_default, customer_id")
          .order("company")
          .order("name"),
      ]);
      const list = (contactData || []).filter((c) => c.email);
      setContacts(list);
      setCc(data?.cc_email || ORDERS_EMAIL);
      setReplyTo(data?.reply_to_email || ORDERS_EMAIL);
      setSubject(applyTemplate(data?.default_subject || `Container load ${load.reference}`, load));
      setBody(applyTemplate(data?.default_body || "", load));

      // Recipients come ONLY from contacts linked to the company this load is for
      // (never the weighbridge supplier email or a global default contact).
      const loadContacts = list.filter((c) => isLoadCompany(c, load));
      const preferred = loadContacts.filter((c) => c.is_default);
      const auto = (preferred.length ? preferred : loadContacts).map((c) => c.email);
      setTo(auto.join(", "));
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

  /** Company groups, with the company this load is for listed first. */
  const contactGroups = Object.entries(groupedContacts)
    .map(([company, list]) => ({
      company,
      list,
      isLoadCompany: list.some((c) => isLoadCompany(c, load)),
    }))
    .sort((a, b) => Number(b.isLoadCompany) - Number(a.isLoadCompany) || a.company.localeCompare(b.company));

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
    ...(load.extra_uploads || []).map((f, i) => f.name || `Document ${i + 1}`),
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
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>
                  To (supplier) — pick one or more
                  {load.customer_name ? (
                    <span className="ml-2 font-normal text-xs text-muted-foreground">
                      This load is for <span className="font-semibold text-foreground">{load.customer_name}</span>
                      {load.wb_ticket_number ? ` (WB ${load.wb_ticket_number})` : ""}
                    </span>
                  ) : null}
                </Label>
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="supplier@example.com, second@example.com"
                />
                {invalidTo.length > 0 && (
                  <p className="text-xs text-destructive">
                    Not a valid email: {invalidTo.join(", ")}
                  </p>
                )}
                {contacts.length > 0 && (
                  <div className="space-y-2 pt-1 max-h-52 overflow-y-auto rounded border p-2">
                    {contactGroups.map(({ company, list, isLoadCompany: isForLoad }) => (
                      <div
                        key={company}
                        className={isForLoad ? "rounded-md bg-primary/5 border border-primary/30 p-2" : ""}
                      >
                        <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-2">
                          {company}
                          {isForLoad && (
                            <span className="rounded bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              This load
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {list.map((c) => {
                            const active = toSet.has(c.email.toLowerCase());
                            return (
                              <Button
                                key={c.id}
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                className="h-7 text-xs"
                                onClick={() => toggleRecipient(c.email)}
                              >
                                {c.name}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
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
              {load.extra_uploads?.length ? `, ${load.extra_uploads.length} extra document(s)` : ""}
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
