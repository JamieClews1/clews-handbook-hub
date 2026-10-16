import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllCustomers, fetchAllRows } from "@/lib/fetch-all";
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
  Sparkles,
  Plus,
  CheckCheck,
  Clock,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CRMTemplates, useCRMTemplates } from "@/components/crm/CRMTemplates";
import { CRMMailboxConnect, useMailboxConnection } from "@/components/crm/CRMMailboxConnect";
import { CrmCustomerFolders } from "@/components/crm/CrmCustomerFolders";
import { CrmTicketSidePanel } from "@/components/crm/CrmTicketSidePanel";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";

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
  mailbox_connection_id: string | null;
  customer_id: string | null;
  priority: Priority | null;
  category: string | null;
  due_at: string | null;
  intent?: string | null;
  is_filed?: boolean;
  ai_summary?: string | null;
  ai_extracted?: Record<string, any> | null;
  ai_suggested_assignee?: string | null;
}

const INTENT_LABELS: Record<string, string> = {
  booking: "New order / PO", quote: "Quote", exchange: "Exchange", collection: "Collection",
  weight_paperwork: "Weight / WTN", invoice: "Invoice", cancellation: "Cancel / amend",
  compliance: "Compliance docs", job_check: "Job check", complaint: "Service issue",
  thank_you: "Thank-you", other: "Other", noise_spam: "Spam report", noise_system: "System mail",
  noise_newsletter: "Newsletter", internal: "Internal",
};

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
  const navigate = useNavigate();
  const { templates, reload: reloadTemplates } = useCRMTemplates();
  const {
    connections: mailboxes,
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
  const [showFolders, setShowFolders] = useState(true);
  const [showMailboxes, setShowMailboxes] = useState(false);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(560);

  // Size the three panes to the space actually left below the header, so the
  // reply box and its buttons are never pushed out of the window.
  useEffect(() => {
    const measure = () => {
      const el = gridRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setPanelH(Math.max(420, window.innerHeight - top - 16));
    };
    measure();
    const t = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [mailboxes.length, connected, loading]);

  const loadTickets = async () => {
    // Paged: PostgREST caps a single response at 1,000 rows, so a plain
    // select silently drops everything older than the newest 1,000 threads.
    try {
      const rows = await fetchAllRows<Ticket>(
        "crm_tickets",
        "*",
        "last_message_at",
        (q) => q,
        false,
      );
      setTickets(rows);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
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
    try {
      const rows = await fetchAllRows<Message>(
        "crm_ticket_messages",
        "*",
        "sent_at",
        (q) => q.eq("ticket_id", ticketId),
        true,
      );
      setMessages(rows);
    } catch {
      setMessages([]);
    }
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

  // Tickets belonging to any of this user's linked mailboxes (plus legacy untagged ones).
  const myConnectionIds = useMemo(() => new Set(mailboxes.map((m) => m.id)), [mailboxes]);
  const mailboxEmailById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of mailboxes) map[m.id] = m.ms_email;
    return map;
  }, [mailboxes]);
  const mine = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (t.mailbox_connection_id && myConnectionIds.has(t.mailbox_connection_id)) ||
          (!t.mailbox_connection_id && (!t.mailbox_user_id || t.mailbox_user_id === user?.id)),
      ),
    [tickets, user?.id, myConnectionIds],
  );
  const [mailboxFilter, setMailboxFilter] = useState<string | "all">("all");
  const [showFiled, setShowFiled] = useState(false);
  const [triageOn, setTriageOn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.from("crm_ai_settings").select("triage_enabled").maybeSingle()
      .then(({ data }) => setTriageOn(data?.triage_enabled ?? true));
  }, []);
  const toggleTriage = async (v: boolean) => {
    setTriageOn(v);
    const { error } = await supabase.from("crm_ai_settings")
      .update({ triage_enabled: v, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
      .eq("id", true);
    if (error) { setTriageOn(!v); toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mine.filter((t) => {
      if (mailboxFilter !== "all" && t.mailbox_connection_id !== mailboxFilter) return false;
      if (!!t.is_filed !== showFiled) return false;
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
  }, [mine, folder, filter, search, customerNames, mailboxFilter, showFiled]);
  const selectedIndex = filtered.findIndex((t) => t.id === selectedId);

  const stats = useMemo(() => {
    const open = mine.filter((t) => !t.is_filed && (t.status === "new" || t.status === "open")).length;
    const unlinked = mine.filter((t) => !t.is_filed && !t.customer_id).length;
    const filed = mine.filter((t) => t.is_filed).length;
    const resolved = mine.filter((t) => t.status === "resolved").length;
    return { total: mine.length, open, unlinked, resolved, filed };
  }, [mine]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Use the user's own mailboxes when connected, else the shared orders@ inbox.
      const fn = mailboxes.length > 0 ? "crm-mailbox-sync" : "crm-outlook-sync";
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
          description: mailboxes.length > 0
            ? "Reconnect your mailbox to sync."
            : data?.message ?? "Connect a mailbox to sync emails.",
        });
      } else {
        toast({
          title: "Inbox synced",
          description: `${data?.synced ?? 0} new message(s) imported.`,
        });
        await loadTickets();
        if (mailboxes.length > 0) reloadMailbox();
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
      if (draftInfo) {
        const editPct = draftEditPercent(draftInfo.body, reply);
        await supabase.from("crm_tickets")
          .update({ ai_draft_sent_at: new Date().toISOString(), ai_draft_edit_pct: editPct })
          .eq("id", selected.id);
        setDraftInfo(null);
      }
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

  // AI draft: prepared for review only — nothing is sent until "Send reply" is pressed.
  const [drafting, setDrafting] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ body: string; missing: string[]; found: Record<string, string>; template: string | null } | null>(null);
  useEffect(() => { setDraftInfo(null); }, [selectedId]);

  const handleAiDraft = async () => {
    if (!selected) return;
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-ai-draft", { body: { ticketId: selected.id } });
      if (error) {
        const details = await (error as any).context?.text?.().catch(() => "");
        throw new Error(details || error.message);
      }
      if (data?.error) throw new Error(data.error);
      setIsNote(false);
      setReply(data.body ?? "");
      setDraftInfo({ body: data.body ?? "", missing: data.missing ?? [], found: data.found ?? {}, template: data.template_key ?? null });
    } catch (e: any) {
      toast({ title: "Couldn't draft a reply", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setDrafting(false);
    }
  };

  const insertTemplate = (body: string) => {
    setReply((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${body}` : body));
  };

  // One-click action: open RouteOne's New Job form filled in with the details
  // the AI extracted from this email. Nothing is created until staff save it.
  const openPrefilledJob = () => {
    if (!selected) return;
    const ex = selected.ai_extracted ?? {};
    const params = new URLSearchParams({ newjob: "1" });
    const set = (k: string, v: unknown) => { if (v) params.set(k, String(v)); };
    set("customer", selected.customer_id ? customerNames[selected.customer_id] : ex.company_name);
    set("site", ex.site_name);
    set("postcode", ex.postcode);
    set("po", ex.po_number ?? ex.contract_number);
    set("container", ex.container);
    set("waste", ex.waste_type);
    set("date", ex.requested_date);
    set("type", ex.service === "collect" ? "collection" : ex.service === "exchange" ? "exchange" : "delivery");
    set("notes", `From email: ${selected.subject ?? ""}`.trim());
    navigate(`/route-one?${params.toString()}`);
  };

  const applySuggestedAssignee = async () => {
    if (!selected?.ai_suggested_assignee) return;
    const member = team.find((m) => m.name === selected.ai_suggested_assignee);
    if (!member) return;
    await updateAssignee(member.id);
    await supabase.from("crm_tickets").update({ ai_suggested_assignee: null }).eq("id", selected.id);
    setTickets((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ai_suggested_assignee: null } : t)));
  };

  return (
    <div className="w-full px-4 md:px-6 py-4 space-y-3">
      <Tabs defaultValue="inbox" className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> CRM Inbox
          </h1>
          <TabsList>
            <TabsTrigger value="inbox" className="gap-1.5">
              <Inbox className="h-4 w-4" /> Inbox
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5">
              <FileText className="h-4 w-4" /> Templates
            </TabsTrigger>
          </TabsList>
          <div className="hidden xl:flex items-center gap-3 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">{stats.total}</span> threads</span>
            <span><span className="font-semibold text-amber-600">{stats.open}</span> open</span>
            <span><span className="font-semibold text-emerald-600">{stats.resolved}</span> resolved</span>
            <span><span className="font-semibold text-foreground">{stats.unlinked}</span> unlinked</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs" title="Files spam, receipts and newsletters, links senders to customers, sets category and flags urgent issues. Never sends email.">
              <Switch checked={!!triageOn} onCheckedChange={toggleTriage} disabled={triageOn === null} />
              <span className="font-medium text-foreground">Auto-sort</span>
            </label>
            <span className="text-xs text-muted-foreground">AI replies: <span className="font-medium text-foreground">Off</span></span>
            <Button variant="ghost" size="sm" onClick={() => setShowMailboxes((v) => !v)}>
              <Settings2 className="h-4 w-4" /> Mailboxes ({mailboxes.length})
            </Button>
            <Button variant="outline" size="sm" onClick={relinkAll}>
              <Building2 className="h-4 w-4" /> Match customers
            </Button>
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync inbox"}
            </Button>
          </div>
        </div>

        <TabsContent value="inbox" className="space-y-3 mt-0">
          {(showMailboxes || mailboxes.length === 0) && (
            <CRMMailboxConnect
              connections={mailboxes}
              loading={mailboxLoading}
              onChange={reloadMailbox}
            />
          )}

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

          <div ref={gridRef} className={cn("grid grid-cols-1 gap-3", showFolders ? "lg:grid-cols-[240px_1fr]" : "")}>
            {/* Customer folders */}
            {showFolders && (
              <Card className="p-3 overflow-hidden" style={{ height: panelH }}>
                <CrmCustomerFolders
                  tickets={mine}
                  customerNames={customerNames}
                  value={folder}
                  onChange={setFolder}
                />
              </Card>
            )}

            {/* Ticket list — full width, opens tickets in a side window */}
            <Card className="flex flex-col overflow-hidden" style={{ height: panelH }}>
              <div className="border-b p-3 space-y-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => setShowFolders((v) => !v)}
                    title={showFolders ? "Hide customer folders" : "Show customer folders"}
                    aria-label="Toggle customer folders"
                  >
                    {showFolders ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                  </Button>
                  <div className="relative flex-1 min-w-[220px] max-w-xl">
                    <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search subject, sender or customer…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_FILTERS.map((f) => (
                      <Button
                        key={f.value}
                        size="sm"
                        variant={filter === f.value ? "default" : "ghost"}
                        className="h-8 px-2.5 text-xs"
                        onClick={() => setFilter(f.value)}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant={showFiled ? "secondary" : "outline"}
                    className="h-8 px-2.5 text-xs ml-auto"
                    onClick={() => setShowFiled((v) => !v)}
                  >
                    {showFiled ? "Back to inbox" : `Filed (${stats.filed})`}
                  </Button>
                </div>
                {mailboxes.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant={mailboxFilter === "all" ? "secondary" : "ghost"}
                      className="h-7 px-2 text-xs"
                      onClick={() => setMailboxFilter("all")}
                    >
                      All mailboxes
                    </Button>
                    {mailboxes.map((m) => (
                      <Button
                        key={m.id}
                        size="sm"
                        variant={mailboxFilter === m.id ? "secondary" : "ghost"}
                        className="h-7 px-2 text-xs max-w-[200px] truncate"
                        onClick={() => setMailboxFilter(m.id)}
                      >
                        {m.ms_email}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="hidden md:grid grid-cols-[14px_200px_1fr_auto_80px] gap-3 px-4 py-2 border-b text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
                <span />
                <span>Requester</span>
                <span>Subject</span>
                <span>Tags</span>
                <span className="text-right">Updated</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
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
                        "w-full text-left grid grid-cols-[14px_1fr] md:grid-cols-[14px_200px_1fr_auto_80px] items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-border/60 transition-colors",
                        selectedId === t.id ? "bg-primary/10" : "hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn("h-2 w-2 rounded-full", !t.is_read ? "bg-primary" : "bg-transparent")}
                        aria-label={!t.is_read ? "Unread" : undefined}
                      />
                      <div className="min-w-0">
                        <p className={cn("text-sm truncate", !t.is_read ? "font-semibold text-foreground" : "text-foreground")}>
                          {t.sender_name || t.sender_email || "Unknown"}
                        </p>
                        {t.customer_id && customerNames[t.customer_id] && (
                          <p className="text-xs text-muted-foreground truncate">{customerNames[t.customer_id]}</p>
                        )}
                      </div>
                      <div className="min-w-0 col-start-2 md:col-start-auto">
                        <p className={cn("text-sm truncate", !t.is_read && "font-semibold")}>
                          {t.subject || "(no subject)"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{t.snippet}</p>
                      </div>
                      <div className="flex flex-wrap md:flex-nowrap items-center gap-1 col-start-2 md:col-start-auto">
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_META[t.status].className)}>
                          {STATUS_META[t.status].label}
                        </Badge>
                        {t.intent && INTENT_LABELS[t.intent] && (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                            {INTENT_LABELS[t.intent]}
                          </Badge>
                        )}
                        {t.priority && t.priority !== "normal" && (
                          <Badge variant="outline" className={cn("text-[10px]", PRIORITY_META[t.priority].className)}>
                            {PRIORITY_META[t.priority].label}
                          </Badge>
                        )}
                        {t.mailbox_connection_id && mailboxEmailById[t.mailbox_connection_id] && mailboxes.length > 1 && (
                          <Badge variant="outline" className="text-[10px] max-w-[140px] truncate">
                            {mailboxEmailById[t.mailbox_connection_id]}
                          </Badge>
                        )}
                      </div>
                      <span className="hidden md:block text-xs text-muted-foreground text-right">
                        {formatDate(t.last_message_at)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Ticket window */}
          <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
            <SheetContent
              side="right"
              className="w-full sm:max-w-none lg:w-[min(1320px,90vw)] p-0 flex gap-0"
            >
              {selected && (
                <>
                  <div className="flex-1 flex flex-col min-w-0 h-full">
                    <div className="border-b px-5 py-4 space-y-3 shrink-0">
                      <div className="flex items-start gap-3 pr-10">
                        <div className="min-w-0 flex-1">
                          <SheetTitle className="text-lg font-semibold truncate">{selected.subject || "(no subject)"}</SheetTitle>
                          <SheetDescription className="text-sm truncate">
                            {selected.sender_name} &lt;{selected.sender_email}&gt;
                            {selected.customer_id && customerNames[selected.customer_id] && (
                              <> · <span className="text-foreground font-medium">{customerNames[selected.customer_id]}</span></>
                            )}
                          </SheetDescription>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground mr-1">
                            {selectedIndex + 1} of {filtered.length}
                          </span>
                          <Button size="icon" variant="outline" className="h-8 w-8" disabled={selectedIndex <= 0}
                            onClick={() => setSelectedId(filtered[selectedIndex - 1]?.id ?? null)} aria-label="Previous ticket" title="Previous ticket">
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8" disabled={selectedIndex < 0 || selectedIndex >= filtered.length - 1}
                            onClick={() => setSelectedId(filtered[selectedIndex + 1]?.id ?? null)} aria-label="Next ticket" title="Next ticket">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
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
                      {/* Extracted details + one-click actions (pipeline steps 4 & 7) */}
                      {(() => {
                        const ex = (selected.ai_extracted ?? {}) as Record<string, any>;
                        const bits: Array<[string, string]> = [
                          ["PO", ex.po_number], ["Contract", ex.contract_number], ["Job ref", ex.job_reference],
                          ["Site", ex.site_name], ["Postcode", ex.postcode], ["Container", ex.container],
                          ["Waste", ex.waste_type], ["Service", ex.service], ["Date", ex.requested_date],
                        ].filter(([, v]) => v) as Array<[string, string]>;
                        const isJobIntent = ["booking", "exchange", "collection"].includes(selected.intent ?? "");
                        if (bits.length === 0 && !selected.ai_suggested_assignee && !isJobIntent) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {bits.map(([k, v]) => (
                              <Badge key={k} variant="secondary" className="text-[10px] font-normal">
                                <span className="text-muted-foreground mr-1">{k}:</span>{v}
                              </Badge>
                            ))}
                            {selected.ai_suggested_assignee && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={applySuggestedAssignee}>
                                <UserCheck className="h-3.5 w-3.5 text-primary" /> Assign to {selected.ai_suggested_assignee}
                              </Button>
                            )}
                            {isJobIntent && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={openPrefilledJob}>
                                <Plus className="h-3.5 w-3.5 text-primary" /> New job from this email
                              </Button>
                            )}
                            {selected.status !== "pending" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => patchTicket({ status: "pending" })}>
                                <Clock className="h-3.5 w-3.5" /> Awaiting customer
                              </Button>
                            )}
                            {selected.status !== "resolved" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => patchTicket({ status: "resolved" })}>
                                <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> Mark resolved
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
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

                    <div className="border-t p-3 space-y-2 shrink-0">
                      {draftInfo && !isNote && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground flex items-center gap-1">
                              <Sparkles className="h-3.5 w-3.5 text-primary" />
                              AI draft{draftInfo.template ? ` · ${INTENT_LABELS[draftInfo.template] ?? draftInfo.template}` : ""} — check before sending
                            </span>
                            <button className="text-muted-foreground hover:text-foreground" onClick={() => setDraftInfo(null)}>Hide</button>
                          </div>
                          {draftInfo.missing.length > 0 && (
                            <p className="text-destructive">
                              <span className="font-medium">Needs filling in:</span> {draftInfo.missing.join(" · ")}
                            </p>
                          )}
                          {Object.keys(draftInfo.found).filter((k) => !["userName", "weightChecksUrl", "companyPhone"].includes(k)).length > 0 && (
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">Found in portal:</span>{" "}
                              {Object.entries(draftInfo.found)
                                .filter(([k]) => !["userName", "weightChecksUrl", "companyPhone"].includes(k))
                                .map(([k, v]) => `${k}: ${v}`).join(" · ")}
                            </p>
                          )}
                        </div>
                      )}
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
                          <Button variant="secondary" onClick={handleAiDraft} disabled={drafting || isNote}>
                            <Sparkles className={cn("h-4 w-4 text-primary", drafting && "animate-pulse")} />
                            {drafting ? "Drafting…" : "AI draft"}
                          </Button>
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
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="templates">
          <CRMTemplates onChange={reloadTemplates} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Percentage of the AI draft that was changed before sending (word-level). */
export function draftEditPercent(draft: string, sent: string): number {
  const a = draft.trim().split(/\s+/).filter(Boolean);
  const b = sent.trim().split(/\s+/).filter(Boolean);
  if (!a.length && !b.length) return 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  const lcs = prev[b.length];
  return Math.round((1 - (2 * lcs) / (a.length + b.length)) * 100);
}
