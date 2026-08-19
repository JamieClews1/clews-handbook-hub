import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllCustomers } from "@/lib/fetch-all";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  RefreshCw,
  Mail,
  Send,
  Inbox,
  AlertCircle,
  FileText,
  StickyNote,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CRMTemplates, useCRMTemplates } from "@/components/crm/CRMTemplates";
import { CRMMailboxConnect, useMailboxConnection } from "@/components/crm/CRMMailboxConnect";
import { CrmCustomerFolders } from "@/components/crm/CrmCustomerFolders";
import { CrmTicketSidePanel } from "@/components/crm/CrmTicketSidePanel";
import { useAuth } from "@/hooks/useAuth";

type Status = "new" | "open" | "pending" | "resolved";
type Priority = "low" | "normal" | "high" | "urgent";

interface Ticket {
  id: string;
  subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
  snippet: string | null;
  status: Status;
  is_read: boolean;
  last_message_at: string;
  assigned_to: string | null;
  mailbox_user_id: string | null;
  customer_id: string | null;
  priority: Priority | null;
  category: string | null;
  due_at: string | null;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  from_name: string | null;
  from_email: string | null;
  is_internal_note: boolean;
  sent_at: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  customer_name: string;
  customer_code: string | null;
}

const STATUS_META: Record<Status, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  open: { label: "Open", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  pending: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
  resolved: { label: "Resolved", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
};

const STATUS_FILTERS: Array<{ value: Status | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
];

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normal", className: "bg-muted text-muted-foreground border-border" },
  high: { label: "High", className: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  urgent: { label: "Urgent", className: "bg-red-500/15 text-red-600 border-red-500/30" },
};

const CATEGORIES = ["booking", "query", "complaint", "invoice", "rebate", "other"] as const;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CRMPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { templates, reload: reloadTemplates } = useCRMTemplates();
  const {
    connection: mailbox,
    loading: mailboxLoading,
    reload: reloadMailbox,
  } = useMailboxConnection(user?.id);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  const loadTickets = async () => {
    const { data } = await supabase
      .from("crm_tickets")
      .select("*")
      .order("last_message_at", { ascending: false });
    setTickets((data as unknown as Ticket[]) ?? []);
    setLoading(false);
  };

  const loadTeam = async () => {
    const { data } = await supabase
      .from("crm_team_members")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setTeam((data as TeamMember[]) ?? []);
  };

  const loadCustomers = async () => {
    try {
      const rows = await fetchAllCustomers<CustomerOption>("id, customer_name, customer_code");
      setCustomers(rows);
    } catch {
      setCustomers([]);
    }
  };

  useEffect(() => {
    loadTickets();
    loadTeam();
    loadCustomers();
  }, []);

  // Handle the return redirect from the Microsoft sign-in flow.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mb = params.get("mailbox");
    if (!mb) return;
    if (mb === "connected") {
      toast({
        title: "Mailbox connected",
        description: params.get("email")
          ? `Linked ${params.get("email")}.`
          : "Your Outlook mailbox is now linked.",
      });
      reloadMailbox();
    } else if (mb === "error") {
      toast({
        title: "Mailbox connection failed",
        description: params.get("reason") ?? "Please try again.",
        variant: "destructive",
      });
    }
    params.delete("mailbox");
    params.delete("email");
    params.delete("reason");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  const loadMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("crm_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("sent_at", { ascending: true });
    setMessages((data as Message[]) ?? []);
  };

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    (async () => {
      await loadMessages(selectedId);
      if (selected && !selected.is_read) {
        await supabase.from("crm_tickets").update({ is_read: true }).eq("id", selectedId);
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedId ? { ...t, is_read: true } : t)),
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const customerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of customers) map[c.id] = c.customer_name;
    return map;
  }, [customers]);

  // Tickets belonging to this user's mailbox (plus legacy untagged ones).
  const mine = useMemo(
    () => tickets.filter((t) => !t.mailbox_user_id || t.mailbox_user_id === user?.id),
    [tickets, user?.id],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mine.filter((t) => {
      if (folder === "unassigned" && t.customer_id) return false;
      if (folder && folder !== "unassigned" && t.customer_id !== folder) return false;
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      const customerName = t.customer_id ? customerNames[t.customer_id] ?? "" : "";
      return (
        (t.subject ?? "").toLowerCase().includes(q) ||
        (t.sender_name ?? "").toLowerCase().includes(q) ||
        (t.sender_email ?? "").toLowerCase().includes(q) ||
        (t.snippet ?? "").toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q)
      );
    });
  }, [mine, folder, filter, search, customerNames]);

  const stats = useMemo(() => {
    const open = mine.filter((t) => t.status === "new" || t.status === "open").length;
    const unlinked = mine.filter((t) => !t.customer_id).length;
    const resolved = mine.filter((t) => t.status === "resolved").length;
    return { total: mine.length, open, unlinked, resolved };
  }, [mine]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Use the user's own mailbox when connected, else the shared orders@ inbox.
      const fn = mailbox ? "crm-mailbox-sync" : "crm-outlook-sync";
      const { data, error } = await supabase.functions.invoke(fn);
      if (error) throw error;
      if (data?.reauth) {
        toast({
          title: "Reconnect needed",
          description: "Your mailbox sign-in expired. Please reconnect your Outlook mailbox.",
          variant: "destructive",
        });
        return;
      }
      setConnected(Boolean(data?.connected));
      if (data?.connected === false) {
        toast({
          title: "Mailbox not connected",
          description: mailbox
            ? "Reconnect your mailbox to sync."
            : data?.message ?? "Connect a mailbox to sync emails.",
        });
      } else {
        toast({
          title: "Inbox synced",
          description: `${data?.synced ?? 0} new message(s) imported.`,
        });
        await loadTickets();
        if (mailbox) reloadMailbox();
      }
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const patchTicket = async (patch: Partial<Ticket>) => {
    if (!selected) return;
    await supabase.from("crm_tickets").update(patch as any).eq("id", selected.id);
    setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  };

  const updateAssignee = async (value: string) => {
    if (!selected) return;
    const assigned_to = value === "unassigned" ? null : value;
    await supabase.from("crm_tickets").update({ assigned_to }).eq("id", selected.id);
    if (assigned_to) {
      await supabase.from("crm_assignment_log").insert({
        ticket_id: selected.id,
        assigned_to,
      });
    }
    setTickets((prev) =>
      prev.map((t) => (t.id === selected.id ? { ...t, assigned_to } : t)),
    );
  };

  const relinkAll = async () => {
    const unlinked = mine.filter((t) => !t.customer_id && t.sender_email);
    if (unlinked.length === 0) {
      toast({ title: "Nothing to match", description: "Every thread is already linked." });
      return;
    }
    let matched = 0;
    for (const t of unlinked) {
      const { data } = await supabase.rpc("crm_match_customer_by_email", {
        _email: t.sender_email as string,
      });
      if (data) {
        await supabase.from("crm_tickets").update({ customer_id: data }).eq("id", t.id);
        matched++;
      }
    }
    await loadTickets();
    toast({ title: "Matching complete", description: `${matched} thread(s) linked to a customer.` });
  };

  const handleSend = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const html = reply
        .split("\n")
        .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br/>"}</p>`)
        .join("");

      if (isNote) {
        // Internal note: stored on the thread, never emailed.
        const { error } = await supabase.from("crm_ticket_messages").insert({
          ticket_id: selected.id,
          direction: "outbound",
          body: html,
          body_preview: reply.slice(0, 200),
          from_name: "Internal note",
          is_internal_note: true,
          sent_at: new Date().toISOString(),
          mailbox_user_id: user?.id ?? null,
        });
        if (error) throw error;
        toast({ title: "Note added" });
        setReply("");
        await loadMessages(selected.id);
        return;
      }

      const { data, error } = await supabase.functions.invoke("crm-send-reply", {
        body: { ticketId: selected.id, body: html },
      });
      if (error) {
        const details = await error.context?.text?.().catch(() => "");
        throw new Error(details || error.message);
      }
      toast({
        title: "Reply sent",
        description: data?.from
          ? `Your reply was sent from ${data.from}.`
          : "Your reply was sent.",
      });
      setReply("");
      await loadMessages(selected.id);
      setTickets((prev) =>
        prev.map((t) => (t.id === selected.id ? { ...t, status: "pending" } : t)),
      );
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const insertTemplate = (body: string) => {
    setReply((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${body}` : body));
  };

  return (
    <div className="max-w-screen-2xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> CRM Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Customer emails as tickets, filed under the account they belong to.
          </p>
        </div>
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="h-4 w-4" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-4 w-4" /> Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <CRMMailboxConnect
            connection={mailbox}
            loading={mailboxLoading}
            onChange={reloadMailbox}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{stats.total} threads</Badge>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                {stats.open} open
              </Badge>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                {stats.resolved} resolved
              </Badge>
              <Badge variant="outline">{stats.unlinked} unlinked</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={relinkAll}>
                <Building2 className="h-4 w-4" /> Match customers
              </Button>
              <Button onClick={handleSync} disabled={syncing}>
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {syncing ? "Syncing…" : "Sync inbox"}
              </Button>
            </div>
          </div>

          {connected === false && (
            <Card className="p-4 border-amber-500/40 bg-amber-500/5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Outlook mailbox not connected yet</p>
                <p className="text-muted-foreground">
                  The CRM is ready. Once the orders@clewsrecycling.co.uk mailbox is linked,
                  click “Sync inbox” to start importing emails and sending replies.
                </p>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[230px_340px_1fr] gap-4">
            {/* Customer folders */}
            <Card className="p-3 h-[calc(100vh-260px)]">
              <CrmCustomerFolders
                tickets={mine}
                customerNames={customerNames}
                value={folder}
                onChange={setFolder}
              />
            </Card>

            {/* Ticket list */}
            <Card className="p-3 space-y-3 h-[calc(100vh-260px)] flex flex-col">
              <Input
                placeholder="Search subject, sender or customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {STATUS_FILTERS.map((f) => (
                  <Button
                    key={f.value}
                    size="sm"
                    variant={filter === f.value ? "default" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
                {loading ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Loading…</p>
                ) : filtered.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8">
                    <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tickets here.</p>
                  </div>
                ) : (
                  filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "w-full text-left rounded-lg p-3 transition-colors border",
                        selectedId === t.id
                          ? "bg-accent border-border"
                          : "border-transparent hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm truncate", !t.is_read && "font-semibold")}>
                          {t.sender_name || t.sender_email || "Unknown"}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDate(t.last_message_at)}
                        </span>
                      </div>
                      <p className={cn("text-sm truncate", !t.is_read && "font-medium")}>
                        {t.subject || "(no subject)"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{t.snippet}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_META[t.status].className)}>
                          {STATUS_META[t.status].label}
                        </Badge>
                        {t.priority && t.priority !== "normal" && (
                          <Badge variant="outline" className={cn("text-[10px]", PRIORITY_META[t.priority].className)}>
                            {PRIORITY_META[t.priority].label}
                          </Badge>
                        )}
                        {t.customer_id && customerNames[t.customer_id] && (
                          <Badge variant="secondary" className="text-[10px] max-w-[150px] truncate">
                            {customerNames[t.customer_id]}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>

            {/* Conversation */}
            <Card className="p-0 h-[calc(100vh-260px)] flex overflow-hidden">
              {!selected ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Mail className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Select a ticket to view the conversation.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="border-b p-4 space-y-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold truncate">{selected.subject || "(no subject)"}</h2>
                        <p className="text-sm text-muted-foreground truncate">
                          {selected.sender_name} &lt;{selected.sender_email}&gt;
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={selected.status}
                          onValueChange={(v) => patchTicket({ status: v as Status })}
                        >
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_META) as Status[]).map((s) => (
                              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={selected.priority ?? "normal"}
                          onValueChange={(v) => patchTicket({ priority: v as Priority })}
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                              <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={selected.category ?? "none"}
                          onValueChange={(v) => patchTicket({ category: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No category</SelectItem>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={selected.assigned_to ?? "unassigned"}
                          onValueChange={updateAssignee}
                        >
                          <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue placeholder="Assign to…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {team.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={selected.due_at ? selected.due_at.slice(0, 10) : ""}
                          onChange={(e) =>
                            patchTicket({
                              due_at: e.target.value
                                ? new Date(`${e.target.value}T09:00:00`).toISOString()
                                : null,
                            })
                          }
                          className="h-8 w-[140px] text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "rounded-lg p-3 border max-w-[85%]",
                            m.is_internal_note
                              ? "mx-auto w-full bg-amber-500/10 border-amber-500/30"
                              : m.direction === "outbound"
                                ? "ml-auto bg-primary/5 border-primary/20"
                                : "bg-muted/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-medium flex items-center gap-1">
                              {m.is_internal_note && <StickyNote className="h-3 w-3" />}
                              {m.is_internal_note
                                ? "Internal note"
                                : m.direction === "outbound"
                                  ? "orders@clewsrecycling.co.uk"
                                  : m.from_name || m.from_email}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{formatDate(m.sent_at)}</span>
                          </div>
                          <div
                            className="prose prose-sm max-w-none text-sm [&_p]:my-1"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.body) }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="border-t p-3 space-y-2">
                      <Textarea
                        placeholder={
                          isNote
                            ? "Internal note — only visible to staff…"
                            : "Type your reply… (sent from your linked mailbox)"
                        }
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        className={cn("min-h-[90px]", isNote && "bg-amber-500/5")}
                      />
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className="flex gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" disabled={templates.length === 0}>
                                <FileText className="h-4 w-4" /> Insert template
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto w-64">
                              <DropdownMenuLabel>Canned responses</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {templates.map((t) => (
                                <DropdownMenuItem
                                  key={t.id}
                                  onSelect={() => insertTemplate(t.body ?? "")}
                                  className="flex flex-col items-start gap-0.5"
                                >
                                  <span className="text-sm font-medium">{t.name}</span>
                                  {t.category && (
                                    <span className="text-[10px] text-muted-foreground">{t.category}</span>
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant={isNote ? "default" : "outline"}
                            onClick={() => setIsNote((n) => !n)}
                          >
                            <StickyNote className="h-4 w-4" /> Internal note
                          </Button>
                        </div>
                        <Button onClick={handleSend} disabled={sending || !reply.trim()}>
                          <Send className="h-4 w-4" />
                          {sending ? "Saving…" : isNote ? "Add note" : "Send reply"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <CrmTicketSidePanel
                      ticketId={selected.id}
                      customerId={selected.customer_id}
                      senderEmail={selected.sender_email}
                      customers={customers}
                      onLinked={(customerId) =>
                        setTickets((prev) =>
                          prev.map((t) => (t.id === selected.id ? { ...t, customer_id: customerId } : t)),
                        )
                      }
                    />
                  </div>
                </>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <CRMTemplates onChange={reloadTemplates} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
