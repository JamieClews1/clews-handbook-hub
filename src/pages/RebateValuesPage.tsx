import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ArrowLeft, DollarSign, Save, Link2, Settings, Send, FileSpreadsheet, ClipboardList, Inbox } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";
import { RebateMappingSection } from "@/components/rebate-values/RebateMappingSection";
import { RebateSettingsSection } from "@/components/rebate-values/RebateSettingsSection";
import { RebateScreenshotUpload } from "@/components/rebate-values/RebateScreenshotUpload";
import { SiteRebateReportGenerator } from "@/components/customer-reporting/SiteRebateReportGenerator";
import { MonthlyRebateGenerationV2 } from "@/components/customer-reporting/MonthlyRebateGenerationV2";
import { RebateCheckReport } from "@/components/customer-reporting/RebateCheckReport";
import { RebateReportTracking } from "@/components/customer-reporting/RebateReportTracking";

type RebateItem = {
  id: string;
  name: string;
  sort_order: number;
};

type RebateValueRow = {
  itemId: string;
  lower: string;
  higher: string;
};

function monthStartISO(d: Date) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return start.toISOString().slice(0, 10);
}

function labelForMonth(monthStart: string) {
  // monthStart is YYYY-MM-01
  const [y, m] = monthStart.split("-").map((v) => Number(v));
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

const RebateValuesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, isAdmin } = useAuth();

  const [items, setItems] = useState<RebateItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [monthStart, setMonthStart] = useState(() => monthStartISO(new Date()));
  const [rows, setRows] = useState<Record<string, RebateValueRow>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const now = new Date();
    // Current month + previous 23 months
    for (let i = 0; i < 24; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      options.push(monthStartISO(d));
    }
    return options;
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setIsFetching(true);
      try {
        const [{ data: itemsData, error: itemsError }, { data: mgmtData, error: mgmtError }] =
          await Promise.all([
            supabase.from("rebate_items").select("id,name,sort_order").order("sort_order"),
            supabase.rpc("is_management", { _user_id: user.id }),
          ]);

        if (itemsError) throw itemsError;
        if (mgmtError) throw mgmtError;

        const can = Boolean(isAdmin || mgmtData);
        setCanEdit(can);
        setItems((itemsData ?? []) as RebateItem[]);
      } catch (e: any) {
        toast({
          title: "Error",
          description: e?.message ?? "Failed to load rebate items.",
          variant: "destructive",
        });
      } finally {
        setIsFetching(false);
      }
    };

    load();
  }, [user, isAdmin, toast]);

  useEffect(() => {
    const loadMonthValues = async () => {
      if (!user) return;
      setIsFetching(true);
      try {
        const { data, error } = await supabase
          .from("rebate_monthly_values")
          .select("item_id,lower_range,higher_range")
          .eq("month_start", monthStart);

        if (error) throw error;

        const byItemId: Record<string, RebateValueRow> = {};
        for (const item of items) {
          byItemId[item.id] = {
            itemId: item.id,
            lower: "",
            higher: "",
          };
        }

        for (const v of data ?? []) {
          byItemId[v.item_id] = {
            itemId: v.item_id,
            lower: v.lower_range === null || v.lower_range === undefined ? "" : String(v.lower_range),
            higher: v.higher_range === null || v.higher_range === undefined ? "" : String(v.higher_range),
          };
        }

        setRows(byItemId);
      } catch (e: any) {
        toast({
          title: "Error",
          description: e?.message ?? "Failed to load rebate values.",
          variant: "destructive",
        });
      } finally {
        setIsFetching(false);
      }
    };

    if (items.length > 0) {
      loadMonthValues();
    }
  }, [user, monthStart, items, toast, refreshKey]);

  const setRowValue = (itemId: string, key: "lower" | "higher", value: string) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: {
        itemId,
        lower: key === "lower" ? value : prev[itemId]?.lower ?? "",
        higher: key === "higher" ? value : prev[itemId]?.higher ?? "",
      },
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!canEdit) {
      toast({
        title: "No access",
        description: "You don’t have permission to edit rebate values.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = items.map((item) => {
        const r = rows[item.id];

        const lower = r?.lower?.trim() ? Number(r.lower) : null;
        const higher = r?.higher?.trim() ? Number(r.higher) : null;

        if (r?.lower?.trim() && Number.isNaN(lower)) {
          throw new Error(`Invalid lower range for "${item.name}"`);
        }
        if (r?.higher?.trim() && Number.isNaN(higher)) {
          throw new Error(`Invalid higher range for "${item.name}"`);
        }

        return {
          month_start: monthStart,
          item_id: item.id,
          lower_range: lower,
          higher_range: higher,
        };
      });

      const { error } = await supabase
        .from("rebate_monthly_values")
        .upsert(payload, { onConflict: "month_start,item_id" });

      if (error) throw error;

      toast({
        title: "Saved",
        description: `Rebate values saved for ${labelForMonth(monthStart)}.`,
      });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Could not save rebate values.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/portal">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Portal</span>
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold text-foreground">Rebates</span>
              </div>
            </div>
            <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <Tabs defaultValue="monthly-values" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="monthly-values" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Monthly Values
              </TabsTrigger>
              <TabsTrigger value="rebate-mapping" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Rebate Mapping
              </TabsTrigger>
              <TabsTrigger value="rebate-settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Rebate Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monthly-values">
              <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Monthly rebate ranges</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Choose a month, edit lower/higher ranges, then save.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="w-full sm:w-[240px]">
                      <Select value={monthStart} onValueChange={setMonthStart}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map((m) => (
                            <SelectItem key={m} value={m}>
                              {labelForMonth(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <RebateScreenshotUpload
                      items={items}
                      canEdit={canEdit}
                      onValuesImported={() => setRefreshKey((k) => k + 1)}
                    />

                    <Button onClick={handleSave} disabled={!canEdit || isSaving || isFetching} className="gap-2">
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Recyclable</TableHead>
                          <TableHead className="w-[160px]">Lower</TableHead>
                          <TableHead className="w-[160px]">Higher</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => {
                          const r = rows[item.id];
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>
                                <Input
                                  inputMode="decimal"
                                  type="number"
                                  step="0.01"
                                  value={r?.lower ?? ""}
                                  onChange={(e) => setRowValue(item.id, "lower", e.target.value)}
                                  disabled={!canEdit || isFetching}
                                  placeholder="—"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  inputMode="decimal"
                                  type="number"
                                  step="0.01"
                                  value={r?.higher ?? ""}
                                  onChange={(e) => setRowValue(item.id, "higher", e.target.value)}
                                  disabled={!canEdit || isFetching}
                                  placeholder="—"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {items.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-muted-foreground">
                              {isFetching ? "Loading..." : "No rebate items found."}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {!canEdit && (
                    <p className="text-sm text-muted-foreground mt-4">
                      View-only: you don't have permission to edit rebate values.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rebate-mapping">
              <RebateMappingSection canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="rebate-settings">
              <RebateSettingsSection canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default RebateValuesPage;
