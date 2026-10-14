import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mailbox, Link2, Link2Off, CheckCircle2, Loader2, Plus } from "lucide-react";

export interface MailboxConnection {
  id: string;
  user_id: string;
  ms_email: string;
  ms_display_name: string | null;
  last_synced_at: string | null;
}

const CONNECTION_COLUMNS =
  "id, user_id, ms_email, ms_display_name, last_synced_at, created_at, updated_at";

export function useMailboxConnection(userId: string | null | undefined) {
  const [connections, setConnections] = useState<MailboxConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("crm_mailbox_connections")
      .select(CONNECTION_COLUMNS)
      .eq("user_id", userId)
      .order("created_at");
    setConnections((data as unknown as MailboxConnection[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { connections, loading, reload };
}

interface Props {
  connections: MailboxConnection[];
  loading: boolean;
  onChange: () => void;
}

export function CRMMailboxConnect({ connections, loading, onChange }: Props) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);

    // Open the popup synchronously (inside the click handler) so browsers
    // don't block it. Microsoft refuses to load inside the preview iframe,
    // so the sign-in must happen in a separate top-level window.
    const popup = window.open("about:blank", "ms-mailbox-oauth", "width=520,height=680");

    try {
      const redirectUri = `${window.location.origin}/crm/mailbox-callback`;
      const { data, error } = await supabase.functions.invoke("crm-mailbox-start", {
        body: { redirectUri },
      });
      if (error) throw error;
      if (!data?.url) {
        throw new Error(data?.error ?? "Could not start sign-in.");
      }

      if (popup && !popup.closed) {
        popup.location.href = data.url as string;
      } else {
        // Popup was blocked — fall back to navigating the current window.
        window.location.href = data.url as string;
        return;
      }

      // Wait for the callback popup to report back.
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        const payload = event.data;
        if (!payload || payload.type !== "crm-mailbox-oauth") return;
        window.removeEventListener("message", onMessage);
        setConnecting(false);
        try { popup?.close(); } catch { /* ignore */ }
        if (payload.status === "connected") {
          toast({
            title: "Mailbox connected",
            description: payload.email ? `Linked ${payload.email}.` : undefined,
          });
          onChange();
        } else {
          toast({
            title: "Mailbox sign-in failed",
            description: payload.reason ?? "Please try again.",
            variant: "destructive",
          });
        }
      };
      window.addEventListener("message", onMessage);

      // If the user closes the popup manually (or the callback ran on a
      // different origin so postMessage never arrived), stop the spinner and
      // re-check whether the mailbox actually got linked.
      const startedAt = Date.now();
      const poll = window.setInterval(() => {
        const timedOut = Date.now() - startedAt > 3 * 60 * 1000;
        if (popup?.closed || timedOut) {
          window.clearInterval(poll);
          window.removeEventListener("message", onMessage);
          setConnecting(false);
          onChange();
        }
      }, 800);
    } catch (e: any) {
      try { popup?.close(); } catch { /* ignore */ }
      toast({
        title: "Couldn't start mailbox sign-in",
        description: e.message ?? String(e),
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async (conn: MailboxConnection) => {
    setDisconnectingId(conn.id);
    // Cast: generated types predate the multi-mailbox `id` column.
    const { error } = await (supabase.from("crm_mailbox_connections") as any)
      .delete()
      .eq("id", conn.id);
    setDisconnectingId(null);
    if (error) {
      toast({ title: "Disconnect failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mailbox disconnected", description: conn.ms_email });
    onChange();
  };

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking mailbox connections…
      </Card>
    );
  }

  if (connections.length > 0) {
    return (
      <Card className="p-4 space-y-3 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            {connections.length === 1 ? "1 mailbox connected" : `${connections.length} mailboxes connected`}
          </div>
          <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {connecting ? "Redirecting…" : "Add another mailbox"}
          </Button>
        </div>
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-500/20 bg-background/60 px-3 py-2"
            >
              <div className="text-sm min-w-0">
                <p className="font-medium flex items-center gap-2 flex-wrap">
                  <Mailbox className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{conn.ms_email}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {conn.last_synced_at
                    ? `Last synced ${new Date(conn.last_synced_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.`
                    : "Not synced yet — click Sync inbox."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDisconnect(conn)}
                disabled={disconnectingId === conn.id}
              >
                <Link2Off className="h-4 w-4" />
                {disconnectingId === conn.id ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Replies are sent from the mailbox each conversation belongs to.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-3">
        <Mailbox className="h-5 w-5 text-primary shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Connect your Outlook mailboxes</p>
          <p className="text-muted-foreground">
            Sign in with each Microsoft 365 account you want to see here — for example your own
            address and orders@clewsrecycling.co.uk. You can add more than one.
          </p>
        </div>
      </div>
      <Button size="sm" onClick={handleConnect} disabled={connecting}>
        {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        {connecting ? "Redirecting…" : "Connect mailbox"}
      </Button>
    </Card>
  );
}
