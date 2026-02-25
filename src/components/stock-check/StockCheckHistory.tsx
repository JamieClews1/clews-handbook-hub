import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface StockCheck {
  id: string;
  check_date: string;
  operator_name: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export const StockCheckHistory = () => {
  const [checks, setChecks] = useState<StockCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("stock_checks")
        .select("id, check_date, operator_name, status, notes, created_at")
        .order("check_date", { ascending: false })
        .limit(50);

      if (data) setChecks(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (checks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No stock checks recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {checks.map((check) => (
        <Card key={check.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">
                {format(new Date(check.check_date), "dd MMM yyyy")}
              </p>
              <p className="text-sm text-muted-foreground">
                By {check.operator_name} at {format(new Date(check.created_at), "HH:mm")}
              </p>
              {check.notes && (
                <p className="text-xs text-muted-foreground mt-1">{check.notes}</p>
              )}
            </div>
            <Badge variant={check.status === "submitted" ? "default" : "secondary"}>
              {check.status}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
