import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { RefreshCw, Mail, Send, Inbox, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { CRMTemplates, useCRMTemplates } from "@/components/crm/CRMTemplates";
import { CRMMailboxConnect, useMailboxConnection } from "@/components/crm/CRMMailboxConnect";
import { useAuth } from "@/hooks/useAuth";

type Status = "new" | "open" | "pending" | "resolved";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  const loadTickets = async () => {
    const { data } = await supabase

      .from("crm_tickets")
      .select("*")
      .order("last_message_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
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

  useEffect(() => {
    loadTickets();
    loadTeam();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("crm_ticket_messages")
        .select("*")
        .eq("ticket_id", selectedId)
        .order("sent_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
      if (selected && !selected.is_read) {
        await supabase.from("crm_tickets").update({ is_read: true }).eq("id", selectedId);
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedId ? { ...t, is_read: true } : t)),
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return (
        (t.subject ?? "").toLowerCase().includes(q) ||
        (t.sender_name ?? "").toLowerCase().includes(q) ||
        (t.sender_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, filter, search]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-outlook-sync");
      if (error) throw error;
      setConnected(Boolean(data?.connected));
      if (data?.connected === false) {
        toast({
          title: "Mailbox not connected",
          description: data?.message ?? "Connect the orders@ mailbox to sync emails.",
        });
      } else {
        toast({
          title: "Inbox synced",
          description: `${data?.synced ?? 0} new message(s) imported.`,
        });
        await loadTickets();
      }
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const updateStatus = async (status: Status) => {
    if (!selected) return;
    await supabase.from("crm_tickets").update({ status }).eq("id", selected.id);
    setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, status } : t)));
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

  const handleSend = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const html = reply
        .split("\n")
        .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br/>"}</p>`)
        .join("");
      const { data, error } = await supabase.functions.invoke("crm-send-reply", {
        body: { ticketId: selected.id, body: html },
      });
      if (error) throw error;
      toast({
        title: data?.sent ? "Reply sent" : "Reply saved",
        description: data?.sent
          ? "Your reply was sent from orders@clewsrecycling.co.uk."
          : data?.error ?? "Saved to the conversation.",
      });
      setReply("");
      const { data: msgs } = await supabase
        .from("crm_ticket_messages")
        .select("*")
        .eq("ticket_id", selected.id)
        .order("sent_at", { ascending: true });
      setMessages((msgs as Message[]) ?? []);
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
            Emails to orders@clewsrecycling.co.uk as tickets.
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
          <div className="flex justify-end">
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync inbox"}
            </Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* Ticket list */}
        <Card className="p-3 space-y-3 h-[calc(100vh-220px)] flex flex-col">
          <Input
            placeholder="Search subject or sender…"
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
                <p className="text-sm">No tickets yet.</p>
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
                  <Badge variant="outline" className={cn("mt-1.5 text-[10px]", STATUS_META[t.status].className)}>
                    {STATUS_META[t.status].label}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Conversation */}
        <Card className="p-0 h-[calc(100vh-220px)] flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Mail className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Select a ticket to view the conversation.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">{selected.subject || "(no subject)"}</h2>
                    <p className="text-sm text-muted-foreground truncate">
                      {selected.sender_name} &lt;{selected.sender_email}&gt;
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={selected.status} onValueChange={(v) => updateStatus(v as Status)}>
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_META) as Status[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selected.assigned_to ?? "unassigned"}
                    onValueChange={updateAssignee}
                  >
                    <SelectTrigger className="h-8 w-[170px] text-xs">
                      <SelectValue placeholder="Assign to…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {team.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-lg p-3 border max-w-[85%]",
                      m.direction === "outbound"
                        ? "ml-auto bg-primary/5 border-primary/20"
                        : "bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {m.direction === "outbound"
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
                  placeholder="Type your reply… (sent from orders@clewsrecycling.co.uk)"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="min-h-[90px]"
                />
                <div className="flex justify-between gap-2">
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
                  <Button onClick={handleSend} disabled={sending || !reply.trim()}>
                    <Send className="h-4 w-4" />
                    {sending ? "Sending…" : "Send reply"}
                  </Button>
                </div>
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
