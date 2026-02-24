import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Activity } from "lucide-react";

interface Props {
  queryId: string;
}

const actionIcons: Record<string, string> = {
  status_change: "🔄",
  email_sent: "📧",
  owner_change: "👤",
  note_added: "📝",
  photo_uploaded: "📷",
};

const ContaminationActivityLog = ({ queryId }: Props) => {
  const { data: logs = [] } = useQuery({
    queryKey: ["contamination-activity-log", queryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contamination_activity_log")
        .select("*")
        .eq("query_id", queryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const formatAction = (log: any) => {
    switch (log.action_type) {
      case "status_change":
        return `Status changed from "${log.old_value}" to "${log.new_value}"`;
      case "owner_change":
        return `Owner changed from "${log.old_value}" to "${log.new_value}"`;
      case "email_sent":
        return `Email sent to ${log.new_value}`;
      case "note_added":
        return log.notes;
      case "photo_uploaded":
        return log.new_value;
      default:
        return log.notes || log.action_type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-2 text-sm border-l-2 border-border pl-3 py-1">
                  <span>{actionIcons[log.action_type] || "•"}</span>
                  <div className="flex-1">
                    <p>{formatAction(log)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.user_name} · {format(new Date(log.created_at), "dd/MM/yy HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ContaminationActivityLog;
