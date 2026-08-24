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
import { Scale, Activity, Truck, Plus, Printer, Search, ArrowDownUp, Clock, CheckCircle2, XCircle, Weight, FileText, Trash2, PoundSterling, Settings, Database, HardHat, Users, Pencil } from "lucide-react";
import { WeighOneCMS } from "@/components/weighone/WeighOneCMS";
import MidweighHistory from "@/components/weighone/MidweighHistory";
import { WeighbridgeRatesSettings, useWeighbridgeRates, resolveRate } from "@/components/weighone/WeighbridgeRatesSettings";
import { BanksmanAppGuide } from "@/components/apps/BanksmanAppGuide";
import { YardStaffSettings } from "@/components/route-one/YardStaffSettings";
import { format } from "date-fns";

type WeighbridgeStatus = "first_weigh" | "completed" | "voided";

const PHYSICAL_FORMS = ["Solid", "Liquid", "Sludge", "Powder", "Gas", "Mixed"];
const MEANS_OF_TRANSPORT = ["Road", "Rail", "Sea", "Air", "Inland Waterway"];

/** Job types as set up in Skiptrak */
const JOB_TYPES = [
  { value: "waste_in", label: "Waste IN" },
  { value: "waste_out", label: "Waste OUT" },
  { value: "skip", label: "Skip" },
] as const;

const jobTypeLabel = (v: string | null | undefined) =>
  JOB_TYPES.find((j) => j.value === v)?.label ?? "-";

/** Our own vehicles are Clews Recycling — carrier defaults for Skip jobs */
const OWN_CARRIER_NAME = "Clews Recycling Limited";



interface WeighbridgeTransaction {
  id: string;
  ticket_number: string;
  vehicle_reg: string;
  customer: string | null;
  site: string | null;
  driver_name: string | null;
  waste_description: string | null;
  ewc_code: string | null;
  container_type: string | null;
  gross_weight_kg: number | null;
  tare_weight_kg: number | null;
  net_weight_kg: number | null;
  waste_type_id: string | null;
  price_per_tonne: number | null;
  weight_charge: number | null;
  additional_items_total: number | null;
  total_price: number | null;
  status: WeighbridgeStatus;
  first_weigh_at: string | null;
  second_weigh_at: string | null;
  operator_id: string | null;
  operator_name: string | null;
  notes: string | null;
  carrier_registration: string | null;
  carrier_name: string | null;
  physical_form: string | null;
  means_of_transport: string | null;
  rate_group_id: string | null;
  min_charge: number | null;

  created_at: string;
  updated_at: string;
}

interface WasteType {
  id: string;
  waste_type: string;
  ewc_code: string | null;
  price_per_tonne: number;
  min_charge: number | null;
  is_active: boolean;
  display_order: number;
}

interface AdditionalItem {
  id: string;
  transaction_id: string;
  description: string;
  cost: number;
  display_order: number;
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
  const [wasteTypesDialogOpen, setWasteTypesDialogOpen] = useState(false);
  const [cmsDialogOpen, setCmsDialogOpen] = useState(false);
  const [ratesDialogOpen, setRatesDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<WeighbridgeTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const emptyForm = {
    vehicle_reg: "",
    customer: "",
    site: "",
    driver_name: "",
    waste_type_id: "",
    ewc_code: "",
    container_type: "",
    gross_weight_kg: "",
    operator_name: "",
    notes: "",
    carrier_registration: "",
    carrier_name: "",
    physical_form: "Solid",
    means_of_transport: "Road",
    rate_group_id: "",
  };

  // New transaction form
  const [formData, setFormData] = useState(emptyForm);

  // Edit form (existing transaction)
  const [editForm, setEditForm] = useState({
    ...emptyForm,
    tare_weight_kg: "",
  });

  // Additional items for new transaction
  const [newAdditionalItems, setNewAdditionalItems] = useState<{ description: string; cost: string }[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  // Second weigh form
  const [secondWeighKg, setSecondWeighKg] = useState("");

  // Waste types settings form
  const [newWasteType, setNewWasteType] = useState({ waste_type: "", ewc_code: "", price_per_tonne: "" });

  // Rate groups, per-group prices and additional-item templates
  const { rateGroups, ratePrices, itemTemplates } = useWeighbridgeRates();
  const defaultRateGroup = rateGroups.find((g) => g.is_default) ?? rateGroups[0];


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

  // Fetch waste types
  const { data: wasteTypes = [] } = useQuery({
    queryKey: ["weighbridge-waste-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_waste_types")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as WasteType[];
    },
  });

  // Fetch Midweigh customers
  const { data: midweighCustomers = [] } = useQuery({
    queryKey: ["weighbridge-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_customers")
        .select("id, customer_name")
        .eq("is_active", true)
        .order("customer_name", { ascending: true });
      if (error) throw error;
      return data as { id: string; customer_name: string }[];
    },
  });

