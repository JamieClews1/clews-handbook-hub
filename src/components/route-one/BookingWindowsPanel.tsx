import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Plus, Save, Trash2 } from "lucide-react";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "TBC"];

type Row = {
  id: string;
  zone_label: string;
  roro_day: string | null;
  skip_day: string | null;
  note: string | null;
  sort_order: number;
  updated_at: string;
};

const dayClass = (d: string | null) =>
  !d || d === "TBC"
    ? "bg-muted text-muted-foreground"
    : "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30";

export function BookingWindowsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["route-one-booking-windows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_booking_windows")
        .select("id, zone_label, roro_day, skip_day, note, sort_order, updated_at")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!dirty) setDraft(rows);
  }, [rows, dirty]);

  const setField = (id: string, field: keyof Row, value: any) => {
    setDirty(true);
    setDraft(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const payload = draft.map(r => ({
        id: r.id,
        zone_label: r.zone_label,
        roro_day: r.roro_day,
        skip_day: r.skip_day,
        note: r.note,
        sort_order: r.sort_order,
        updated_by: userData.user?.id ?? null,
      }));
      const { error } = await supabase.from("route_one_booking_windows").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["route-one-booking-windows"] });
      toast({ title: "Booking days updated" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const addZone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("route_one_booking_windows").insert({
        zone_label: "New Zone",
        roro_day: "TBC",
        skip_day: "TBC",
        sort_order: (draft[draft.length - 1]?.sort_order ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["route-one-booking-windows"] });
    },
  });

  const removeZone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("route_one_booking_windows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["route-one-booking-windows"] });
    },
  });

  const lastUpdated = rows.reduce<string | null>(
    (acc, r) => (!acc || r.updated_at > acc ? r.updated_at : acc),
    null,
  );

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Taking Bookings For</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {format(new Date(lastUpdated), "dd MMM yyyy HH:mm")}
              </span>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => addZone.mutate()}>
              <Plus className="h-3.5 w-3.5" /> Add Zone
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
            >
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            The day each zone is currently taking new RoRo and Skip bookings for. Keep this up to date — the
            office team works from it when booking jobs in.
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Zone</TableHead>
                  <TableHead className="w-[150px]">RoRo</TableHead>
                  <TableHead className="w-[150px]">Skip</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && draft.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      No zones set up yet — add one to get started.
                    </TableCell>
                  </TableRow>
                )}
                {draft.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Input
                        value={row.zone_label}
                        onChange={e => setField(row.id, "zone_label", e.target.value)}
                        className="h-8 text-sm font-medium"
                      />
                    </TableCell>
                    {(["roro_day", "skip_day"] as const).map(field => (
                      <TableCell key={field}>
                        <Select
                          value={row[field] ?? "TBC"}
                          onValueChange={v => setField(row.id, field, v)}
                        >
                          <SelectTrigger className={`h-8 text-sm font-semibold ${dayClass(row[field])}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS.map(d => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    ))}
                    <TableCell>
                      <Input
                        value={row.note ?? ""}
                        placeholder="Optional note"
                        onChange={e => setField(row.id, "note", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeZone.mutate(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BookingWindowsPanel;
