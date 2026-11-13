import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllCustomers } from "@/lib/fetch-all";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Building2, Copy, ExternalLink, FileText, Loader2, Mail, Paperclip, Phone, Plus, RefreshCw, Search, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderFileViewer, type OrderFileToView } from "@/components/orders/OrderFileViewer";
import { publicUrl } from "@/lib/public-url";
import {
  ORDERS_PORTAL_BUCKET,
  ORDERS_PORTAL_MAX_FILES,
  ORDER_STATUS_LABEL,
  type OrderAttachment,
  type OrderStatus,
  formatBytes,
  orderFileProblem,
  ordersPortalCall,
  safeFileName,
} from "@/lib/orders-portal";

interface Conversation {
  id: string;
  contact_name: string;
  company_name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  customer_id: string | null;
  status: OrderStatus;
  staff_unread: boolean;
  message_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender: string | null;
  created_at: string;
}

interface Msg {
  id: string;
  sender: "customer" | "staff";
  staff_name: string | null;
  body: string;
  attachments: OrderAttachment[];
  created_at: string;
}

const when = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** Number of customer conversations staff haven't opened yet (for the tab badge). */
export function useOrdersPortalUnread() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { count: c } = await supabase
        .from("order_portal_conversations")
        .select("id", { count: "exact", head: true })
        .eq("staff_unread", true)
        .not("last_message_at", "is", null);
      if (alive) setCount(c ?? 0);
    };
    load();
    const t = window.setInterval(load, 30000);
    window.addEventListener("orders-portal-changed", load);
    return () => { alive = false; window.clearInterval(t); window.removeEventListener("orders-portal-changed", load); };
  }, []);
  return count;
}

