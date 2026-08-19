import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Building2, Download, Link2, Paperclip, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

interface Attachment {
  id: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
}

interface CustomerOption {
  id: string;
  customer_name: string;
  customer_code: string | null;
}

interface Props {
  ticketId: string;
  customerId: string | null;
  senderEmail: string | null;
  customers: CustomerOption[];
  onLinked: (customerId: string | null) => void;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Right-hand context panel: linked customer, sites and email attachments. */
export function CrmTicketSidePanel({
  ticketId,
  customerId,
  senderEmail,
  customers,
  onLinked,
}: Props) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sites, setSites] = useState<Array<{ id: string; site_name: string }>>([]);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");

  const customer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("crm_ticket_attachments")
        .select("id, file_name, content_type, size_bytes, storage_path")
        .eq("ticket_id", ticketId)
        .order("created_at");
      setAttachments((data as Attachment[]) ?? []);
    })();
  }, [ticketId]);

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("customer_sites")
        .select("id, site_name")
        .eq("customer_id", customerId)
        .order("site_name")
        .limit(12);
      setSites((data as any[]) ?? []);
    })();
  }, [customerId]);

  const link = async (id: string | null) => {
    const { error } = await supabase
      .from("crm_tickets")
      .update({ customer_id: id })
      .eq("id", ticketId);
    if (error) {
      toast({ title: "Could not link", description: error.message, variant: "destructive" });
      return;
    }
    onLinked(id);
    setPicking(false);
    setQ("");
    toast({ title: id ? "Ticket linked to customer" : "Customer link removed" });
  };

  const download = async (a: Attachment) => {
    if (!a.storage_path) return;
    const { data, error } = await supabase.storage.from("crm-attachments").download(a.storage_path);
    if (error || !data) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(data);
    const el = document.createElement("a");
    el.href = url;
    el.download = a.file_name;
    el.click();
    URL.revokeObjectURL(url);
  };

  const search = q.trim().toLowerCase();
  const options = search
    ? customers
        .filter(
          (c) =>
            c.customer_name.toLowerCase().includes(search) ||
            (c.customer_code ?? "").toLowerCase().includes(search),
        )
        .slice(0, 30)
    : customers.slice(0, 30);

  return (
    <div className="w-full lg:w-[260px] shrink-0 border-l bg-muted/20 p-3 space-y-4 overflow-y-auto">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Customer</p>
        {customer ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{customer.customer_name}</span>
            </div>
            {customer.customer_code && (
              <Badge variant="outline" className="text-[10px]">
                {customer.customer_code}
              </Badge>
            )}
            <div className="flex flex-wrap gap-1 pt-1">
              <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                <Link to="/admin/customers">Account</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                <Link to="/finance">Invoices</Link>
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setPicking((p) => !p)}
            >
              <Link2 className="h-3.5 w-3.5" /> Change
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Not linked{senderEmail ? ` (${senderEmail})` : ""}.
            </p>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPicking(true)}>
              <Link2 className="h-3.5 w-3.5" /> Link to customer
            </Button>
          </div>
        )}

        {picking && (
          <div className="space-y-1 pt-1">
            <Input
              autoFocus
              placeholder="Search customers…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {options.map((c) => (
                <button
                  key={c.id}
                  onClick={() => link(c.id)}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted truncate"
                >
                  {c.customer_name}
                </button>
              ))}
            </div>
            {customerId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive"
                onClick={() => link(null)}
              >
                Remove link
              </Button>
            )}
          </div>
        )}
      </div>

      {sites.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sites</p>
          {sites.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{s.site_name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Attachments</p>
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No attachments.</p>
        ) : (
          attachments.map((a) => (
            <button
              key={a.id}
              onClick={() => download(a)}
              className="w-full flex items-center gap-1.5 text-xs px-1 py-1 rounded hover:bg-muted text-left"
            >
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1">{a.file_name}</span>
              <span className="text-[10px] text-muted-foreground">{formatSize(a.size_bytes)}</span>
              <Download className="h-3 w-3 shrink-0 opacity-60" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
