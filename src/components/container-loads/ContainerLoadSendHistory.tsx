import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Paperclip, Mail } from "lucide-react";

export interface SendLogRow {
  id: string;
  load_id: string | null;
  reference: string | null;
  load_name: string | null;
  to_email: string;
  cc_email: string | null;
  subject: string | null;
  attachment_count: number;
  attachment_names: unknown;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Props {
  /** When set, only show history for this container load. */
  loadId?: string;
  limit?: number;
  refreshKey?: number;
}

export const ContainerLoadSendHistory = ({ loadId, limit = 50, refreshKey = 0 }: Props) => {
  const [rows, setRows] = useState<SendLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("container_load_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (loadId) query = query.eq("load_id", loadId);
      const { data } = await query;
      if (!active) return;
      setRows((data || []) as unknown as SendLogRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadId, limit, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nothing has been sent yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const names = Array.isArray(r.attachment_names) ? (r.attachment_names as string[]) : [];
        return (
          <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium break-all">{r.to_email}</span>
              <Badge variant={r.status === "sent" ? "secondary" : "destructive"}>
                {r.status === "sent" ? "Sent" : "Failed"}
              </Badge>
              <span className="text-muted-foreground ml-auto text-xs">
                {new Date(r.created_at).toLocaleString("en-GB")}
              </span>
            </div>
            {!loadId && (r.load_name || r.reference) && (
              <p className="text-xs text-muted-foreground">
                {r.load_name || r.reference}
              </p>
            )}
            {r.subject && <p className="text-muted-foreground">{r.subject}</p>}
            {r.cc_email && (
              <p className="text-xs text-muted-foreground">CC: {r.cc_email}</p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              {r.attachment_count} attachment(s)
              {names.length > 0 && <span className="truncate">· {names.join(", ")}</span>}
            </div>
            {r.error_message && (
              <p className="text-xs text-destructive break-all">{r.error_message}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
