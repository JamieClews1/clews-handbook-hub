import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, FileText, Loader2, MessageSquarePlus, Paperclip, Phone, Send, X } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { cn } from "@/lib/utils";
import { OrderFileViewer, type OrderFileToView } from "@/components/orders/OrderFileViewer";
import {
  CLEWS_PHONE,
  ORDERS_PORTAL_MAX_BODY,
  ORDERS_PORTAL_MAX_FILES,
  ORDER_STATUS_LABEL,
  type OrderMessage,
  type OrderStatus,
  formatBytes,
  isValidEmail,
  orderFileProblem,
  ordersPortalCall,
  rememberOrderChat,
  savedOrderChats,
  uploadOrderFiles,
} from "@/lib/orders-portal";

function FilePicker({ files, setFiles, disabled }: { files: File[]; setFiles: (f: File[]) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const problem = orderFileProblem(f);
      if (problem) { toast.error(problem); continue; }
      if (next.length >= ORDERS_PORTAL_MAX_FILES) { toast.error(`Up to ${ORDERS_PORTAL_MAX_FILES} files at a time`); break; }
      next.push(f);
    }
    setFiles(next);
    if (ref.current) ref.current.value = "";
  };
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.heic,.webp,.doc,.docx,.xls,.xlsx,.csv,application/pdf,image/*"
        onChange={(e) => add(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={disabled}>
        <Paperclip className="h-4 w-4" /> Attach PDF order
      </Button>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
              <button
                type="button"
                className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-card p-1.5 shadow-sm ring-1 ring-border">
              <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Orders portal</p>
          </div>
          <a
            href={`tel:${CLEWS_PHONE.dial}`}
            className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-3 py-1.5 shadow-sm transition-colors hover:bg-primary/10"
          >
            <Phone className="h-5 w-5 shrink-0 text-primary" />
            <span className="leading-tight">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prefer to call?</span>
              <span className="block text-base font-bold tabular-nums text-foreground">{CLEWS_PHONE.display}</span>
            </span>
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewOrderForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ contact_name: "", company_name: "", email: "", phone: "", subject: "", message: "", website: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const saved = savedOrderChats();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contact_name.trim() || !form.company_name.trim()) return toast.error("Please enter your name and company");
    if (!isValidEmail(form.email)) return toast.error("Please enter a valid email address");
    if (!form.message.trim() && files.length === 0) return toast.error("Write what you need or attach your order");
    setBusy(true);
    try {
      const { token } = await ordersPortalCall<{ token: string }>("start", {
        contact_name: form.contact_name, company_name: form.company_name, email: form.email,
        phone: form.phone, subject: form.subject, website: form.website,
      });
      rememberOrderChat({ token, company: form.company_name.trim(), subject: form.subject.trim(), createdAt: new Date().toISOString() });
      const attachments = files.length ? await uploadOrderFiles(token, files) : [];
      await ordersPortalCall("send", { token, body: form.message, attachments });
      toast.success("Sent to Clews Recycling");
      navigate(`/orders/${token}`);
    } catch (err) {
      toast.error((err as Error).message || "Could not send — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Card className="overflow-hidden border-primary/20">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-primary-foreground">
          <h1 className="text-xl font-bold">Send an order to Clews Recycling</h1>
          <p className="text-sm opacity-90">Tell us what you need, attach your PDF order, and chat with our office team here.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="op-name">Your name *</Label><Input id="op-name" value={form.contact_name} onChange={set("contact_name")} autoComplete="name" /></div>
            <div className="space-y-1.5"><Label htmlFor="op-company">Company *</Label><Input id="op-company" value={form.company_name} onChange={set("company_name")} autoComplete="organization" /></div>
            <div className="space-y-1.5"><Label htmlFor="op-email">Email *</Label><Input id="op-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" /></div>
            <div className="space-y-1.5"><Label htmlFor="op-phone">Phone</Label><Input id="op-phone" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" /></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-subject">Subject</Label>
            <Input id="op-subject" value={form.subject} onChange={set("subject")} placeholder="e.g. 8yd skip exchange — Unit 4, CV21" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-message">What do you need?</Label>
            <Textarea
              id="op-message"
              rows={6}
              maxLength={ORDERS_PORTAL_MAX_BODY}
              value={form.message}
              onChange={set("message")}
              placeholder="Site address and postcode, container size, waste type, delivery / collection / exchange, date needed and your PO number."
            />
          </div>
          {/* honeypot — hidden from people */}
          <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} className="hidden" aria-hidden="true" />
          <FilePicker files={files} setFiles={setFiles} disabled={busy} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">We'll email you a private link to this conversation.</p>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to Clews
            </Button>
          </div>
        </form>
      </Card>

      {saved.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Your conversations on this device</h2>
          <ul className="divide-y">
            {saved.map((c) => (
              <li key={c.token}>
                <Link to={`/orders/${c.token}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
                  <span className="truncate"><span className="font-medium">{c.company}</span>{c.subject ? ` — ${c.subject}` : ""}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("en-GB")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Shell>
  );
}

interface ConvInfo { contact_name: string; company_name: string; email: string; subject: string | null; status: OrderStatus; created_at: string }

function OrderChat({ token }: { token: string }) {
  const [conv, setConv] = useState<ConvInfo | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<OrderFileToView | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await ordersPortalCall<{ conversation: ConvInfo; messages: OrderMessage[] }>("get", { token });
      setConv(r.conversation);
      setMessages(r.messages);
      setError(null);
      rememberOrderChat({ token, company: r.conversation.company_name, subject: r.conversation.subject ?? "", createdAt: r.conversation.created_at });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    load();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 10000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const send = async () => {
    if (!text.trim() && !files.length) return;
    setBusy(true);
    try {
      const attachments = files.length ? await uploadOrderFiles(token, files) : [];
      await ordersPortalCall("send", { token, body: text, attachments });
      setText("");
      setFiles([]);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !conv) {
    return (
      <Shell>
        <Card className="space-y-3 p-6 text-center">
          <p className="font-medium">{error}</p>
          <Button asChild><Link to="/orders">Send a new message</Link></Button>
        </Card>
      </Shell>
    );
  }
  if (!conv) {
    return <Shell><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Shell>;
  }

  return (
    <Shell>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="sm" asChild><Link to="/orders"><ArrowLeft className="h-4 w-4" /> New</Link></Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{conv.subject || "Order conversation"}</p>
            <p className="truncate text-xs text-muted-foreground">{conv.company_name} · {conv.contact_name}</p>
          </div>
          <Badge variant={conv.status === "done" ? "secondary" : "outline"}>{ORDER_STATUS_LABEL[conv.status]}</Badge>
        </div>

        <div className="max-h-[60dvh] min-h-[240px] space-y-3 overflow-y-auto bg-muted/20 p-4">
          {messages.map((m) => {
            const mine = m.sender === "customer";
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm", mine ? "bg-primary text-primary-foreground" : "border bg-card")}>
                  <p className={cn("mb-0.5 text-[11px] font-medium", mine ? "opacity-80" : "text-muted-foreground")}>
                    {mine ? "You" : `${m.staff_name || "Clews"} · Clews Recycling`} · {new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  {m.attachments.map((a) => (
                    <button
                      key={a.path}
                      type="button"
                      disabled={!a.url}
                      onClick={() => a.url && setViewing({ name: a.name, load: async () => {
                        const res = await fetch(a.url as string);
                        if (!res.ok) throw new Error(String(res.status));
                        return res.blob();
                      } })}
                      className={cn("mt-1 flex items-center gap-1.5 rounded border px-2 py-1 text-left text-xs underline-offset-2 hover:underline", mine ? "border-primary-foreground/30" : "")}
                    >
                      <FileText className="h-3.5 w-3.5" /> {a.name} <span className="opacity-70">({formatBytes(a.size)})</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {messages.length > 0 && messages[messages.length - 1].sender === "customer" && (
            <p className="text-center text-xs text-muted-foreground">Sent — our office team will reply here. We'll also email {conv.email} when they do.</p>
          )}
          <div ref={endRef} />
        </div>

        <div className="space-y-2 border-t p-3">
          <Textarea
            rows={3}
            maxLength={ORDERS_PORTAL_MAX_BODY}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            aria-label="Message"
          />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <FilePicker files={files} setFiles={setFiles} disabled={busy} />
            <Button onClick={send} disabled={busy || (!text.trim() && !files.length)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </Button>
          </div>
        </div>
      </Card>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MessageSquarePlus className="h-3.5 w-3.5" /> Bookmark this page — it's your private chat with Clews. Anyone with the link can see it.
      </p>
      <OrderFileViewer file={viewing} onClose={() => setViewing(null)} />
    </Shell>
  );
}

export default function OrdersPortalPage() {
  const { token } = useParams();
  useEffect(() => {
    const prev = document.title;
    document.title = "Orders portal — Clews Recycling";
    return () => { document.title = prev; };
  }, []);
  return token ? <OrderChat key={token} token={token} /> : <NewOrderForm />;
}
