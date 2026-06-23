import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mailbox, Link2, Link2Off, CheckCircle2, Loader2 } from "lucide-react";

export interface MailboxConnection {
  user_id: string;
  ms_email: string;
  ms_display_name: string | null;
  last_synced_at: string | null;
}

const CONNECTION_COLUMNS =
  "user_id, ms_email, ms_display_name, last_synced_at, created_at, updated_at";

export function useMailboxConnection(userId: string | null | undefined) {
  const [connection, setConnection] = useState<MailboxConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setConnection(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("crm_mailbox_connections")
      .select(CONNECTION_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    setConnection((data as MailboxConnection) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { connection, loading, reload };
}

interface Props {
  connection: MailboxConnection | null;
  loading: boolean;
  onChange: () => void;
}

export function CRMMailboxConnect({ connection, loading, onChange }: Props) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-mailbox-start", {
        body: { returnTo: window.location.href },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url as string;
      } else {
        throw new Error(data?.error ?? "Could not start sign-in.");
      }
    } catch (e: any) {
      toast({
        title: "Couldn't start mailbox sign-in",
        description: e.message ?? String(e),
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    setDisconnecting(true);
    const { error } = await supabase
      .from("crm_mailbox_connections")
      .delete()
      .eq("user_id", connection.user_id);
    setDisconnecting(false);
    if (error) {
      toast({ title: "Disconnect failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mailbox disconnected" });
    onChange();
  };

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking mailbox connection…
      </Card>
    );
  }

  if (connection) {
    return (
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-sm">
            <p className="font-medium flex items-center gap-2">
              Mailbox connected
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                {connection.ms_email}
              </Badge>
            </p>
            <p className="text-muted-foreground">
              Replies will be sent from your own address.
              {connection.last_synced_at
                ? ` Last synced ${new Date(connection.last_synced_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.`
                : " Not synced yet — click Sync inbox."}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
          <Link2Off className="h-4 w-4" />
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-3">
        <Mailbox className="h-5 w-5 text-primary shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Connect your Outlook mailbox</p>
          <p className="text-muted-foreground">
            Sign in with your Microsoft 365 account to read your own inbox and reply from your own address.
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