  // Fetch Midweigh vehicles
  const { data: midweighVehicles = [] } = useQuery({
    queryKey: ["weighbridge-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_vehicles")
        .select("id, vehicle_reg")
        .eq("is_active", true)
        .order("vehicle_reg", { ascending: true });
      if (error) throw error;
      return data as { id: string; vehicle_reg: string }[];
    },
  });

  // Fetch additional items for selected transaction
  const { data: selectedAdditionalItems = [] } = useQuery({
    queryKey: ["weighbridge-additional-items", selectedTransaction?.id],
    queryFn: async () => {
      if (!selectedTransaction) return [];
      const { data, error } = await supabase
        .from("weighbridge_additional_items")
        .select("*")
        .eq("transaction_id", selectedTransaction.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as AdditionalItem[];
    },
    enabled: !!selectedTransaction,
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

  // Get selected waste type info
  const activeWasteTypes = wasteTypes.filter(wt => wt.is_active);
  const selectedWasteType = activeWasteTypes.find(wt => wt.id === formData.waste_type_id);

  const effectiveRateGroupId = (groupId: string) => groupId || defaultRateGroup?.id || null;

  /** Effective price + min charge for a waste type under the chosen rate group */
  const rateFor = (wasteTypeId: string, rateGroupId: string) => {
    const wt = wasteTypes.find((w) => w.id === wasteTypeId);
    return resolveRate(
      wt ? { price_per_tonne: wt.price_per_tonne, min_charge: wt.min_charge } : undefined,
      ratePrices,
      wasteTypeId,
      effectiveRateGroupId(rateGroupId),
    );
  };

  const chargeFor = (netKg: number, price: number, minCharge: number) =>
    Math.max((netKg / 1000) * price, price > 0 ? minCharge : 0);

  const selectedRate = formData.waste_type_id
    ? rateFor(formData.waste_type_id, formData.rate_group_id)
    : null;

  /** Auto-recognise customer/carrier details from the Data Hub + saved customer record */
  const applyCustomerDefaults = async (customerName: string) => {
    if (!customerName) return;
    const { data } = await supabase
      .from("weighbridge_customers")
      .select("rate_group_id, carrier_name, carrier_registration")
      .ilike("customer_name", customerName)
      .maybeSingle();
    if (!data) return;
    setFormData((p) => ({
      ...p,
      rate_group_id: data.rate_group_id ?? p.rate_group_id,
      carrier_name: data.carrier_name ?? p.carrier_name,
      carrier_registration: data.carrier_registration ?? p.carrier_registration,
    }));
  };

  /** Look up the most recent Data Hub job for a vehicle to pre-fill customer/driver/carrier */
  const autoRecogniseVehicle = async (reg: string) => {
    const clean = reg.trim().toUpperCase();
    if (clean.length < 4) return;

    const { data: hub } = await supabase
      .from("data_hub_jobs")
      .select("customer, site, driver, raw")
      .eq("source", "midweigh")
      .ilike("vehicle_registration", clean)
      .order("job_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastTx } = await supabase
      .from("weighbridge_transactions")
      .select("customer, driver_name, carrier_name, carrier_registration, rate_group_id")
      .eq("vehicle_reg", clean)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customer = lastTx?.customer || hub?.customer || "";
    if (!customer && !lastTx) return;

    setFormData((p) => ({
      ...p,
      customer: p.customer || customer || "",
      site: p.site || hub?.site || "",
      driver_name: p.driver_name || lastTx?.driver_name || hub?.driver || "",
      carrier_name: p.carrier_name || lastTx?.carrier_name || customer || "",
      carrier_registration: p.carrier_registration || lastTx?.carrier_registration || "",
      rate_group_id: p.rate_group_id || lastTx?.rate_group_id || "",
    }));

    if (customer) applyCustomerDefaults(customer);
  };


  // Create first weigh
  const createMutation = useMutation({
    mutationFn: async () => {
      const ticket = await generateTicket();
      const grossKg = parseFloat(formData.gross_weight_kg);
      const wasteType = activeWasteTypes.find(wt => wt.id === formData.waste_type_id);

      const rate = formData.waste_type_id ? rateFor(formData.waste_type_id, formData.rate_group_id) : null;

      const { data: txData, error } = await supabase.from("weighbridge_transactions").insert({
        ticket_number: ticket,
        vehicle_reg: formData.vehicle_reg.toUpperCase(),
        customer: formData.customer || null,
        site: formData.site || null,
        driver_name: formData.driver_name || null,
        waste_description: wasteType?.waste_type || null,
        ewc_code: wasteType?.ewc_code || formData.ewc_code || null,
        container_type: formData.container_type || null,
        gross_weight_kg: isNaN(grossKg) ? null : grossKg,
        waste_type_id: formData.waste_type_id || null,
        price_per_tonne: rate?.price_per_tonne ?? null,
        min_charge: rate?.min_charge ?? null,
        rate_group_id: effectiveRateGroupId(formData.rate_group_id),
        operator_name: formData.operator_name || null,
        notes: formData.notes || null,
        carrier_registration: formData.carrier_registration || null,
        carrier_name: formData.carrier_name || null,
        physical_form: formData.physical_form || null,
        means_of_transport: formData.means_of_transport || "Road",

        status: "first_weigh" as WeighbridgeStatus,
      }).select("id").single();
      if (error) throw error;

      // Insert additional items
      const validItems = newAdditionalItems.filter(item => item.description && item.cost);
      if (validItems.length > 0 && txData) {
        const { error: itemsError } = await supabase.from("weighbridge_additional_items").insert(
          validItems.map((item, idx) => ({
            transaction_id: txData.id,
            description: item.description,
            cost: parseFloat(item.cost) || 0,
            display_order: idx,
          }))
        );
        if (itemsError) throw itemsError;

        // Update additional items total on transaction
        const additionalTotal = validItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
        await supabase.from("weighbridge_transactions")
          .update({ additional_items_total: additionalTotal })
          .eq("id", txData.id);
      }
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
      const ppt = selectedTransaction.price_per_tonne ?? 0;
      const weightCharge = chargeFor(netKg, ppt, selectedTransaction.min_charge ?? 0);
      const additionalTotal = selectedTransaction.additional_items_total ?? 0;
      const totalPrice = weightCharge + additionalTotal;

      const { error } = await supabase
        .from("weighbridge_transactions")
        .update({
          tare_weight_kg: tareKg,
          net_weight_kg: netKg,
          weight_charge: weightCharge,
          total_price: totalPrice,
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

  // Delete transaction (and its additional items)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("weighbridge_additional_items").delete().eq("transaction_id", id);
      const { error } = await supabase.from("weighbridge_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction deleted");
      queryClient.invalidateQueries({ queryKey: ["weighbridge-transactions"] });
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  // Open the edit dialog for a transaction
  const openEdit = (t: WeighbridgeTransaction) => {
    setSelectedTransaction(t);
    setEditForm({
      vehicle_reg: t.vehicle_reg ?? "",
      customer: t.customer ?? "",
      site: t.site ?? "",
      driver_name: t.driver_name ?? "",
      waste_type_id: t.waste_type_id ?? "",
      ewc_code: t.ewc_code ?? "",
      container_type: t.container_type ?? "",
      gross_weight_kg: t.gross_weight_kg != null ? String(t.gross_weight_kg) : "",
      operator_name: t.operator_name ?? "",
      notes: t.notes ?? "",
      carrier_registration: t.carrier_registration ?? "",
      carrier_name: t.carrier_name ?? "",
      physical_form: t.physical_form ?? "Solid",
      means_of_transport: t.means_of_transport ?? "Road",
      rate_group_id: t.rate_group_id ?? "",
      tare_weight_kg: t.tare_weight_kg != null ? String(t.tare_weight_kg) : "",
    });
    setEditDialogOpen(true);
  };

  // Save edits to an existing transaction
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTransaction) throw new Error("No transaction selected");
      const wasteType = wasteTypes.find((wt) => wt.id === editForm.waste_type_id);
      const rate = editForm.waste_type_id ? rateFor(editForm.waste_type_id, editForm.rate_group_id) : null;

      const grossKg = editForm.gross_weight_kg === "" ? null : parseFloat(editForm.gross_weight_kg);
      const tareKg = editForm.tare_weight_kg === "" ? null : parseFloat(editForm.tare_weight_kg);
      const netKg = grossKg != null && tareKg != null ? Math.abs(grossKg - tareKg) : null;
      const ppt = rate?.price_per_tonne ?? selectedTransaction.price_per_tonne ?? 0;
      const weightCharge = netKg != null ? chargeFor(netKg, ppt, rate?.min_charge ?? selectedTransaction.min_charge ?? 0) : null;
      const additionalTotal = selectedTransaction.additional_items_total ?? 0;

      const { error } = await supabase
        .from("weighbridge_transactions")
        .update({
          vehicle_reg: editForm.vehicle_reg.toUpperCase(),
          customer: editForm.customer || null,
          site: editForm.site || null,
          driver_name: editForm.driver_name || null,
          waste_type_id: editForm.waste_type_id || null,
          waste_description: wasteType?.waste_type ?? selectedTransaction.waste_description,
          ewc_code: editForm.ewc_code || wasteType?.ewc_code || null,
          container_type: editForm.container_type || null,
          gross_weight_kg: grossKg,
          tare_weight_kg: tareKg,
          net_weight_kg: netKg,
          price_per_tonne: ppt || null,
          min_charge: rate?.min_charge ?? selectedTransaction.min_charge,
          rate_group_id: effectiveRateGroupId(editForm.rate_group_id),
          weight_charge: weightCharge,
          total_price: weightCharge != null ? weightCharge + additionalTotal : selectedTransaction.total_price,
          operator_name: editForm.operator_name || null,
          notes: editForm.notes || null,
          carrier_registration: editForm.carrier_registration || null,
          carrier_name: editForm.carrier_name || null,
          physical_form: editForm.physical_form || null,
          means_of_transport: editForm.means_of_transport || "Road",
          status: netKg != null && selectedTransaction.status !== "voided"
            ? ("completed" as WeighbridgeStatus)
            : selectedTransaction.status,
          second_weigh_at: netKg != null ? selectedTransaction.second_weigh_at ?? new Date().toISOString() : selectedTransaction.second_weigh_at,
        })
        .eq("id", selectedTransaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction updated");
      setEditDialogOpen(false);
      setSelectedTransaction(null);
      queryClient.invalidateQueries({ queryKey: ["weighbridge-transactions"] });
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });


  // Add waste type
  const addWasteTypeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("weighbridge_waste_types").insert({
        waste_type: newWasteType.waste_type,
        ewc_code: newWasteType.ewc_code || null,
        price_per_tonne: parseFloat(newWasteType.price_per_tonne) || 0,
        display_order: wasteTypes.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Waste type added");
      setNewWasteType({ waste_type: "", ewc_code: "", price_per_tonne: "" });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-waste-types"] });
    },
    onError: (e) => toast.error("Failed: " + e.message),
  });

  // Delete waste type
  const deleteWasteTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weighbridge_waste_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weighbridge-waste-types"] });
      toast.success("Waste type removed");
    },
  });

  // Update waste type price
  const updateWasteTypeMutation = useMutation({
    mutationFn: async ({ id, price_per_tonne }: { id: string; price_per_tonne: number }) => {
      const { error } = await supabase.from("weighbridge_waste_types").update({ price_per_tonne }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weighbridge-waste-types"] });
    },
  });

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setNewAdditionalItems([]);
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
  const todayTotalRevenue = todayCompleted.reduce((sum, t) => sum + (t.total_price ?? 0), 0);

  const fmtWeight = (kg: number | null) => kg != null ? (kg / 1000).toFixed(3) : "-";
  const fmtPrice = (val: number | null) => val != null ? `£${val.toFixed(2)}` : "-";

  const printTicket = (t: WeighbridgeTransaction, additionalItems: AdditionalItem[] = []) => {
    const additionalItemsHtml = additionalItems.length > 0
      ? `<div class="line"></div><table>${additionalItems.map(i => `<tr><td>${i.description}</td><td>£${i.cost.toFixed(2)}</td></tr>`).join("")}</table>`
      : "";

    const win = window.open("", "_blank", "width=400,height=700");
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
        .total { font-size: 14px; font-weight: bold; }
      </style></head><body>
      <h1>WEIGHBRIDGE TICKET</h1>
      <h2>${t.ticket_number}</h2>
      <div class="line"></div>
      <table>
        <tr><td>Date:</td><td>${t.first_weigh_at ? format(new Date(t.first_weigh_at), "dd/MM/yyyy HH:mm") : "-"}</td></tr>
        <tr><td>Vehicle:</td><td>${t.vehicle_reg}</td></tr>
        <tr><td>Customer:</td><td>${t.customer ?? "-"}</td></tr>
        <tr><td>Driver:</td><td>${t.driver_name ?? "-"}</td></tr>
        <tr><td>Site:</td><td>${t.site ?? "-"}</td></tr>
        <tr><td>Waste:</td><td>${t.waste_description ?? "-"}</td></tr>
        <tr><td>EWC Code:</td><td>${t.ewc_code ?? "-"}</td></tr>
        <tr><td>Container:</td><td>${t.container_type ?? "-"}</td></tr>
        <tr><td>Physical Form:</td><td>${t.physical_form ?? "-"}</td></tr>
        <tr><td>Carrier:</td><td>${t.carrier_name ?? "-"}</td></tr>
        <tr><td>Carrier Reg No:</td><td>${t.carrier_registration ?? "-"}</td></tr>
        <tr><td>Transport:</td><td>${t.means_of_transport ?? "Road"}</td></tr>

      </table>
      <div class="line"></div>
      <table>
        <tr><td>Gross Weight:</td><td>${fmtWeight(t.gross_weight_kg)} t</td></tr>
        <tr><td>Tare Weight:</td><td>${fmtWeight(t.tare_weight_kg)} t</td></tr>
        <tr><td style="font-size:14px">Net Weight:</td><td style="font-size:14px">${fmtWeight(t.net_weight_kg)} t</td></tr>
      </table>
      <div class="line"></div>
      <table>
        <tr><td>Price/Tonne:</td><td>${t.price_per_tonne != null ? `£${t.price_per_tonne.toFixed(2)}` : "-"}</td></tr>
        <tr><td>Weight Charge:</td><td>${fmtPrice(t.weight_charge)}</td></tr>
      </table>
      ${additionalItemsHtml}
      ${t.additional_items_total ? `<table><tr><td>Additional Items:</td><td>£${t.additional_items_total.toFixed(2)}</td></tr></table>` : ""}
      <div class="line"></div>
      <table><tr><td class="total">TOTAL:</td><td class="total">${fmtPrice(t.total_price)}</td></tr></table>
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

  // Compute preview pricing for second weigh dialog
  const secondWeighNetKg = selectedTransaction && secondWeighKg && !isNaN(parseFloat(secondWeighKg))
    ? Math.abs((selectedTransaction.gross_weight_kg ?? 0) - parseFloat(secondWeighKg))
    : null;
  const secondWeighNetTonnes = secondWeighNetKg != null ? secondWeighNetKg / 1000 : null;
  const secondWeighWeightCharge = secondWeighNetTonnes != null && selectedTransaction?.price_per_tonne
    ? secondWeighNetTonnes * selectedTransaction.price_per_tonne
    : null;
  const secondWeighTotal = secondWeighWeightCharge != null
    ? secondWeighWeightCharge + (selectedTransaction?.additional_items_total ?? 0)
    : null;

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-6">
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
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setCmsDialogOpen(true)}>
            <Database className="h-4 w-4" /> Vehicles & Customers
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setWasteTypesDialogOpen(true)}>
            <Settings className="h-4 w-4" /> Waste Types
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setRatesDialogOpen(true)}>
            <PoundSterling className="h-4 w-4" /> Prices & Rates
          </Button>
          <Dialog open={newDialogOpen} onOpenChange={(open) => { setNewDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Weigh-In
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>First Weigh — New Transaction</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vehicle Reg *</Label>
                    <div className="relative">
                      <Input
                        placeholder="Search or type reg..."
                        value={formData.vehicle_reg}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, vehicle_reg: e.target.value }));
                          setVehicleSearch(e.target.value);
                        }}
                        onFocus={() => setVehicleSearch(formData.vehicle_reg)}
                        onBlur={(e) => {
                          setTimeout(() => setVehicleSearch(""), 200);
                          autoRecogniseVehicle(e.target.value);
                        }}
                      />
                      {vehicleSearch && formData.vehicle_reg && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {midweighVehicles
                            .filter(v => v.vehicle_reg.toLowerCase().includes(formData.vehicle_reg.toLowerCase()))
                            .slice(0, 20)
                            .map(v => (
                              <button
                                key={v.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFormData(p => ({ ...p, vehicle_reg: v.vehicle_reg }));
                                  setVehicleSearch("");
                                  autoRecogniseVehicle(v.vehicle_reg);
                                }}
                              >
                                {v.vehicle_reg}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Gross Weight (kg) *</Label>
                    <Input type="number" placeholder="0.00" value={formData.gross_weight_kg} onChange={(e) => setFormData((p) => ({ ...p, gross_weight_kg: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <div className="relative">
                      <Input
                        placeholder="Search customer..."
                        value={formData.customer}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, customer: e.target.value }));
                          setCustomerSearch(e.target.value);
                        }}
                        onFocus={() => setCustomerSearch(formData.customer)}
                        onBlur={(e) => {
                          setTimeout(() => setCustomerSearch(""), 200);
                          applyCustomerDefaults(e.target.value);
                        }}
                      />
                      {customerSearch && formData.customer && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {midweighCustomers
                            .filter(c => c.customer_name.toLowerCase().includes(formData.customer.toLowerCase()))
                            .slice(0, 20)
                            .map(c => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFormData(p => ({ ...p, customer: c.customer_name }));
                                  setCustomerSearch("");
                                  applyCustomerDefaults(c.customer_name);
                                }}
                              >
                                {c.customer_name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <Input placeholder="Site name" value={formData.site} onChange={(e) => setFormData((p) => ({ ...p, site: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Driver Name</Label>
                  <Input placeholder="Driver name" value={formData.driver_name} onChange={(e) => setFormData((p) => ({ ...p, driver_name: e.target.value }))} />
                </div>

                {/* Waste Type + Rate Group */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Waste Type</Label>
                    <Select value={formData.waste_type_id} onValueChange={(val) => setFormData((p) => ({ ...p, waste_type_id: val }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select waste type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeWasteTypes.map((wt) => (
                          <SelectItem key={wt.id} value={wt.id}>{wt.waste_type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rate Group</Label>
                    <Select
                      value={formData.rate_group_id || defaultRateGroup?.id || ""}
                      onValueChange={(val) => setFormData((p) => ({ ...p, rate_group_id: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Trade Rates" />
                      </SelectTrigger>
                      <SelectContent>
                        {rateGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}{g.is_default ? " (default)" : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedWasteType && selectedRate && (
                  <div className="flex flex-wrap items-center gap-2 text-sm p-2 rounded bg-muted/50">
                    <PoundSterling className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Price per tonne:</span>
                    <span className="font-bold">£{selectedRate.price_per_tonne.toFixed(2)}</span>
                    {selectedRate.min_charge > 0 && (
                      <span className="text-muted-foreground">· Min charge £{selectedRate.min_charge.toFixed(2)}</span>
                    )}
                    {selectedWasteType.ewc_code && (
                      <span className="text-muted-foreground ml-2">EWC: {selectedWasteType.ewc_code}</span>
                    )}
                  </div>
                )}

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

                {/* Digital Waste Tracking fields */}
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <Label className="text-sm font-semibold">Digital Waste Tracking</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Carrier Registration</Label>
                      <Input placeholder="e.g. CBDU203180" value={formData.carrier_registration} onChange={(e) => setFormData((p) => ({ ...p, carrier_registration: e.target.value.toUpperCase() }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Carrier Name</Label>
                      <Input placeholder="Carrier / haulier" value={formData.carrier_name} onChange={(e) => setFormData((p) => ({ ...p, carrier_name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Physical Form</Label>
                      <Select value={formData.physical_form} onValueChange={(val) => setFormData((p) => ({ ...p, physical_form: val }))}>
                        <SelectTrigger><SelectValue placeholder="Select form..." /></SelectTrigger>
                        <SelectContent>
                          {PHYSICAL_FORMS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Means of Transport</Label>
                      <Select value={formData.means_of_transport} onValueChange={(val) => setFormData((p) => ({ ...p, means_of_transport: val }))}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {MEANS_OF_TRANSPORT.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>EWC Code (override)</Label>
                      <Input placeholder="e.g. 20 03 01" value={formData.ewc_code} onChange={(e) => setFormData((p) => ({ ...p, ewc_code: e.target.value }))} />
                    </div>
                  </div>
                </div>


                {/* Additional Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Additional Items</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 h-7 text-xs"
                      onClick={() => setNewAdditionalItems([...newAdditionalItems, { description: "", cost: "" }])}
                    >
                      <Plus className="h-3 w-3" /> Add Item
                    </Button>
                  </div>
                  {itemTemplates.filter((t) => t.is_active).length > 0 && (
                    <Select
                      value=""
                      onValueChange={(id) => {
                        const tpl = itemTemplates.find((t) => t.id === id);
                        if (!tpl) return;
                        setNewAdditionalItems((prev) => [...prev, { description: tpl.name, cost: String(tpl.cost) }]);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Add from templates..." />
                      </SelectTrigger>
                      <SelectContent>
                        {itemTemplates.filter((t) => t.is_active).map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name} — £{t.cost.toFixed(2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {newAdditionalItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...newAdditionalItems];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setNewAdditionalItems(updated);
                        }}
                        className="flex-1"
                      />
                      <div className="relative w-28">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={item.cost}
                          onChange={(e) => {
                            const updated = [...newAdditionalItems];
                            updated[idx] = { ...updated[idx], cost: e.target.value };
                            setNewAdditionalItems(updated);
                          }}
                          className="pl-7"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive shrink-0"
                        onClick={() => setNewAdditionalItems(newAdditionalItems.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {newAdditionalItems.length > 0 && (
                    <div className="text-sm text-right text-muted-foreground">
                      Additional total: <span className="font-bold text-foreground">
                        £{newAdditionalItems.reduce((sum, i) => sum + (parseFloat(i.cost) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  )}
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PoundSterling className="h-4 w-4" /> Today's Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground tabular-nums">£{todayTotalRevenue.toFixed(2)}</p>
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
                    <p className="text-xs text-muted-foreground">Gross: {fmtWeight(t.gross_weight_kg)} t</p>
                    {t.waste_description && <p className="text-xs text-muted-foreground">{t.waste_description}</p>}
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
                <div><span className="text-muted-foreground">Waste:</span> {selectedTransaction.waste_description ?? "-"}</div>
                <div><span className="text-muted-foreground">Price/t:</span> {selectedTransaction.price_per_tonne != null ? `£${selectedTransaction.price_per_tonne.toFixed(2)}` : "-"}</div>
              </div>

              {/* Weight display */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted/50">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="text-lg font-bold tabular-nums">{fmtWeight(selectedTransaction.gross_weight_kg)} t</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Tare</p>
                  <p className="text-lg font-bold tabular-nums">{secondWeighKg && !isNaN(parseFloat(secondWeighKg)) ? fmtWeight(parseFloat(secondWeighKg)) : "-"} t</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-xl font-bold tabular-nums text-primary">{secondWeighNetKg != null ? fmtWeight(secondWeighNetKg) : "-"} t</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tare Weight (kg) *</Label>
                <Input type="number" placeholder="0.00" value={secondWeighKg} onChange={(e) => setSecondWeighKg(e.target.value)} autoFocus />
              </div>

              {/* Pricing preview */}
              {secondWeighNetKg != null && (
                <div className="p-3 rounded-lg border border-border space-y-1 text-sm">
                  {selectedTransaction.price_per_tonne != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weight charge ({secondWeighNetTonnes?.toFixed(3)} t × £{selectedTransaction.price_per_tonne.toFixed(2)})</span>
                      <span className="font-medium">{fmtPrice(secondWeighWeightCharge)}</span>
                    </div>
                  )}
                  {(selectedTransaction.additional_items_total ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Additional items</span>
                      <span className="font-medium">£{(selectedTransaction.additional_items_total ?? 0).toFixed(2)}</span>
                    </div>
                  )}
                  {secondWeighTotal != null && (
                    <div className="flex justify-between pt-1 border-t border-border font-bold">
                      <span>Total</span>
                      <span>{fmtPrice(secondWeighTotal)}</span>
                    </div>
                  )}
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
          <TabsTrigger value="midweigh" className="gap-2"><Scale className="h-4 w-4" /> Midweigh Data</TabsTrigger>
          <TabsTrigger value="banksman" className="gap-2"><HardHat className="h-4 w-4" /> Banksman App</TabsTrigger>
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
                        <TableHead className="text-right">£/t</TableHead>
                        <TableHead className="text-right">Total (£)</TableHead>
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
                            <TableCell className="text-right tabular-nums">{fmtWeight(t.gross_weight_kg)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtWeight(t.tare_weight_kg)}</TableCell>
                            <TableCell className="text-right tabular-nums font-bold">{fmtWeight(t.net_weight_kg)}</TableCell>
                            <TableCell className="text-right tabular-nums">{t.price_per_tonne != null ? t.price_per_tonne.toFixed(2) : "-"}</TableCell>
                            <TableCell className="text-right tabular-nums font-bold">{fmtPrice(t.total_price)}</TableCell>
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
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  title="Edit"
                                  onClick={() => openEdit(t)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  title="Delete"
                                  onClick={() => {
                                    if (confirm(`Delete ticket ${t.ticket_number}? This cannot be undone.`)) {
                                      deleteMutation.mutate(t.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
        <TabsContent value="midweigh" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <MidweighHistory />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="banksman" className="mt-4">
          <Tabs defaultValue="guide" className="space-y-4">
            <TabsList>
              <TabsTrigger value="guide" className="gap-2"><HardHat className="h-4 w-4" /> Setup Guide</TabsTrigger>
              <TabsTrigger value="yard-staff" className="gap-2"><Users className="h-4 w-4" /> Yard Staff</TabsTrigger>
            </TabsList>
            <TabsContent value="guide">
              <BanksmanAppGuide />
            </TabsContent>
            <TabsContent value="yard-staff">
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <YardStaffSettings />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
                <div><span className="text-muted-foreground">Driver:</span> {selectedTransaction.driver_name ?? "-"}</div>
                <div><span className="text-muted-foreground">Site:</span> {selectedTransaction.site ?? "-"}</div>
                <div><span className="text-muted-foreground">Waste:</span> {selectedTransaction.waste_description ?? "-"}</div>
                <div><span className="text-muted-foreground">EWC:</span> {selectedTransaction.ewc_code ?? "-"}</div>
                <div><span className="text-muted-foreground">Container:</span> {selectedTransaction.container_type ?? "-"}</div>
                <div><span className="text-muted-foreground">Physical form:</span> {selectedTransaction.physical_form ?? "-"}</div>
                <div><span className="text-muted-foreground">Carrier:</span> {selectedTransaction.carrier_name ?? "-"}</div>
                <div><span className="text-muted-foreground">Carrier reg no:</span> {selectedTransaction.carrier_registration ?? "-"}</div>
                <div><span className="text-muted-foreground">Transport:</span> {selectedTransaction.means_of_transport ?? "Road"}</div>

                <div><span className="text-muted-foreground">Operator:</span> {selectedTransaction.operator_name ?? "-"}</div>
              </div>

              {/* Weights */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-muted/50">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Gross</p>
                  <p className="text-lg font-bold tabular-nums">{fmtWeight(selectedTransaction.gross_weight_kg)} t</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Tare</p>
                  <p className="text-lg font-bold tabular-nums">{fmtWeight(selectedTransaction.tare_weight_kg)} t</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className="text-xl font-bold tabular-nums text-primary">{fmtWeight(selectedTransaction.net_weight_kg)} t</p>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-3 rounded-lg border border-border space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per tonne</span>
                  <span>{selectedTransaction.price_per_tonne != null ? `£${selectedTransaction.price_per_tonne.toFixed(2)}` : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight charge</span>
                  <span>{fmtPrice(selectedTransaction.weight_charge)}</span>
                </div>
                {selectedAdditionalItems.length > 0 && (
                  <>
                    <div className="pt-1 border-t border-border">
                      <p className="text-xs text-muted-foreground font-medium mb-1">Additional Items:</p>
                      {selectedAdditionalItems.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span className="text-muted-foreground">{item.description}</span>
                          <span>£{item.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex justify-between pt-1 border-t border-border font-bold">
                  <span>Total</span>
                  <span>{fmtPrice(selectedTransaction.total_price)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>1st Weigh: {selectedTransaction.first_weigh_at ? format(new Date(selectedTransaction.first_weigh_at), "dd/MM/yyyy HH:mm:ss") : "-"}</div>
                <div>2nd Weigh: {selectedTransaction.second_weigh_at ? format(new Date(selectedTransaction.second_weigh_at), "dd/MM/yyyy HH:mm:ss") : "-"}</div>
              </div>
              {selectedTransaction.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {selectedTransaction.notes}</div>}
              {selectedTransaction.status === "completed" && (
                <Button className="w-full gap-2" variant="outline" onClick={() => printTicket(selectedTransaction, selectedAdditionalItems)}>
                  <Printer className="h-4 w-4" /> Print Ticket
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Waste Types Settings Dialog */}
      <Dialog open={wasteTypesDialogOpen} onOpenChange={setWasteTypesDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Waste Types & Pricing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing waste types */}
            {wasteTypes.length > 0 && (
              <div className="space-y-2">
                {wasteTypes.map((wt) => (
                  <div key={wt.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{wt.waste_type}</p>
                      {wt.ewc_code && <p className="text-xs text-muted-foreground">EWC: {wt.ewc_code}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">£/t:</span>
                      <Input
                        type="number"
                        className="w-24 h-8 text-sm"
                        value={wt.price_per_tonne}
                        onChange={(e) => updateWasteTypeMutation.mutate({ id: wt.id, price_per_tonne: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => deleteWasteTypeMutation.mutate(wt.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new waste type */}
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Add New Waste Type</p>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Waste type"
                  value={newWasteType.waste_type}
                  onChange={(e) => setNewWasteType(p => ({ ...p, waste_type: e.target.value }))}
                />
                <Input
                  placeholder="EWC code"
                  value={newWasteType.ewc_code}
                  onChange={(e) => setNewWasteType(p => ({ ...p, ewc_code: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="£/tonne"
                  value={newWasteType.price_per_tonne}
                  onChange={(e) => setNewWasteType(p => ({ ...p, price_per_tonne: e.target.value }))}
                />
              </div>
              <Button
                size="sm"
                className="w-full gap-1"
                disabled={!newWasteType.waste_type || addWasteTypeMutation.isPending}
                onClick={() => addWasteTypeMutation.mutate()}
              >
                <Plus className="h-4 w-4" /> Add Waste Type
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Vehicles & Customers CMS Dialog */}
      <Dialog open={cmsDialogOpen} onOpenChange={setCmsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vehicles & Customers</DialogTitle>
          </DialogHeader>
          <WeighOneCMS />
        </DialogContent>
      </Dialog>

      {/* Prices & Rates settings */}
      <Dialog open={ratesDialogOpen} onOpenChange={setRatesDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prices & Rates</DialogTitle>
          </DialogHeader>
          <WeighbridgeRatesSettings />
        </DialogContent>
      </Dialog>

      {/* Edit transaction */}
      <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) setSelectedTransaction(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Ticket {selectedTransaction?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehicle Reg</Label>
                <Input value={editForm.vehicle_reg} onChange={(e) => setEditForm((p) => ({ ...p, vehicle_reg: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Input value={editForm.customer} onChange={(e) => setEditForm((p) => ({ ...p, customer: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Site</Label>
                <Input value={editForm.site} onChange={(e) => setEditForm((p) => ({ ...p, site: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Driver</Label>
                <Input value={editForm.driver_name} onChange={(e) => setEditForm((p) => ({ ...p, driver_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Waste Type</Label>
                <Select value={editForm.waste_type_id} onValueChange={(val) => setEditForm((p) => ({ ...p, waste_type_id: val }))}>
                  <SelectTrigger><SelectValue placeholder="Select waste type..." /></SelectTrigger>
                  <SelectContent>
                    {activeWasteTypes.map((wt) => (
                      <SelectItem key={wt.id} value={wt.id}>{wt.waste_type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rate Group</Label>
                <Select
                  value={editForm.rate_group_id || defaultRateGroup?.id || ""}
                  onValueChange={(val) => setEditForm((p) => ({ ...p, rate_group_id: val }))}
                >
                  <SelectTrigger><SelectValue placeholder="Trade Rates" /></SelectTrigger>
                  <SelectContent>
                    {rateGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}{g.is_default ? " (default)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gross Weight (kg)</Label>
                <Input type="number" value={editForm.gross_weight_kg} onChange={(e) => setEditForm((p) => ({ ...p, gross_weight_kg: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tare Weight (kg)</Label>
                <Input type="number" value={editForm.tare_weight_kg} onChange={(e) => setEditForm((p) => ({ ...p, tare_weight_kg: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carrier Name</Label>
                <Input value={editForm.carrier_name} onChange={(e) => setEditForm((p) => ({ ...p, carrier_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Carrier Registration</Label>
                <Input value={editForm.carrier_registration} onChange={(e) => setEditForm((p) => ({ ...p, carrier_registration: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Physical Form</Label>
                <Input value={editForm.physical_form} onChange={(e) => setEditForm((p) => ({ ...p, physical_form: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Container Type</Label>
                <Input value={editForm.container_type} onChange={(e) => setEditForm((p) => ({ ...p, container_type: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeighOnePage;