export function OrdersPortalInbox() {
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "active" | "all">("active");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [customers, setCustomers] = useState<{ id: string; customer_name: string }[]>([]);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notify, setNotify] = useState(true);
  const [sending, setSending] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [viewing, setViewing] = useState<OrderFileToView | null>(null);
  const portalLink = publicUrl("/orders");

  const loadConvs = useCallback(async () => {
    const { data, error } = await supabase
      .from("order_portal_conversations")
      .select("id, contact_name, company_name, email, phone, subject, customer_id, status, staff_unread, message_count, last_message_at, last_message_preview, last_sender, created_at")
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setConvs((data ?? []) as Conversation[]);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("order_portal_messages")
      .select("id, sender, staff_name, body, attachments, created_at")
      .eq("conversation_id", id)
      .order("created_at");
    const msgs = ((data ?? []) as unknown) as Msg[];
    setMessages(msgs);
  }, []);

  useEffect(() => {
    loadConvs();
    fetchAllCustomers<{ id: string; customer_name: string }>("id, customer_name").then(setCustomers).catch(() => {});
    const t = window.setInterval(() => { if (document.visibilityState === "visible") loadConvs(); }, 15000);
    return () => window.clearInterval(t);
  }, [loadConvs]);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    const t = window.setInterval(() => { if (document.visibilityState === "visible") loadMessages(selectedId); }, 10000);
    return () => window.clearInterval(t);
  }, [selectedId, loadMessages]);

  const selected = convs.find((c) => c.id === selectedId) ?? null;

  // Opening a conversation marks it read.
  useEffect(() => {
    if (!selected?.staff_unread) return;
    supabase.from("order_portal_conversations").update({ staff_unread: false }).eq("id", selected.id).then(() => {
      setConvs((prev) => prev.map((c) => (c.id === selected.id ? { ...c, staff_unread: false } : c)));
      window.dispatchEvent(new Event("orders-portal-changed"));
    });
  }, [selected?.id, selected?.staff_unread]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, selectedId]);

  const customerName = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c.customer_name])), [customers]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return convs.filter((c) => {
      if (statusFilter === "active" && c.status === "done") return false;
      if (statusFilter !== "active" && statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.company_name, c.contact_name, c.email, c.subject, c.last_message_preview, c.customer_id ? customerName[c.customer_id] : ""]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [convs, statusFilter, query, customerName]);

  const counts = useMemo(() => ({
    unread: convs.filter((c) => c.staff_unread).length,
    open: convs.filter((c) => c.status === "open").length,
    in_progress: convs.filter((c) => c.status === "in_progress").length,
  }), [convs]);

  const patch = async (fields: Partial<Conversation>) => {
    if (!selected) return;
    const { error } = await supabase.from("order_portal_conversations").update(fields).eq("id", selected.id);
    if (error) return toast.error(error.message);
    setConvs((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ...fields } : c)));
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const p = orderFileProblem(f);
      if (p) { toast.error(p); continue; }
      if (next.length >= ORDERS_PORTAL_MAX_FILES) break;
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const openFile = (a: OrderAttachment) =>
    setViewing({
      name: a.name,
      load: async () => {
        const { data, error } = await supabase.storage.from(ORDERS_PORTAL_BUCKET).download(a.path);
        if (error || !data) throw error ?? new Error("missing");
        return data;
      },
    });

  const sendReply = async () => {
    if (!selected || (!reply.trim() && !files.length)) return;
    setSending(true);
    try {
      const attachments: OrderAttachment[] = [];
      for (const f of files) {
        const path = `${selected.id}/staff-${crypto.randomUUID()}-${safeFileName(f.name)}`;
        const { error } = await supabase.storage.from(ORDERS_PORTAL_BUCKET).upload(path, f, { contentType: f.type || undefined });
        if (error) throw new Error(`Could not upload ${f.name}: ${error.message}`);
        attachments.push({ path, name: f.name, size: f.size });
      }
      await ordersPortalCall("staff_reply", { conversation_id: selected.id, body: reply, attachments, notify });
      setReply("");
      setFiles([]);
      toast.success(notify ? `Reply sent — ${selected.email} has been emailed` : "Reply posted");
      await Promise.all([loadMessages(selected.id), loadConvs()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const createJob = () => {
    if (!selected) return;
    const params = new URLSearchParams({ newjob: "1" });
    const cust = selected.customer_id ? customerName[selected.customer_id] : selected.company_name;
    if (cust) params.set("customer", cust);
    const firstCustomer = messages.find((m) => m.sender === "customer" && m.body.trim());
    params.set("notes", `Orders portal: ${selected.subject || firstCustomer?.body.slice(0, 200) || ""}`.trim());
    navigate(`/route-one?${params.toString()}`);
  };

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-3 border-primary/30 bg-primary/5 p-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Customers send orders here without email — no login needed.</p>
          <p className="truncate text-muted-foreground">Share this link: <span className="font-mono text-foreground">{portalLink}</span></p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(portalLink); toast.success("Link copied"); }}>
          <Copy className="h-4 w-4" /> Copy link
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href="/orders" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Open customer page</a>
        </Button>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[380px_1fr]">
        <Card className="flex max-h-[calc(100dvh-260px)] min-h-[420px] flex-col overflow-hidden">
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, name, email…" className="pl-8" />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Not done ({counts.open + counts.in_progress})</SelectItem>
                  <SelectItem value="open">New / open ({counts.open})</SelectItem>
                  <SelectItem value="in_progress">In progress ({counts.in_progress})</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadConvs} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : shown.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No orders yet. Share the link above with customers.</p>
            ) : (
              shown.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "block w-full border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                    selectedId === c.id && "bg-muted",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {c.staff_unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    <span className={cn("truncate text-sm", c.staff_unread ? "font-bold" : "font-medium")}>{c.company_name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{when(c.last_message_at)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.contact_name}{c.subject ? ` · ${c.subject}` : ""}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="truncate text-xs">{c.last_sender === "staff" ? "You: " : ""}{c.last_message_preview}</p>
                    {c.status !== "open" && (
                      <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">{ORDER_STATUS_LABEL[c.status]}</Badge>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="flex max-h-[calc(100dvh-260px)] min-h-[420px] flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Select an order conversation</div>
          ) : (
            <>
              <div className="space-y-2 border-b p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{selected.company_name}{selected.subject ? ` — ${selected.subject}` : ""}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{selected.contact_name}</span>
                      <a href={`mailto:${selected.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{selected.email}</a>
                      {selected.phone && <a href={`tel:${selected.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{selected.phone}</a>}
                    </div>
                  </div>
                  <Select value={selected.status} onValueChange={(v) => patch({ status: v as OrderStatus })}>
                    <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{ORDER_STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={createJob}><Plus className="h-4 w-4" /> Create job</Button>
                </div>
                <Popover open={custOpen} onOpenChange={setCustOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Building2 className="h-3.5 w-3.5" />
                      {selected.customer_id ? customerName[selected.customer_id] ?? "Linked account" : "Link to customer account"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search customers…" />
                      <CommandList>
                        <CommandEmpty>No customer found</CommandEmpty>
                        <CommandGroup>
                          {selected.customer_id && (
                            <CommandItem onSelect={() => { patch({ customer_id: null }); setCustOpen(false); }}>
                              <X className="h-4 w-4" /> Unlink
                            </CommandItem>
                          )}
                          {customers.map((c) => (
                            <CommandItem key={c.id} value={`${c.customer_name} ${c.id}`} onSelect={() => { patch({ customer_id: c.id }); setCustOpen(false); }}>
                              {c.customer_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
                {messages.map((m) => {
                  const staff = m.sender === "staff";
                  return (
                    <div key={m.id} className={cn("flex", staff ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm", staff ? "bg-primary text-primary-foreground" : "border bg-card")}>
                        <p className={cn("mb-0.5 text-[11px] font-medium", staff ? "opacity-80" : "text-muted-foreground")}>
                          {staff ? m.staff_name || "Clews" : selected.contact_name} · {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                        {(m.attachments ?? []).map((a) => (
                            <button
                              key={a.path}
                              onClick={() => openFile(a)}
                              className={cn("mt-1 flex w-full items-center gap-1.5 rounded border px-2 py-1 text-left text-xs hover:underline", staff && "border-primary-foreground/30")}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{a.name}</span> <span className="opacity-70">({formatBytes(a.size)})</span>
                            </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="space-y-2 border-t p-3">
                <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${selected.contact_name}…`} aria-label="Reply" />
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {files.map((f, i) => (
                      <Badge key={`${f.name}-${i}`} variant="secondary" className="gap-1">
                        <FileText className="h-3 w-3" /> {f.name}
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> Attach</Button>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={notify} onCheckedChange={setNotify} /> Email customer a notification
                  </label>
                  <Button className="ml-auto" size="sm" onClick={sendReply} disabled={sending || (!reply.trim() && !files.length)}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
      <OrderFileViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
