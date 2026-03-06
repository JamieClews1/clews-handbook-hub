import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Scale, Activity, Truck, Plus, Printer, Search, ArrowDownUp, Clock, CheckCircle2, XCircle, Weight, FileText } from "lucide-react";
import { format } from "date-fns";

type WeighbridgeStatus = "first_weigh" | "completed" | "voided";

interface WeighbridgeTransaction {
  id: string;
  ticket_number: string;
  vehicle_reg: string;
  customer: string | null;
  site: string | null;
  waste_description: string | null;
  ewc_code: string | null;
  container_type: string | null;
  gross_weight_kg: number | null;
  tare_weight_kg: number | null;
  net_weight_kg: number | null;
  status: WeighbridgeStatus;
  first_weigh_at: string | null;
  second_weigh_at: string | null;
  operator_id: string | null;
  operator_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<WeighbridgeStatus, { label: string; color: string; icon: React.ElementType }> = {
  first_weigh: { label: "First Weigh", color: "bg-amber-500/15 text-amber-700 border-amber-500/40", icon: Clock },
  completed: { label: "Completed", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40", icon: CheckCircle2 },
  voided: { label: "Voided", color: "bg-red-500/15 text-red-700 border-red-500/40", icon: XCircle },
};

const WeighOnePage = () => {
  const queryClient = useQueryClient();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [secondWeighDialogOpen, setSecondWeighDialogOpen] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<WeighbridgeTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // New transaction form
  const [formData, setFormData] = useState({
    vehicle_reg: "",
    customer: "",
    site: "",
    waste_description: "",
    ewc_code: "",
    container_type: "",
    gross_weight_kg: "",
    operator_name: "",
    notes: "",
  });

  // Second weigh form
  const [secondWeighKg, setSecondWeighKg] = useState("");

  // Fetch transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["weighbridge-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as WeighbridgeTransaction[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("weighbridge-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "weighbridge_transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["weighbridge-transactions"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Generate ticket number
  const generateTicket = async (): Promise<string> => {
    const { data, error } = await supabase.rpc("generate_ticket_number");
    if (error) throw error;
    return data as string;
  };

  // Create first weigh
  const createMutation = useMutation({
    mutationFn: async () => {
      const ticket = await generateTicket();
      const grossKg = parseFloat(formData.gross_weight_kg);
      const { error } = await supabase.from("weighbridge_transactions").insert({
        ticket_number: ticket,
        vehicle_reg: formData.vehicle_reg.toUpperCase(),
        customer: formData.customer || null,
        site: formData.site || null,
        waste_description: formData.waste_description || null,
        ewc_code: formData.ewc_code || null,
        container_type: formData.container_type || null,
        gross_weight_kg: isNaN(grossKg) ? null : grossKg,
        operator_name: formData.operator_name || null,
        notes: formData.notes || null,
        status: "first_weigh" as WeighbridgeStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("First weigh recorded");
      setNewDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  // Complete second weigh
  const secondWeighMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTransaction) throw new Error("No transaction selected");
      const tareKg = parseFloat(secondWeighKg);
      if (isNaN(tareKg)) throw new Error("Invalid tare weight");
      const grossKg = selectedTransaction.gross_weight_kg ?? 0;
      const netKg = Math.abs(grossKg - tareKg);

      const { error } = await supabase
        .from("weighbridge_transactions")
        .update({
          tare_weight_kg: tareKg,
          net_weight_kg: netKg,
          status: "completed" as WeighbridgeStatus,
          second_weigh_at: new Date().toISOString(),
        })
        .eq("id", selectedTransaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction completed");
      setSecondWeighDialogOpen(false);
      setSecondWeighKg("");
      setSelectedTransaction(null);
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  // Void transaction
  const voidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("weighbridge_transactions")
        .update({ status: "voided" as WeighbridgeStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Transaction voided"),
    onError: (e) => toast.error("Failed: " + e.message),
  });

  const resetForm = () => {
    setFormData({ vehicle_reg: "", customer: "", site: "", waste_description: "", ewc_code: "", container_type: "", gross_weight_kg: "", operator_name: "", notes: "" });
  };

  // Filter transactions
  const filtered = transactions.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.vehicle_reg.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.customer ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingTransactions = transactions.filter((t) => t.status === "first_weigh");
  const todayCompleted = transactions.filter(
    (t) => t.status === "completed" && t.second_weigh_at && format(new Date(t.second_weigh_at), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
  );
  const todayTotalTonnes = todayCompleted.reduce((sum, t) => sum + (t.net_weight_kg ?? 0) / 1000, 0);

  const printTicket = (t: WeighbridgeTransaction) => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Weighbridge Ticket ${t.ticket_number}</title>
      <style>
        body { font-family: monospace; padding: 20px; font-size: 12px; }
        h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
        h2 { font-size: 13px; text-align: center; margin-top: 0; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 3px 0; }
        td:last-child { text-align: right; font-weight: bold; }
        .footer { text-align: center; margin-top: 16px; font-size: 10px; }
      </style></head><body>
      <h1>WEIGHBRIDGE TICKET</h1>
      <h2>${t.ticket_number}</h2>
      <div class="line"></div>
      <table>
        <tr><td>Date:</td><td>${t.first_weigh_at ? format(new Date(t.first_weigh_at), "dd/MM/yyyy HH:mm") : "-"}</td></tr>
        <tr><td>Vehicle:</td><td>${t.vehicle_reg}</td></tr>
        <tr><td>Customer:</td><td>${t.customer ?? "-"}</td></tr>
        <tr><td>Site:</td><td>${t.site ?? "-"}</td></tr>
        <tr><td>Waste:</td><td>${t.waste_description ?? "-"}</td></tr>
        <tr><td>EWC Code:</td><td>${t.ewc_code ?? "-"}</td></tr>
        <tr><td>Container:</td><td>${t.container_type ?? "-"}</td></tr>
      </table>
      <div class="line"></div>
      <table>
        <tr><td>Gross Weight:</td><td>${t.gross_weight_kg != null ? (t.gross_weight_kg / 1000).toFixed(3) + " t" : "-"}</td></tr>
        <tr><td>Tare Weight:</td><td>${t.tare_weight_kg != null ? (t.tare_weight_kg / 1000).toFixed(3) + " t" : "-"}</td></tr>
        <tr><td style="font-size:14px">Net Weight:</td><td style="font-size:14px">${t.net_weight_kg != null ? (t.net_weight_kg / 1000).toFixed(3) + " t" : "-"}</td></tr>
      </table>
      <div class="line"></div>
      <table>
        <tr><td>1st Weigh:</td><td>${t.first_weigh_at ? format(new Date(t.first_weigh_at), "HH:mm:ss") : "-"}</td></tr>
        <tr><td>2nd Weigh:</td><td>${t.second_weigh_at ? format(new Date(t.second_weigh_at), "HH:mm:ss") : "-"}</td></tr>
        <tr><td>Operator:</td><td>${t.operator_name ?? "-"}</td></tr>
      </table>
      ${t.notes ? `<div class="line"></div><p>Notes: ${t.notes}</p>` : ""}
      <div class="line"></div>
      <div class="footer">Clews Group Ltd</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            WeighOne
          </h1>
          <p className="text-muted-foreground mt-1">Weighbridge & waste measurement</p>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Weigh-In
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>First Weigh — New Transaction</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle Reg *</Label>
                  <Input placeholder="AB12 CDE" value={formData.vehicle_reg} onChange={(e) => setFormData((p) => ({ ...p, vehicle_reg: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Gross Weight (kg) *</Label>
                  <Input type="number" placeholder="0.00" value={formData.gross_weight_kg} onChange={(e) => setFormData((p) => ({ ...p, gross_weight_kg: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Input placeholder="Customer name" value={formData.customer} onChange={(e) => setFormData((p) => ({ ...p, customer: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Input placeholder="Site name" value={formData.site} onChange={(e) => setFormData((p) => ({ ...p, site: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Waste Description</Label>
                  <Input placeholder="Mixed waste" value={formData.waste_description} onChange={(e) => setFormData((p) => ({ ...p, waste_description: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>EWC Code</Label>
                  <Input placeholder="20 03 01" value={formData.ewc_code} onChange={(e) => setFormData((p) => ({ ...p, ewc_code: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Container Type</Label>
                  <Input placeholder="Skip, RoRo, etc." value={formData.container_type} onChange={(e) => setFormData((p) => ({ ...p, container_type: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Input placeholder="Operator name" value={formData.operator_name} onChange={(e) => setFormData((p) => ({ ...p, operator_name: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Additional notes..." value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!formData.vehicle_reg || createMutation.isPending}>
                {createMutation.isPending ? "Recording..." : "Record First Weigh"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Awaiting 2nd Weigh
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground tabular-nums">{pendingTransactions.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground tabular-nums">{todayCompleted.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Weight className="h-4 w-4" /> Today's Net Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground tabular-nums">{todayTotalTonnes.toFixed(2)} t</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending First Weighs */}
      {pendingTransactions.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-600" /> Vehicles On Site — Awaiting 2nd Weigh
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div>
                    <p className="font-mono font-bold text-foreground">{t.vehicle_reg}</p>
                    <p className="text-xs text-muted-foreground">{t.ticket_number} · {t.customer ?? "No customer"}</p>
                    <p className="text-xs text-muted-foreground">Gross: {t.gross_weight_kg != null ? (t.gross_weight_kg / 1000).toFixed(3) + " t" : "-"}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      setSelectedTransaction(t);
                      setSecondWeighDialogOpen(true);
                    }}
                  >
                    <ArrowDownUp className="h-3 w-3" /> 2nd Weigh
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Second Weigh Dialog */}
      <Dialog open={secondWeighDialogOpen} onOpenChange={setSecondWeighDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Second Weigh — {selectedTransaction?.ticket_number}</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Vehicle:</span> <span className="font-mono font-bold">{selectedTransaction.vehicle_reg}</span></div>
                <div><span className="text-muted-foreground">Customer:</span> {selectedTransaction.customer ?? "-"}</div>
                <div><span className="text-muted-foreground">Gross:</span> <span className="font-bold">{selectedTransaction.gross_weight_kg != null ? (selectedTransaction.gross_weight_kg / 1000).toFixed(3) + " t" : "-"}</span></div>
                <div><span className="text-muted-foreground">Waste:</span> {selectedTransaction.waste_description ?? "-"}</div>
              </div>
              <div className="space-y-2">
                <Label>Tare Weight (kg) *</Label>
                <Input type="number" placeholder="0.00" value={secondWeighKg} onChange={(e) => setSecondWeighKg(e.target.value)} autoFocus />
              </div>
              {secondWeighKg && !isNaN(parseFloat(secondWeighKg)) && selectedTransaction.gross_weight_kg != null && (
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground">Net Weight</p>
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {(Math.abs(selectedTransaction.gross_weight_kg - parseFloat(secondWeighKg)) / 1000).toFixed(3)} t
                  </p>
                </div>
              )}
              <Button onClick={() => secondWeighMutation.mutate()} disabled={!secondWeighKg || secondWeighMutation.isPending} className="w-full">
                {secondWeighMutation.isPending ? "Recording..." : "Complete Transaction"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Log */}
      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log" className="gap-2"><Truck className="h-4 w-4" /> Transaction Log</TabsTrigger>
        </TabsList>
        <TabsContent value="log" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search ticket, vehicle, customer..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="first_weigh">First Weigh</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="voided">Voided</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No transactions found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Waste</TableHead>
                        <TableHead className="text-right">Gross (t)</TableHead>
                        <TableHead className="text-right">Tare (t)</TableHead>
                        <TableHead className="text-right">Net (t)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t) => {
                        const cfg = STATUS_CONFIG[t.status];
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono font-medium">{t.ticket_number}</TableCell>
                            <TableCell className="font-mono">{t.vehicle_reg}</TableCell>
                            <TableCell>{t.customer ?? "-"}</TableCell>
                            <TableCell className="max-w-[120px] truncate">{t.waste_description ?? "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{t.gross_weight_kg != null ? (t.gross_weight_kg / 1000).toFixed(3) : "-"}</TableCell>
                            <TableCell className="text-right tabular-nums">{t.tare_weight_kg != null ? (t.tare_weight_kg / 1000).toFixed(3) : "-"}</TableCell>
                            <TableCell className="text-right tabular-nums font-bold">{t.net_weight_kg != null ? (t.net_weight_kg / 1000).toFixed(3) : "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {t.first_weigh_at ? format(new Date(t.first_weigh_at), "dd/MM/yy HH:mm") : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {t.status === "first_weigh" && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      title="2nd Weigh"
                                      onClick={() => {
                                        setSelectedTransaction(t);
                                        setSecondWeighDialogOpen(true);
                                      }}
                                    >
                                      <ArrowDownUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-destructive"
                                      title="Void"
                                      onClick={() => voidMutation.mutate(t.id)}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                                {t.status === "completed" && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    title="Print Ticket"
                                    onClick={() => printTicket(t)}
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  title="View Details"
                                  onClick={() => {
                                    setSelectedTransaction(t);
                                    setTicketDialogOpen(true);
                                  }}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ticket Detail Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ticket {selectedTransaction?.ticket_number}</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Vehicle:</span> <span className="font-mono font-bold">{selectedTransaction.vehicle_reg}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={STATUS_CONFIG[selectedTransaction.status].color}>{STATUS_CONFIG[selectedTransaction.status].label}</Badge></div>
                <div><span className="text-muted-foreground">Customer:</span> {selectedTransaction.customer ?? "-"}</div>
                <div><span className="text-muted-foreground">Site:</span> {selectedTransaction.site ?? "-"}</div>
                <div><span className="text-muted-foreground">Waste:</span> {selectedTransaction.waste_description ?? "-"}</div>
                <div><span className="text-muted-foreground">EWC:</span> {selectedTransaction.ewc_code ?? "-"}</div>
                <div><span className="text-muted-foreground">Container:</span> {selectedTransaction.container_type ?? "-"}</div>
                <div><span className="text-muted-foreground">Operator:</span> {selectedTransaction.operator_name ?? "-"}</div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted/50">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="text-lg font-bold tabular-nums">{selectedTransaction.gross_weight_kg != null ? (selectedTransaction.gross_weight_kg / 1000).toFixed(3) : "-"} t</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Tare</p>
                  <p className="text-lg font-bold tabular-nums">{selectedTransaction.tare_weight_kg != null ? (selectedTransaction.tare_weight_kg / 1000).toFixed(3) : "-"} t</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-xl font-bold tabular-nums text-primary">{selectedTransaction.net_weight_kg != null ? (selectedTransaction.net_weight_kg / 1000).toFixed(3) : "-"} t</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>1st Weigh: {selectedTransaction.first_weigh_at ? format(new Date(selectedTransaction.first_weigh_at), "dd/MM/yyyy HH:mm:ss") : "-"}</div>
                <div>2nd Weigh: {selectedTransaction.second_weigh_at ? format(new Date(selectedTransaction.second_weigh_at), "dd/MM/yyyy HH:mm:ss") : "-"}</div>
              </div>
              {selectedTransaction.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {selectedTransaction.notes}</div>}
              {selectedTransaction.status === "completed" && (
                <Button className="w-full gap-2" variant="outline" onClick={() => printTicket(selectedTransaction)}>
                  <Printer className="h-4 w-4" /> Print Ticket
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeighOnePage;
