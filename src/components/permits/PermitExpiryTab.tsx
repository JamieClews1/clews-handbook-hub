import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Mail } from "lucide-react";
import { formatUkDate, hoursUntil, permitDisplayState, type PermitApplication } from "@/lib/permits";
import { usePermitApplications, usePermitSettings } from "@/hooks/usePermits";
import { PermitDialog } from "./PermitDialog";

export function PermitExpiryTab() {
  const { toast } = useToast();
  const { data: permits = [] } = usePermitApplications();
  const { data: settings } = usePermitSettings();
  const [editing, setEditing] = useState<PermitApplication | null>(null);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const lead = settings?.chase_lead_hours ?? 72;

  // Postcodes with a skip currently on site, from the last 12 months of Skiptrak movements.
  const { data: onSite = new Set<string>() } = useQuery({
    queryKey: ["permit_on_site_postcodes"],
    queryFn: async () => {
      const from = new Date();
      from.setMonth(from.getMonth() - 12);
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("postcode, movement_type, job_date")
        .eq("source", "skiptrak")
        .gte("job_date", from.toISOString().slice(0, 10))
        .not("postcode", "is", null)
        .order("job_date");
      if (error) throw error;
      const balance = new Map<string, number>();
      for (const j of data ?? []) {
        const pc = String((j as any).postcode || "").toUpperCase().replace(/\s+/g, "");
        if (!pc) continue;
        const mt = String((j as any).movement_type || "").toLowerCase();
        if (mt.includes("deliver")) balance.set(pc, (balance.get(pc) ?? 0) + 1);
        else if (mt.includes("collect")) balance.set(pc, (balance.get(pc) ?? 0) - 1);
      }
      return new Set([...balance.entries()].filter(([, v]) => v > 0).map(([k]) => k));
    },
  });

  const rows = useMemo(() => {
    return permits
      .filter((p) => p.expiry_date && !["cancelled", "rejected"].includes(p.status))
      .map((p) => ({
        permit: p,
        hours: hoursUntil(p.expiry_date) ?? 0,
        skipOnSite: onSite.has(String(p.site_postcode || "").toUpperCase().replace(/\s+/g, "")),
      }))
      .sort((a, b) => a.hours - b.hours);
  }, [permits, onSite]);

  const runCheck = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("permit-expiry-check", { body: {} });
    setRunning(false);
    if (error) return toast({ title: "Check failed", description: error.message, variant: "destructive" });
    toast({
      title: "Expiry check complete",
      description: `${(data as any)?.chased ?? 0} chase email(s) sent.`,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Permits closest to expiry
          </CardTitle>
          <Button variant="outline" size="sm" onClick={runCheck} disabled={running} className="gap-1.5">
            <Mail className="h-4 w-4" /> {running ? "Checking..." : "Run expiry check now"}
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Job</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="w-[110px]">Postcode</TableHead>
                <TableHead>Council</TableHead>
                <TableHead className="w-[110px]">Expires</TableHead>
                <TableHead className="w-[120px]">Time left</TableHead>
                <TableHead className="w-[130px]">Skip on site</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[150px]">Last chase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ permit: p, hours, skipOnSite }) => {
                const state = permitDisplayState(p, lead);
                const urgent = hours <= lead;
                return (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer hover:bg-muted/50 ${urgent && skipOnSite ? "bg-destructive/5" : ""}`}
                    onClick={() => { setEditing(p); setOpen(true); }}
                  >
                    <TableCell className="tabular-nums text-sm font-medium">{p.job_number || "—"}</TableCell>
                    <TableCell className="text-sm">{p.customer_name || "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{p.site_postcode || "—"}</TableCell>
                    <TableCell className="text-sm">{p.area || "—"}</TableCell>
                    <TableCell className="text-sm">{formatUkDate(p.expiry_date)}</TableCell>
                    <TableCell className={`text-sm tabular-nums ${urgent ? "text-destructive font-medium" : ""}`}>
                      {hours <= 0 ? "Expired" : `${hours}h`}
                    </TableCell>
                    <TableCell>
                      {skipOnSite ? (
                        <Badge className="text-[10px] border-0 bg-destructive/10 text-destructive">Skip on site</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell><Badge className={`text-[10px] border-0 ${state.className}`}>{state.label}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.last_chase_at ? new Date(p.last_chase_at).toLocaleString("en-GB") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    No permits with an expiry date yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PermitDialog open={open} onOpenChange={setOpen} permit={editing} />
    </div>
  );
}
