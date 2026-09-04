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

export const ContainerLoadSendDialog = ({ load, open, onOpenChange, onSent }: Props) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("orders@clewsrecycling.co.uk");
  const [replyTo, setReplyTo] = useState("orders@clewsrecycling.co.uk");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contacts, setContacts] = useState<
    { id: string; name: string; company: string | null; email: string; is_default: boolean }[]
  >([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [{ data }, { data: contactData }] = await Promise.all([
        supabase.from("container_load_email_settings").select("*").limit(1).maybeSingle(),
        supabase
          .from("container_load_contacts")
          .select("id, name, company, email, is_default")
          .order("is_default", { ascending: false })
          .order("name"),
      ]);
      const list = contactData || [];
      setContacts(list);
      setCc(data?.cc_email || "orders@clewsrecycling.co.uk");
      setReplyTo(data?.reply_to_email || "orders@clewsrecycling.co.uk");
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

  const attachmentCount =
    (load.photos?.length || 0) +
    (load.annex7_upload ? 1 : 0) +
    (load.packing_upload ? 1 : 0);

  const handleSend = async () => {
    if (!to.trim()) {
      toast({ title: "Recipient required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-container-load", {
        body: { loadId: load.id, to: to.trim(), cc, replyTo, subject, body },
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send container load to supplier</DialogTitle>
          <DialogDescription>
            All photos and uploaded paperwork will be attached automatically.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>To (supplier)</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="supplier@example.com" />
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
              {attachmentCount} attachment(s): {load.photos?.length || 0} photo(s)
              {load.annex7_upload ? ", Annex 7" : ""}
              {load.packing_upload ? ", Packing List" : ""}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || loading} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
