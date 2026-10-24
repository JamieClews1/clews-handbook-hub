import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Route,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Truck,
  User,
  GripVertical,
  MoreVertical,
  Clock,
  MapPin,
  AlertTriangle,
  Settings,
  Pencil,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DriverSettings } from "@/components/route-one/DriverSettings";
import { DaySheetPrintDialog } from "@/components/route-one/DaySheetPrintDialog";
import { FinaliseDayDialog } from "@/components/route-one/FinaliseDayDialog";
import { skiptrakWtnJob } from "@/lib/imported-ticket-print";
import { DriverVehicleBoard } from "@/components/route-one/DriverVehicleBoard";
import { groupDriversByVehicle, dailyBoardVehicle } from "@/lib/route-one-vehicle-groups";
import { VehicleSettings } from "@/components/route-one/VehicleSettings";
import { RoutingRulesSettings } from "@/components/route-one/RoutingRulesSettings";
import { useRoutingRules } from "@/hooks/useRoutingRules";
import { RoutingProposalDialog } from "@/components/route-one/RoutingProposalDialog";
import { resolveDriverId, type PlannerJob, type PlannerDriver } from "@/lib/route-planner";
import { DriverAppManagement } from "@/components/route-one/DriverAppManagement";
import { YardStaffSettings } from "@/components/route-one/YardStaffSettings";
import DriverTrackingMap from "@/components/route-one/DriverTrackingMap";
import { JobFormFields, computeJobTotals } from "@/components/route-one/JobFormFields";
import { BookingWindowsPanel } from "@/components/route-one/BookingWindowsPanel";
import { downloadWtnPdf, printWtnPdf } from "@/lib/route-one-wtn";
import { FileDown, Printer, Send, Radio, PoundSterling } from "lucide-react";
import { invoiceFromSource } from "@/components/finance/ReadyToInvoiceTab";
import { TicketSendDialog } from "@/components/route-one/TicketSendDialog";
import { PermitBadge } from "@/components/permits/PermitBadge";

import { JobPodSection } from "@/components/route-one/JobPodSection";
import { JobPhotosSection } from "@/components/route-one/JobPhotosSection";
import { SkiptrakSiteDetails } from "@/components/route-one/SkiptrakSiteDetails";
import { WtnJobSignatures } from "@/components/wtn";
import { BespokeRateEditor } from "@/components/route-one/BespokeRateEditor";
import { CostItemsSettings } from "@/components/route-one/CostItemsSettings";
import { JobTypesSettings } from "@/components/route-one/JobTypesSettings";
import { ContainerTypesSettings } from "@/components/route-one/ContainerTypesSettings";
import { WtnDesignSettings } from "@/components/route-one/WtnDesignSettings";
import { useJobTypes, jobTypeLabel, jobTypeSolidClass, isConfiguredJobType, jobTypeAccentClass } from "@/components/route-one/jobTypes";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JobPriceSummary } from "@/components/route-one/JobPriceSummary";
import { newExchangeForm } from "@/lib/route-job-exchange";
import { importedBookingPrices } from "@/lib/route-booking-pricing";
import { loadExchangeBookingDate } from "@/lib/load-exchange-booking-date";
import { importedSiteDetails } from "@/lib/route-booking-sites";
import { Save, Repeat2, X } from "lucide-react";
import { TintedJobCard } from "@/components/route-one/TintedJobCard";
import { boardCapacity, boardRegistration, boardUnconfirmed } from "@/lib/route-board-presentation";
import { Search } from "lucide-react";
import { Columns3 } from "lucide-react";

// Columns available in the List view. Each column knows how to read its value
// from a native RouteOne job and from a Skiptrak (data hub) job.
interface ListColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  getNative: (job: any, driver?: any) => ReactNode;
  getSkiptrak: (sj: any) => ReactNode;
}

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yy") : "");
const fmtWeight = (w: number | null | undefined) => (w != null ? `${w}t` : "—");

const LIST_COLUMNS: ListColumnDef[] = [
  { key: "job_number", label: "Job No", defaultVisible: true, getNative: (j) => j.job_number || "—", getSkiptrak: (s) => s.job_number || "—" },
  { key: "status", label: "Status", defaultVisible: true, getNative: () => null, getSkiptrak: () => null }, // rendered specially
  { key: "customer", label: "Customer", defaultVisible: true, getNative: (j) => j.customer_name, getSkiptrak: (s) => s.customer || "Unknown" },
  { key: "site", label: "Site", defaultVisible: true, getNative: (j) => j.site_name || "—", getSkiptrak: (s) => s.site || "—" },
  { key: "type", label: "Type", defaultVisible: true, getNative: (j) => j.job_type, getSkiptrak: (s) => s.movement_type || "—" },
  { key: "container", label: "Container", defaultVisible: true, getNative: (j) => j.container_type || "—", getSkiptrak: (s) => s.container_type || "—" },
  { key: "weight", label: "Net Weight", defaultVisible: true, getNative: (j) => fmtWeight(j.net_weight_t ?? j.weight_t), getSkiptrak: (s) => fmtWeight(s.weight_t) },
  { key: "waste", label: "Waste", defaultVisible: true, getNative: (j) => j.waste_type || "—", getSkiptrak: (s) => s.waste_description || "—" },
  { key: "driver", label: "Driver", defaultVisible: true, getNative: (_j, d) => d?.driver_name || "Unassigned", getSkiptrak: (s) => s.driver || "—" },
  { key: "date", label: "Date", defaultVisible: true, getNative: (j) => fmtDate(j.scheduled_date), getSkiptrak: (s) => fmtDate(s.job_date) },
  { key: "po", label: "PO", defaultVisible: true, getNative: (j) => j.po_number || "—", getSkiptrak: (s) => s.order_number_override || "—" },
  { key: "postcode", label: "Postcode", defaultVisible: false, getNative: (j) => j.site_postcode || "—", getSkiptrak: (s) => s.postcode || "—" },
  { key: "ewc", label: "EWC", defaultVisible: false, getNative: (j) => j.ewc_code || "—", getSkiptrak: (s) => s.ewc || "—" },
  { key: "vehicle", label: "Vehicle", defaultVisible: false, getNative: (j) => j.vehicle_reg || "—", getSkiptrak: (s) => s.vehicle_registration || "—" },
  { key: "tipping", label: "Tipping Location", defaultVisible: false, getNative: (j) => j.disposal_site || "—", getSkiptrak: (s) => s.tipping_location || "—" },
  { key: "category", label: "Category", defaultVisible: false, getNative: () => "—", getSkiptrak: (s) => s.category || "—" },
  { key: "haulier", label: "Haulier", defaultVisible: false, getNative: (j) => j.carrier_name || "—", getSkiptrak: (s) => s.haulier || "—" },
  { key: "account_code", label: "Account Code", defaultVisible: false, getNative: (j) => j.account_code || "—", getSkiptrak: (s) => s.account_code || "—" },
  { key: "source", label: "Source", defaultVisible: true, getNative: () => "Native", getSkiptrak: () => "Skiptrak" },
];

const LIST_COLUMNS_STORAGE_KEY = "routeone-list-columns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type JobType = "delivery" | "exchange" | "collection" | "waste_truck" | "wasted_journey" | "waste_out_skip";
type JobStatus = "unassigned" | "assigned" | "in_progress" | "completed" | "query";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  delivery: "Delivery",
  exchange: "Exchange",
  collection: "Collection",
  waste_truck: "Waste Truck",
  wasted_journey: "Wasted Journey",
  waste_out_skip: "Waste Out Skip",
};

// Legacy fully-colored card style — retained for detail dialogs and list badges.
const JOB_TYPE_COLORS: Record<JobType, string> = {
  delivery: "bg-emerald-700 border-emerald-800 text-white",
  exchange: "bg-amber-400 border-amber-500 text-amber-950",
  collection: "bg-orange-700 border-orange-800 text-white",
  waste_truck: "bg-blue-600 border-blue-700 text-white",
  wasted_journey: "bg-red-600 border-red-700 text-white",
  waste_out_skip: "bg-slate-700 border-slate-800 text-white",
};

const JOB_TYPE_BADGE_COLORS: Record<JobType, string> = {
  delivery: "bg-white/25 text-white hover:bg-white/35 border-0",
  exchange: "bg-white/25 text-white hover:bg-white/35 border-0",
  collection: "bg-white/25 text-white hover:bg-white/35 border-0",
  waste_truck: "bg-white/25 text-white hover:bg-white/35 border-0",
  wasted_journey: "bg-white/25 text-white hover:bg-white/35 border-0",
  waste_out_skip: "bg-white/25 text-white hover:bg-white/35 border-0",
};

// Kanban job-card accent bar (3px, square-cornered, left edge).
const JOB_TYPE_ACCENT: Record<JobType, string> = {
  delivery: "bg-emerald-500",
  exchange: "bg-amber-500",
  collection: "bg-orange-500",
  waste_truck: "bg-blue-500",
  wasted_journey: "bg-red-500",
  waste_out_skip: "bg-slate-600",
};

// Independent tag colors used for the job-type pill on kanban cards.
const JOB_TYPE_TAG: Record<JobType, string> = {
  delivery: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
  exchange: "bg-amber-500/10 text-amber-700 border border-amber-500/20",
  collection: "bg-orange-500/10 text-orange-700 border border-orange-500/20",
  waste_truck: "bg-blue-500/10 text-blue-700 border border-blue-500/20",
  wasted_journey: "bg-red-500/10 text-red-700 border border-red-500/20",
  waste_out_skip: "bg-slate-500/10 text-slate-700 border border-slate-500/20",
};

// Configured job types (route_one_job_types) win; static maps are the fallback
// for legacy keys such as `wasted_journey`.
const jtLabel = (k: string) => jobTypeLabel(k) || JOB_TYPE_LABELS[k as JobType] || k;
const jtSolid = (k: string) =>
  isConfiguredJobType(k) ? jobTypeSolidClass(k) : JOB_TYPE_COLORS[k as JobType] ?? jobTypeSolidClass(k);
const jtAccent = (k: string) => JOB_TYPE_ACCENT[k as JobType] ?? jobTypeAccentClass(k);
const jtTag = (k: string) =>
  JOB_TYPE_TAG[k as JobType] ?? "bg-muted text-foreground border border-border";

const STATUS_COLORS: Record<JobStatus, string> = {
  unassigned: "bg-muted text-muted-foreground",
  assigned: "bg-primary/10 text-primary",
  in_progress: "bg-blue-500/10 text-blue-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  query: "bg-red-500/10 text-red-600",
};

/** Normalise the cost inputs on a job form into DB columns. */
const costFields = (form: any) => {
  const toNum = (v: any) => {
    if (v === "" || v == null) return null;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const totals = computeJobTotals(form);
  return {
    haulage_cost: toNum(form.haulage_cost),
    charge_per_tonne: toNum(form.charge_per_tonne),
    min_weight_charge: toNum(form.min_weight_charge),
    weight_included_t: toNum(form.weight_included_t),
    cost_items: Array.isArray(form.cost_items) ? form.cost_items : [],
    contamination_charge: toNum(form.contamination_charge),
    contamination_query_id: form.contamination_query_id || null,
    vat_rate: toNum(form.vat_rate) ?? 20,
    total_net: totals.net,
    total_inc_vat: totals.gross,
  };
};

const RouteOnePage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [boardSearchOpen, setBoardSearchOpen] = useState(false);
  const [printDayOpen, setPrintDayOpen] = useState(false);
  const [finaliseDayOpen, setFinaliseDayOpen] = useState(false);
  // Loads configured job types into the shared registry used by jtLabel/jtSolid.
  useJobTypes();
  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => setFullScreen(Boolean(document.fullscreenElement));
    onFsChange();
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "list" | "map" | "bookings">("day");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [draggedSkiptrakId, setDraggedSkiptrakId] = useState<string | null>(null);
  const [dragOverDriverId, setDragOverDriverId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState("booking");
  const editBaseline = useRef("");
  const newBaseline = useRef("");
  const [ticketJob, setTicketJob] = useState<any | null>(null);
  const [viewingSkiptrakJob, setViewingSkiptrakJob] = useState<any | null>(null);
  const [reorganiseOpen, setReorganiseOpen] = useState(false);
  const [exchangeLoading, setExchangeLoading] = useState(false);

  // List view column selection, persisted per browser
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LIST_COLUMNS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((k: string) => LIST_COLUMNS.some((c) => c.key === k));
          if (valid.length > 0) return valid;
        }
      }
    } catch { /* ignore */ }
    return LIST_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
  });
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try { localStorage.setItem(LIST_COLUMNS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const activeColumns = LIST_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  // New job form
  const [jobForm, setJobForm] = useState({
    customer_name: "",
    site_name: "",
    site_address: "",
    site_address_2: "",
    site_area: "",
    site_postcode: "",
    sic_code: "",
    site_contact_name: "",
    site_contact_phone: "",
    account_code: "",
    invoice_address: "",
    directions: "",
    disposal_site: "",
    vehicle_reg: "",
    carrier_name: "",
    ewc_code: "",
    waste_classification: {},
    job_type: "delivery" as JobType,
    weighbridge_transaction_id: "",
    weighbridge_ticket_number: "",
    outbound_weight_t: "",
    destination_name: "",
    destination_address: "",
    container_type: "",
    container_size: "",
    waste_type: "",
    notes: "",
    po_number: "",
    scheduled_date: format(new Date(), "yyyy-MM-dd"),
    assigned_driver_id: "",
    haulage_cost: "",
    charge_per_tonne: "",
    min_weight_charge: "",
    weight_included_t: "",
    cost_items: [] as any[],
    contamination_charge: "",
    contamination_query_id: "",
    vat_rate: 20 as any,
  });

  const blankForm = useRef(structuredClone(jobForm));

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});

  // New driver form

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();

  // Open New Job pre-filled from a CRM email ("New job from this email" action).
  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefillDone.current) return;
    if (searchParams.get("newjob") !== "1") return;
    prefillDone.current = true;
    const g = (k: string) => searchParams.get(k) ?? "";
    const type = g("type");
    setJobForm((prev) => ({
      ...prev,
      customer_name: g("customer") || prev.customer_name,
      site_name: g("site") || prev.site_name,
      site_address: g("address") || prev.site_address,
      site_postcode: g("postcode") || prev.site_postcode,
      po_number: g("po") || prev.po_number,
      container_size: g("container") || prev.container_size,
      waste_type: g("waste") || prev.waste_type,
      scheduled_date: g("date") || prev.scheduled_date,
      job_type: (["delivery", "exchange", "collection"].includes(type) ? type : prev.job_type) as JobType,
      notes: g("notes") || prev.notes,
    }));
    setNewJobOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  // Only a full job number (5+ digits) uses the indexed exact match; partial
  // numeric fragments still run a normal contains search.
  const isExactTicketSearch = /^\d{5,}$/.test(search);

  // Fetch drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ["route-one-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_drivers")
        .select("*, route_one_vehicles(registration, vehicle_type)")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: boardVehicles = [] } = useQuery({
    queryKey: ["route-one-board-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("route_one_vehicles").select("registration, vehicle_type");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch jobs for selected date/week
  const { data: routeJobs = [] } = useQuery({
    queryKey: ["route-one-jobs", viewMode, dateStr, weekStart, search],
    queryFn: async () => {
      let query = supabase.from("route_one_jobs").select("*");
      if (isExactTicketSearch) {
        query = query.eq("job_number", search);
      } else if (search) {
        query = query.or(
          `job_number.ilike.%${search}%,customer_name.ilike.%${search}%,site_name.ilike.%${search}%,site_address.ilike.%${search}%,site_postcode.ilike.%${search}%,vehicle_reg.ilike.%${search}%`,
        );
      } else if (viewMode === "day") {
        query = query.eq("scheduled_date", dateStr);
      } else {
        query = query.gte("scheduled_date", weekStart).lte("scheduled_date", weekEnd);
      }
      const { data, error } = await query.order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Permit records keyed by the job they belong to (for the permit badge)
  const { data: permitsByJob = {} as Record<string, any> } = useQuery({
    queryKey: ["route_one_permits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permit_applications")
        .select("id, route_one_job_id, status, expiry_date")
        .not("route_one_job_id", "is", null);
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const p of data ?? []) map[(p as any).route_one_job_id] = p;
      return map;
    },
  });



  // Fetch Skiptrak scheduled jobs for the selected date range (from data_hub_jobs)
  const { data: allSkiptrakScheduledJobs = [] } = useQuery({
    queryKey: ["route-one-skiptrak-jobs", viewMode, dateStr, weekStart, search],
    queryFn: async () => {
      let query = supabase
        .from("data_hub_jobs")
        .select("id, job_number, job_date, customer, site, postcode, movement_type, container_type, waste_description, weight_t, vehicle_registration, driver, tipping_location, rebate_rate_per_tonne, ewc, category, haulier, account_code, order_number_override")
        .eq("source", "skiptrak");
      if (isExactTicketSearch) {
        query = query.eq("job_number", search);
      } else if (search) {
        query = query.or(
          `job_number.ilike.%${search}%,customer.ilike.%${search}%,site.ilike.%${search}%,postcode.ilike.%${search}%,vehicle_registration.ilike.%${search}%,driver.ilike.%${search}%`,
        );
      } else if (viewMode === "day") {
        query = query.eq("job_date", dateStr);
      } else {
        query = query.gte("job_date", weekStart).lte("job_date", weekEnd);
      }
      const { data, error } = await query.order("job_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const includesSearch = (...values: unknown[]) =>
    !search || values.some((value) => String(value ?? "").toLowerCase().includes(search));

  const jobs = routeJobs.filter((job: any) => {
    const driver = drivers.find((item: any) => item.id === job.assigned_driver_id);
    return includesSearch(
      job.job_number,
      job.customer_name,
      job.site_name,
      job.site_address,
      job.site_postcode,
      job.job_type,
      job.container_type,
      job.container_size,
      job.waste_type,
      job.po_number,
      driver?.driver_name,
      driver?.route_one_vehicles?.registration,
      driver?.route_one_vehicles?.vehicle_type,
    );
  });

  // Skiptrak tickets that already have a Route One record (created when a driver
  // captured photos/signatures) must not appear twice on the board.
  const routeJobNumbers = new Set(
    routeJobs
      .map((job: any) => String(job.job_number ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const skiptrakScheduledJobs = allSkiptrakScheduledJobs.filter((job: any) =>
    !routeJobNumbers.has(String(job.job_number ?? "").trim().toUpperCase()) &&
    includesSearch(
      job.job_number,
      job.customer,
      job.site,
      job.movement_type,
      job.container_type,
      job.waste_description,
      job.vehicle_registration,
      job.driver,
      job.tipping_location,
    ),
  );


  // Create job mutation
  const createJob = useMutation({
    mutationFn: async ({ form, send }: { form: typeof jobForm; send: boolean }) => {
      const { error } = await supabase.from("route_one_jobs").insert({
        customer_name: form.customer_name,
        site_name: form.site_name || null,
        site_address: form.site_address || null,
        site_address_2: form.site_address_2 || null,
        site_area: form.site_area || null,
        site_postcode: form.site_postcode || null,
        sic_code: form.sic_code || null,
        site_contact_name: form.site_contact_name || null,
        site_contact_phone: form.site_contact_phone || null,
        account_code: form.account_code || null,
        invoice_address: form.invoice_address || null,
        directions: form.directions || null,
        disposal_site: form.disposal_site || null,
        vehicle_reg: form.vehicle_reg || null,
        carrier_name: form.carrier_name || null,
        ewc_code: form.ewc_code || null,
        waste_classification: form.waste_classification,
        weighbridge_transaction_id: form.weighbridge_transaction_id || null,
        weighbridge_ticket_number: form.weighbridge_ticket_number || null,
        outbound_weight_t: form.outbound_weight_t === "" || form.outbound_weight_t == null ? null : Number(form.outbound_weight_t),
        destination_name: form.destination_name || null,
        destination_address: form.destination_address || null,
        job_type: form.job_type,
        container_type: form.container_type || null,
        container_size: form.container_size || null,
        waste_type: form.waste_type || null,
        notes: form.notes || null,
        po_number: form.po_number || null,
        scheduled_date: form.scheduled_date,
        assigned_driver_id: form.assigned_driver_id || null,
        status: form.assigned_driver_id ? "assigned" : "unassigned",
        is_live: form.job_type === "waste_out_skip" || (send && !!form.assigned_driver_id),
        ...costFields(form),
      });
      if (error) throw error;
    },
    onSuccess: (_d, { send, form }) => {
      queryClient.invalidateQueries({ queryKey: ["route-one-jobs"] });
      setNewJobOpen(false);
      resetJobForm();
      toast({ title: send && form.assigned_driver_id ? "Job created and sent to the driver" : "Job saved as draft", description: send && form.assigned_driver_id ? undefined : "Drivers won't see it until you send it." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Update job mutation
  const updateJob = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("route_one_jobs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-one-jobs"] });
    },
  });

  // Re-assign driver on a Skiptrak job (data_hub_jobs)
  const updateSkiptrakDriver = useMutation({
    mutationFn: async ({ id, driverName }: { id: string; driverName: string | null }) => {
      const { error } = await supabase.from("data_hub_jobs").update({ driver: driverName }).eq("id", id);
      if (error) throw error;
      return driverName;
    },
    onSuccess: (driverName) => {
      queryClient.invalidateQueries({ queryKey: ["route-one-skiptrak-jobs"] });
      toast({ title: driverName ? `Skiptrak job assigned to ${driverName}` : "Skiptrak job unassigned" });
    },
    onError: (e: any) => toast({ title: "Could not re-assign", description: e.message, variant: "destructive" }),
  });

  // Delete job
  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("route_one_jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-one-jobs"] });
      toast({ title: "Job deleted" });
    },
  });

  // Save edited job
  const saveEditedJob = () => {
    if (!editingJob) return;
    const updates: Record<string, any> = {
      customer_name: editForm.customer_name,
      site_name: editForm.site_name || null,
      site_address: editForm.site_address || null,
      site_address_2: editForm.site_address_2 || null,
      site_area: editForm.site_area || null,
      site_postcode: editForm.site_postcode || null,
      sic_code: editForm.sic_code || null,
      site_contact_name: editForm.site_contact_name || null,
      site_contact_phone: editForm.site_contact_phone || null,
      account_code: editForm.account_code || null,
      invoice_address: editForm.invoice_address || null,
      directions: editForm.directions || null,
      disposal_site: editForm.disposal_site || null,
      vehicle_reg: editForm.vehicle_reg || null,
      carrier_name: editForm.carrier_name || null,
      ewc_code: editForm.ewc_code || null,
      waste_classification: editForm.waste_classification || {},
      weighbridge_transaction_id: editForm.weighbridge_transaction_id || null,
      weighbridge_ticket_number: editForm.weighbridge_ticket_number || null,
      outbound_weight_t: editForm.outbound_weight_t === "" || editForm.outbound_weight_t == null ? null : Number(editForm.outbound_weight_t),
      destination_name: editForm.destination_name || null,
      destination_address: editForm.destination_address || null,
      job_type: editForm.job_type,
      container_type: editForm.container_type || null,
      container_size: editForm.container_size || null,
      waste_type: editForm.waste_type || null,
      notes: editForm.notes || null,
      po_number: editForm.po_number || null,
      scheduled_date: editForm.scheduled_date,
      assigned_driver_id: editForm.assigned_driver_id || null,
      status: editForm.assigned_driver_id ? (editingJob.status === "unassigned" ? "assigned" : editingJob.status) : "unassigned",
      ...costFields(editForm),
    };
    updateJob.mutate(
      { id: editingJob.id, updates },
      {
        onSuccess: () => {
          setEditingJob(null);
          toast({ title: "Job updated" });
        },
      }
    );
  };

  const openEditDialog = (job: any) => {
    const populated = {
      customer_name: job.customer_name || "",
      site_name: job.site_name || "",
      site_address: job.site_address || "",
      site_address_2: job.site_address_2 || "",
      site_area: job.site_area || "",
      site_postcode: job.site_postcode || "",
      sic_code: job.sic_code || "",
      site_contact_name: job.site_contact_name || "",
      site_contact_phone: job.site_contact_phone || "",
      account_code: job.account_code || "",
      invoice_address: job.invoice_address || "",
      directions: job.directions || "",
      disposal_site: job.disposal_site || "",
      vehicle_reg: job.vehicle_reg || "",
      carrier_name: job.carrier_name || "",
      ewc_code: job.ewc_code || "",
      waste_classification: job.waste_classification || {},
      job_type: job.job_type || "delivery",
      weighbridge_transaction_id: job.weighbridge_transaction_id || "",
      weighbridge_ticket_number: job.weighbridge_ticket_number || "",
      outbound_weight_t: job.outbound_weight_t ?? "",
      destination_name: job.destination_name || "",
      destination_address: job.destination_address || "",
      container_type: job.container_type || "",
      container_size: job.container_size || "",
      waste_type: job.waste_type || "",
      notes: job.notes || "",
      po_number: job.po_number || "",
      scheduled_date: job.scheduled_date || format(selectedDate, "yyyy-MM-dd"),
      assigned_driver_id: job.assigned_driver_id || "",
      haulage_cost: job.haulage_cost ?? "",
      charge_per_tonne: job.charge_per_tonne ?? "",
      min_weight_charge: job.min_weight_charge ?? "",
      weight_included_t: job.weight_included_t ?? "",
      cost_items: Array.isArray(job.cost_items) ? job.cost_items : [],
      contamination_charge: job.contamination_charge ?? "",
      contamination_query_id: job.contamination_query_id ?? "",
      vat_rate: job.vat_rate ?? 20,
    };
    setEditForm(populated);
    editBaseline.current = JSON.stringify(populated);
    setWorkspaceTab("booking");
    setEditingJob(job);
  };

  const resetJobForm = () => {
    const empty = {
      customer_name: "", site_name: "", site_address: "", site_address_2: "", site_area: "",
      site_postcode: "", sic_code: "", site_contact_name: "", site_contact_phone: "",
      account_code: "", invoice_address: "", directions: "", disposal_site: "",
      vehicle_reg: "", carrier_name: "", ewc_code: "", waste_classification: {},
      job_type: "delivery", container_type: "", container_size: "", waste_type: "",
      weighbridge_transaction_id: "", weighbridge_ticket_number: "", outbound_weight_t: "",
      destination_name: "", destination_address: "",
      notes: "", po_number: "", scheduled_date: format(selectedDate, "yyyy-MM-dd"),
      assigned_driver_id: "",
      haulage_cost: "", charge_per_tonne: "", min_weight_charge: "", weight_included_t: "",
      cost_items: [], contamination_charge: "", contamination_query_id: "", vat_rate: 20,
    };
    setJobForm(empty as typeof jobForm);
    newBaseline.current = JSON.stringify(empty);
  };

  const closeEditor = () => {
    if (JSON.stringify(editForm) !== editBaseline.current && !window.confirm("Discard unsaved changes to this job?")) return;
    setEditingJob(null);
  };
  const closeNewJob = () => {
    if (JSON.stringify(jobForm) !== newBaseline.current && !window.confirm("Discard this unsaved job?")) return;
    setNewJobOpen(false);
  };
  const startExchange = async (job: any) => {
    if (JSON.stringify(editForm) !== editBaseline.current && !window.confirm("Discard unsaved changes and create an exchange from the saved job?")) return;
    const fresh = newExchangeForm(blankForm.current, job, dateStr);
    setExchangeLoading(true);
    try { fresh.scheduled_date = await loadExchangeBookingDate(fresh) || fresh.scheduled_date; }
    catch { toast({ title: "Booking dates unavailable", description: "Check the exchange date before saving.", variant: "destructive" }); }
    finally { setExchangeLoading(false); }
    setJobForm(fresh);
    newBaseline.current = JSON.stringify(fresh);
    setEditingJob(null);
    setNewJobOpen(true);
  };
  const printSavedJob = () => {
    if (!editingJob) return;
    if (JSON.stringify(editForm) !== editBaseline.current) { toast({ title: "Save your changes before printing", description: "The printed ticket uses the saved job details." }); return; }
    printWtnPdf({ ...editingJob, driver_name: drivers.find(d => d.id === editingJob.assigned_driver_id)?.driver_name });
  };
  const startImportedExchange = async (job: any) => {
    setExchangeLoading(true);
    try {
      const { data, error } = await supabase.from("data_hub_jobs").select("*").eq("source", "skiptrak").eq("id", job.id).single();
      if (error) throw error;
      const raw = data.raw && typeof data.raw === "object" && !Array.isArray(data.raw) ? data.raw : {};
      const details = importedSiteDetails(raw, data.postcode || "");
      const mapped = { ...skiptrakWtnJob(data), ...importedBookingPrices(raw), site_address: details.address, site_area: details.area, site_contact_name: details.contact, site_contact_phone: details.phone, sic_code: details.sic };
      const fresh = newExchangeForm(blankForm.current, mapped, dateStr);
      fresh.scheduled_date = await loadExchangeBookingDate(fresh) || fresh.scheduled_date;
      fresh.notes = `Exchange from Skiptrak job ${data.job_number}`;
      if (fresh.charge_per_tonne === "") toast({ title: "Previous haulage copied", description: "This Skiptrak upload has no separate per-tonne rate. Check and enter that rate before sending." });
      setJobForm(fresh); newBaseline.current = JSON.stringify(fresh);
      setViewingSkiptrakJob(null); setNewJobOpen(true);
    } catch { toast({ title: "Could not load the original job", description: "Try again before creating an exchange.", variant: "destructive" }); }
    finally { setExchangeLoading(false); }
  };


  const navigateDate = (dir: number) => {
    setSelectedDate((d) => addDays(d, viewMode === "day" ? dir : dir * 7));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    setDraggedSkiptrakId(null);
    e.dataTransfer.effectAllowed = "move";
    // Add a slight delay to allow the drag image to render
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleSkiptrakDragStart = (e: React.DragEvent, skiptrakId: string) => {
    setDraggedSkiptrakId(skiptrakId);
    setDraggedJobId(null);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedJobId(null);
    setDraggedSkiptrakId(null);
    setDragOverDriverId(null);
  };

  const handleDrop = (driverId: string | null) => {
    if (draggedSkiptrakId) {
      const driverName = driverId ? drivers.find((d: any) => d.id === driverId)?.driver_name ?? null : null;
      updateSkiptrakDriver.mutate({ id: draggedSkiptrakId, driverName });
      setDraggedSkiptrakId(null);
      setDragOverDriverId(null);
      return;
    }
    if (!draggedJobId) return;
    updateJob.mutate({
      id: draggedJobId,
      updates: {
        assigned_driver_id: driverId,
        status: driverId ? "assigned" : "unassigned",
      },
    });
    setDraggedJobId(null);
    setDragOverDriverId(null);
  };

  const handleDragOver = (e: React.DragEvent, driverId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDriverId(driverId ?? "__unassigned__");
  };

  const handleDragLeave = () => {
    setDragOverDriverId(null);
  };

  // Get jobs for a specific driver (manual + Skiptrak)
  const getDriverJobs = (driverId: string) =>
    jobs.filter((j: any) => j.assigned_driver_id === driverId);

  // Resolve each imported job to one driver; substring matching duplicated short names.
  const getSkiptrakJobsForDriver = (driverName: string) => {
    const identities = drivers.map((d: any) => ({ id: d.id, name: d.driver_name }));
    const driverId = resolveDriverId(driverName, identities);
    if (!driverId) return [];
    return skiptrakScheduledJobs.filter((j: any) => resolveDriverId(j.driver, identities) === driverId);
  };

  const unassignedSkiptrakJobs = skiptrakScheduledJobs.filter((j: any) => !(j.driver || "").trim());


  const unassignedJobs = jobs.filter((j: any) => !j.assigned_driver_id);

  // Inputs for the day-routing planner (RouteOne tickets + uploaded Skiptrak jobs)
  const plannerJobs: PlannerJob[] = [
    ...jobs.map((j: any) => ({
      id: j.id,
      source: "route_one" as const,
      jobNumber: String(j.job_number ?? ""),
      movement: String(j.job_type ?? ""),
      containerType: String(j.container_type ?? ""),
      containerSize: j.container_size ?? null,
      customer: String(j.customer_name ?? ""),
      site: String(j.site_name ?? ""),
      postcode: String(j.site_postcode ?? ""),
      currentDriverId: j.assigned_driver_id ?? null,
      currentDriverName: drivers.find((d: any) => d.id === j.assigned_driver_id)?.driver_name ?? null,
    })),
    ...skiptrakScheduledJobs.map((j: any) => ({
      id: j.id,
      source: "skiptrak" as const,
      jobNumber: String(j.job_number ?? ""),
      movement: String(j.movement_type ?? ""),
      containerType: String(j.container_type ?? ""),
      containerSize: null,
      customer: String(j.customer ?? ""),
      site: String(j.site ?? ""),
      postcode: String(j.postcode ?? ""),
      currentDriverId: resolveDriverId(j.driver, drivers.map((d: any) => ({ id: d.id, name: d.driver_name }))),
      currentDriverName: j.driver ? String(j.driver) : null,
    })),
  ];

  const plannerDrivers: PlannerDriver[] = drivers.map((d: any) => ({
    id: d.id,
    name: d.driver_name,
    registration: d.route_one_vehicles?.registration ?? null,
    vehicleType: d.route_one_vehicles?.vehicle_type ?? null,
    category: d.category ?? null,
  }));

  // Stats
  const { rules: boardRules } = useRoutingRules();
  const boardDrivers = boardRules.hide_unused_drivers
    ? drivers.filter((d: any) => getDriverJobs(d.id).length + getSkiptrakJobsForDriver(d.driver_name).length > 0)
    : drivers;
  const hiddenDriverCount = drivers.length - boardDrivers.length;
  const driverDayVehicles = new Map(boardDrivers.map((driver: any) => [driver.id, dailyBoardVehicle([
    ...getDriverJobs(driver.id).map((j: any) => ({ registration: j.vehicle_reg, containerType: j.container_type })),
    ...getSkiptrakJobsForDriver(driver.driver_name).map((j: any) => ({ registration: j.vehicle_registration, containerType: j.container_type })),
  ], driver.route_one_vehicles, boardVehicles, boardRules.artic_regs)]));
  const driverVehicleType = (driver: any) => driverDayVehicles.get(driver.id)?.type ?? "Other";
  const driverVehicleGroups = groupDriversByVehicle(boardDrivers, driverVehicleType);
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j: any) => j.status === "completed").length;
  const queryJobs = jobs.filter((j: any) => j.status === "query").length;

  return (
    <div className={`flex flex-col h-[calc(100vh-3.5rem)] ${viewMode === "day" ? "routeone-day" : ""}`}>
      {/* Header Bar */}
      <div className="px-4 py-2 border-b border-border bg-card flex items-center gap-3 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Route className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">RouteOne</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 min-w-max flex-1">
          {/* View toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList className="routeone-view-tabs h-8 shrink-0">
              <TabsTrigger value="day" className="text-xs px-3 h-7">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7">Week</TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-3 h-7"><List className="h-3 w-3 mr-1" />List</TabsTrigger>
              <TabsTrigger value="map" className="text-xs px-3 h-7"><MapPin className="h-3 w-3 mr-1" />Live Map</TabsTrigger>
              {viewMode !== "day" && <TabsTrigger value="bookings" className="text-xs px-3 h-7"><CalendarClock className="h-3 w-3 mr-1" />Bookings</TabsTrigger>}
            </TabsList>
          </Tabs>

          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Previous day" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs font-medium min-w-[110px]" onClick={() => setSelectedDate(new Date())}>
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              {viewMode === "day"
                ? format(selectedDate, "EEEE d MMMM")
                : `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd MMM")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd MMM")}`
              }
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Next day" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {viewMode === "day" && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDate(new Date())}>Today</Button>}

          {/* Stats */}
          <div className={`${viewMode === "day" ? "hidden" : "hidden xl:flex"} items-center gap-2 text-xs text-muted-foreground shrink-0 px-1 order-3`}>
            <Badge variant="secondary" className="gap-1 font-normal">
              <strong className="text-foreground">{totalJobs}</strong> jobs
            </Badge>
            <Badge variant="outline" className="gap-1 font-normal">
              <strong className="text-emerald-600">{completedJobs}</strong> done
            </Badge>
            {queryJobs > 0 && (
              <Badge variant="outline" className="gap-1 font-normal border-destructive/40 text-destructive">
                <strong>{queryJobs}</strong> queries
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 ml-auto order-2">
          {viewMode === "day" && <>
            <Button variant="ghost" size="icon" aria-label="Search jobs" title="Search jobs" onClick={() => setBoardSearchOpen(v => !v)}><Search className="h-4 w-4" /></Button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More day actions" title="More day actions"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setPrintDayOpen(true)}><Printer className="h-4 w-4 mr-2" />Job sheets</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFinaliseDayOpen(true)}><CheckCircle2 className="h-4 w-4 mr-2" />Finalise day</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setViewMode("bookings")}><CalendarClock className="h-4 w-4 mr-2" />Bookings</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>}
          <Dialog open={newJobOpen} onOpenChange={(open) => { if (open) { resetJobForm(); setNewJobOpen(true); } else closeNewJob(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="routeone-new-job h-9 px-4 text-sm font-semibold gap-1.5 shadow-sm order-last">
                <Plus className="h-3.5 w-3.5" />
                New Job
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
              <DialogHeader className="px-5 py-4 border-b border-border pr-12 shrink-0">
                <DialogTitle>{jobForm.job_type === "exchange" ? "New exchange" : "New job"}</DialogTitle>
                <p className="text-sm text-muted-foreground break-words">{[jobForm.customer_name, jobForm.site_name].filter(Boolean).join(" · ") || "New booking"}</p>
              </DialogHeader>
              <JobPriceSummary form={jobForm} />
              <div className="overflow-y-auto flex-1 min-h-0 px-5 py-3"><JobFormFields form={jobForm} setForm={setJobForm} drivers={drivers} exchangeMode={jobForm.job_type === "exchange"} allowPrevious={jobForm.job_type !== "exchange"} /></div>
              <DialogFooter className="gap-2 sm:gap-2 p-4 border-t border-border shrink-0 bg-background">
                <Button variant="ghost" onClick={closeNewJob}><X className="h-4 w-4 mr-2" />Cancel</Button>
                <Button variant="outline" onClick={() => createJob.mutate({ form: jobForm, send: false })} disabled={!jobForm.customer_name || createJob.isPending} className="sm:flex-1">
                  Save as draft
                </Button>
                <Button onClick={() => createJob.mutate({ form: jobForm, send: true })} disabled={!jobForm.customer_name || !jobForm.assigned_driver_id || createJob.isPending} className="sm:flex-1" title={!jobForm.assigned_driver_id ? "Choose a driver to send the job" : undefined}>
                  {createJob.isPending ? "Saving..." : "Save & send to driver"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DaySheetPrintDialog date={dateStr} drivers={drivers} externalOpen={printDayOpen} onExternalOpenChange={setPrintDayOpen} hideTrigger={viewMode === "day"} />
          <FinaliseDayDialog date={format(addDays(selectedDate, 1), "yyyy-MM-dd")} drivers={drivers} vehicles={boardVehicles} externalOpen={finaliseDayOpen} onExternalOpenChange={setFinaliseDayOpen} hideTrigger={viewMode === "day"} />
          {/* Reorganise the day */}
          {viewMode === "day" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setReorganiseOpen(true)}
              disabled={plannerJobs.length === 0}
            >
              <Route className="h-3.5 w-3.5" />
              Reorganise Day
            </Button>
          )}

          {/* Settings Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Setup
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[850px] sm:max-w-[850px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>RouteOne Setup</SheetTitle>
              </SheetHeader>
              <Tabs defaultValue="drivers" className="mt-4">
                <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1 p-1">
                  <TabsTrigger value="drivers" className="text-xs whitespace-nowrap">Drivers</TabsTrigger>
                  <TabsTrigger value="vehicles" className="text-xs whitespace-nowrap">Vehicles</TabsTrigger>
                  <TabsTrigger value="yard-staff" className="text-xs whitespace-nowrap">Yard Staff</TabsTrigger>
                  <TabsTrigger value="driver-app" className="text-xs whitespace-nowrap">Driver App</TabsTrigger>
                  <TabsTrigger value="cost-items" className="text-xs whitespace-nowrap">Cost Items</TabsTrigger>
                  <TabsTrigger value="job-types" className="text-xs whitespace-nowrap">Job Types</TabsTrigger>
                  <TabsTrigger value="container-types" className="text-xs whitespace-nowrap">Containers</TabsTrigger>
                  <TabsTrigger value="wtn-design" className="text-xs whitespace-nowrap">Ticket Builder</TabsTrigger>
                  <TabsTrigger value="routing" className="text-xs whitespace-nowrap">Routing Rules</TabsTrigger>
                </TabsList>

                <div className="mt-4">
                  <TabsContent value="drivers">
                    <DriverSettings />
                  </TabsContent>
                  <TabsContent value="vehicles">
                    <VehicleSettings />
                  </TabsContent>
                  <TabsContent value="yard-staff">
                    <YardStaffSettings />
                  </TabsContent>
                  <TabsContent value="driver-app">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Driver App</p>
                          <p className="text-xs text-muted-foreground">Open the app drivers use for assigned jobs.</p>
                        </div>
                        <Link to="/driver" target="_blank">
                          <Button size="sm">Open Driver App</Button>
                        </Link>
                      </div>
                      <DriverAppManagement />
                    </div>
                  </TabsContent>
                  <TabsContent value="cost-items">
                    <CostItemsSettings />
                  </TabsContent>
                  <TabsContent value="job-types">
                    <JobTypesSettings />
                  </TabsContent>
                  <TabsContent value="container-types">
                    <ContainerTypesSettings />
                  </TabsContent>
                  <TabsContent value="wtn-design">
                    <WtnDesignSettings />
                  </TabsContent>
                  <TabsContent value="routing">
                    <RoutingRulesSettings />
                  </TabsContent>
                </div>

              </Tabs>
            </SheetContent>
          </Sheet>

          </div>
        </div>
      </div>

      {/* One native-job workspace from both list and schedule. */}
      <Dialog open={!!editingJob} onOpenChange={open => { if (!open) closeEditor(); }}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border pr-12 shrink-0">
            <DialogTitle className="flex flex-wrap items-center gap-2">Job #{editingJob?.job_number}<Badge variant="secondary">{editingJob?.status?.replace(/_/g, " ")}</Badge><Badge variant="outline">{editingJob?.is_live ? "Sent" : "Draft"}</Badge></DialogTitle>
            <p className="text-sm font-medium break-words">{[editForm.customer_name, editForm.site_name].filter(Boolean).join(" · ")}</p>
          </DialogHeader>
          <JobPriceSummary form={editForm} />
          <Tabs value={workspaceTab} onValueChange={setWorkspaceTab} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="mx-5 mt-3 self-start shrink-0"><TabsTrigger value="booking">Job booking</TabsTrigger><TabsTrigger value="paperwork">Photos & paperwork</TabsTrigger></TabsList>
            <div className="overflow-y-auto flex-1 min-h-0 px-5 py-3">
              <TabsContent value="booking" className="mt-0"><JobFormFields form={editForm} setForm={setEditForm} drivers={drivers} allowPrevious={false} /></TabsContent>
              <TabsContent value="paperwork" className="space-y-4 mt-0">
                {editingJob && <>
                {(editingJob.customer_signature || editingJob.driver_signature) && <div className="grid grid-cols-2 gap-3">{[["Customer", editingJob.customer_signature], ["Driver", editingJob.driver_signature]].map(([label, signature]) => signature && <div key={label}><p className="text-xs text-muted-foreground">{label}</p><img src={signature} alt={`${label} signature`} className="h-16 w-full border border-border rounded bg-background object-contain" /></div>)}</div>}
                <WtnJobSignatures jobNumber={editingJob.job_number} /><JobPhotosSection jobId={editingJob.id} /><JobPodSection jobNumber={editingJob.job_number} />
                <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => downloadWtnPdf(editingJob)}><FileDown className="h-4 w-4 mr-2" />Download WTN</Button><Button variant="outline" size="sm" onClick={() => setTicketJob(editingJob)}><Send className="h-4 w-4 mr-2" />Send ticket</Button>{editingJob.status === "completed" && <Button variant="outline" size="sm" onClick={() => invoiceFromSource({ jobId: editingJob.id })}><PoundSterling className="h-4 w-4 mr-2" />Create invoice</Button>}</div></>}
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="flex-row flex-wrap sm:justify-between items-center gap-2 p-4 border-t border-border shrink-0 bg-background">
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={printSavedJob}><Printer className="h-4 w-4 mr-2" />Print ticket</Button><Button variant="outline" onClick={() => editingJob && startExchange(editingJob)} disabled={updateJob.isPending || exchangeLoading}><Repeat2 className="h-4 w-4 mr-2" />{exchangeLoading ? "Loading…" : "New exchange"}</Button></div>
            <div className="flex gap-2"><Button variant="ghost" onClick={closeEditor} disabled={updateJob.isPending}><X className="h-4 w-4 mr-2" />Cancel</Button><Button onClick={saveEditedJob} disabled={!editForm.customer_name || updateJob.isPending}><Save className="h-4 w-4 mr-2" />{updateJob.isPending ? "Saving…" : "Save"}</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TicketSendDialog job={ticketJob} open={!!ticketJob} onOpenChange={(o) => { if (!o) setTicketJob(null); }} />

      {viewMode === "day" && <>
        {boardSearchOpen && <div className="px-4 py-2 border-b bg-card"><Input autoFocus aria-label="Search day jobs" placeholder="Search jobs, customers, sites or postcodes" value={searchParams.get("search") ?? ""} onChange={e => { const next = new URLSearchParams(searchParams); if (e.target.value) next.set("search", e.target.value); else next.delete("search"); setSearchParams(next, { replace: true }); }} /></div>}
        <div className="routeone-summary flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b text-xs shrink-0">
          <span>{jobs.length + skiptrakScheduledJobs.length} jobs · {boardDrivers.filter((d: any) => getDriverJobs(d.id).length + getSkiptrakJobsForDriver(d.driver_name).length > 0).length} drivers · <span className="routeone-empty-tick">●</span> {unassignedJobs.length + unassignedSkiptrakJobs.length} unassigned · {([...jobs, ...skiptrakScheduledJobs].filter(boardUnconfirmed)).length} unconfirmed</span>
          <div className="flex flex-wrap gap-3 items-center">{["collect", "exchange", "delivery", "waste"].map(type => <span key={type} data-job-palette={type} className="flex items-center gap-1.5"><i className="routeone-key-dot" />{type[0].toUpperCase() + type.slice(1)}</span>)}<span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm border border-dashed border-current" />Unconfirmed</span></div>
        </div>
      </>}

      <RoutingProposalDialog
        open={reorganiseOpen}
        onOpenChange={setReorganiseOpen}
        jobs={plannerJobs}
        drivers={plannerDrivers}
        dateLabel={format(selectedDate, "EEE dd MMM yyyy")}
        onApplied={() => {
          queryClient.invalidateQueries({ queryKey: ["route-one-jobs"] });
          queryClient.invalidateQueries({ queryKey: ["route-one-skiptrak-jobs"] });
        }}
      />

      {/* View Skiptrak Job Dialog */}
      <Dialog open={!!viewingSkiptrakJob} onOpenChange={(open) => { if (!open) setViewingSkiptrakJob(null); }}>
        <DialogContent className="max-w-5xl w-[92vw] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border pr-12 shrink-0">
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Truck className="h-4 w-4" />
              Skiptrak Job Details
              {viewingSkiptrakJob?.job_number && <Badge variant="secondary">#{viewingSkiptrakJob.job_number}</Badge>}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4">
          {viewingSkiptrakJob && (() => {
            const mt = getSkiptrakJobType(viewingSkiptrakJob.movement_type);
            const colorClass = mt ? jtSolid(mt) : "bg-muted text-foreground";
            return (
              <div className="space-y-4">
                <div className={`rounded-lg p-3 ${colorClass}`}>
                  <p className="text-sm font-bold">{viewingSkiptrakJob.customer || "Unknown"}</p>
                  {viewingSkiptrakJob.site && <p className="text-xs mt-0.5 opacity-90">{viewingSkiptrakJob.site}</p>}
                  <Badge className="mt-2 text-[10px] bg-white/20 border-0">{viewingSkiptrakJob.movement_type || "Unknown"}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  <DetailRow label="Job Number" value={viewingSkiptrakJob.job_number} />
                  <DetailRow label="Date" value={viewingSkiptrakJob.job_date || "—"} />
                  <DetailRow label="Customer" value={viewingSkiptrakJob.customer || "—"} />
                  <DetailRow label="Site" value={viewingSkiptrakJob.site || "—"} />
                  <DetailRow label="Vehicle" value={viewingSkiptrakJob.vehicle_registration || "—"} />
                  <DetailRow label="Container" value={viewingSkiptrakJob.container_type || "—"} />
                  <DetailRow label="Waste" value={viewingSkiptrakJob.waste_description || "—"} />
                  <DetailRow label="Weight" value={viewingSkiptrakJob.weight_t != null ? `${viewingSkiptrakJob.weight_t}t` : "—"} />
                  <DetailRow label="Tipping Location" value={viewingSkiptrakJob.tipping_location || "—"} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Re-assign Driver</p>
                    <Select
                      value={(viewingSkiptrakJob.driver || "").trim() || "__none__"}
                      onValueChange={(v) => {
                        const driverName = v === "__none__" ? null : v;
                        setViewingSkiptrakJob({ ...viewingSkiptrakJob, driver: driverName });
                        updateSkiptrakDriver.mutate({ id: viewingSkiptrakJob.id, driverName });
                      }}
                      disabled={updateSkiptrakDriver.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {drivers.map((d: any) => (
                          <SelectItem key={d.id} value={d.driver_name}>{d.driver_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <BespokeRateEditor
                    jobId={viewingSkiptrakJob.id}
                    jobNumber={viewingSkiptrakJob.job_number}
                    value={viewingSkiptrakJob.rebate_rate_per_tonne}
                    onSaved={(next) => {
                      setViewingSkiptrakJob({ ...viewingSkiptrakJob, rebate_rate_per_tonne: next });
                      queryClient.invalidateQueries({ queryKey: ["route-one-skiptrak-jobs"] });
                    }}
                  />
                </div>
                <WtnJobSignatures jobNumber={viewingSkiptrakJob.job_number} />
                <SkiptrakSiteDetails job={viewingSkiptrakJob} />
                <JobPodSection jobNumber={viewingSkiptrakJob.job_number} />
              </div>
            );
          })()}
          </div>
          {viewingSkiptrakJob && (
            <DialogFooter className="flex-row flex-wrap sm:justify-between items-center gap-2 p-4 border-t border-border shrink-0 bg-background">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => printWtnPdf(skiptrakWtnJob(viewingSkiptrakJob))}><Printer className="h-4 w-4 mr-2" />Print ticket</Button>
                <Button variant="outline" size="sm" onClick={() => downloadWtnPdf(skiptrakWtnJob(viewingSkiptrakJob))}><FileDown className="h-4 w-4 mr-2" />Download ticket</Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={exchangeLoading} onClick={() => startImportedExchange(viewingSkiptrakJob)}><Repeat2 className="h-4 w-4 mr-2" />{exchangeLoading ? "Loading…" : "New exchange"}</Button>
                <Button variant="ghost" size="sm" onClick={() => setViewingSkiptrakJob(null)}>Close</Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Live Map View */}
      {viewMode === "bookings" ? (
        <div className="flex-1 overflow-auto">
          <BookingWindowsPanel />
        </div>
      ) : viewMode === "map" ? (

        <div className="flex-1 overflow-auto p-4">
          <DriverTrackingMap />
        </div>
      ) : viewMode === "list" ? (
        <div className="flex-1 overflow-auto p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {jobs.length + skiptrakScheduledJobs.length} jobs · {activeColumns.length} columns shown
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Columns3 className="h-3.5 w-3.5" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LIST_COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleColumns.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                    onSelect={(e) => e.preventDefault()}
                    className="text-xs"
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {activeColumns.map((col) => (
                    <TableHead key={col.key} className={col.key === "status" ? "w-[40px]" : col.key === "job_number" ? "w-[90px]" : ""}>
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Native jobs */}
                {jobs.map((job: any) => {
                  const jt = job.job_type as JobType;
                  const status = job.status as JobStatus;
                  const driver = drivers.find((d: any) => d.id === job.assigned_driver_id);
                  return (
                    <TableRow
                      key={job.id}
                      className={`cursor-pointer hover:bg-muted/50 ${
                        status === "completed" && jt ? `border-l-4 ${jtAccent(jt)?.replace("bg-", "border-") ?? "border-muted"}` : ""
                      }`}
                      onClick={() => openEditDialog(job)}
                    >
                      {activeColumns.map((col) => (
                        <TableCell key={col.key} className="text-sm">
                          {col.key === "status" ? (
                            <div className={`w-3 h-3 rounded-full ${
                              status === "completed" ? "bg-emerald-500" :
                              status === "in_progress" ? "bg-blue-500" :
                              status === "query" ? "bg-red-500" :
                              status === "assigned" ? "bg-primary" :
                              "bg-muted-foreground/30"
                            }`} />
                          ) : col.key === "type" ? (
                            <Badge className={`text-[10px] ${jtSolid(jt)}`}>{jtLabel(jt)}</Badge>
                          ) : col.key === "site" ? (
                            <span className="text-muted-foreground">
                              <span className="mr-1.5">{job.site_name || "—"}</span>
                              <PermitBadge permit={permitsByJob[job.id]} />
                            </span>
                          ) : col.key === "source" ? (
                            <Badge variant="outline" className="text-[10px]">Native</Badge>
                          ) : col.key === "customer" ? (
                            <span className="font-medium">{col.getNative(job, driver)}</span>
                          ) : (
                            col.getNative(job, driver)
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(job); }}><Pencil className="h-3 w-3 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadWtnPdf(job); }}><FileDown className="h-3 w-3 mr-2" /> Download WTN</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); printWtnPdf(job); }}><Printer className="h-3 w-3 mr-2" /> Print WTN</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTicketJob(job); }}><Send className="h-3 w-3 mr-2" /> Print / Send ticket</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateJob.mutate({ id: job.id, updates: { is_live: !job.is_live } }); }}><Radio className="h-3 w-3 mr-2" /> {job.is_live ? "Take off live" : "Make live"}</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateJob.mutate({ id: job.id, updates: { status: "completed" } }); }}>Mark Complete</DropdownMenuItem>
                            {job.status === "completed" && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); invoiceFromSource({ jobId: job.id }); }}><PoundSterling className="h-3 w-3 mr-2" /> Create invoice</DropdownMenuItem>}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateJob.mutate({ id: job.id, updates: { status: "query" } }); }}>Flag as Query</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteJob.mutate(job.id); }} className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Skiptrak jobs */}
                {skiptrakScheduledJobs.map((sj: any) => {
                  const mt = getSkiptrakJobType(sj.movement_type);
                  return (
                    <TableRow
                      key={`st-${sj.job_number}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setViewingSkiptrakJob(sj)}
                    >
                      {activeColumns.map((col) => (
                        <TableCell key={col.key} className="text-sm">
                          {col.key === "status" ? (
                            <div className="w-3 h-3 rounded-full bg-muted-foreground/20 border border-dashed border-muted-foreground/40" />
                          ) : col.key === "type" ? (
                            mt ? (
                              <Badge className={`text-[10px] ${jtSolid(mt)}`}>{sj.movement_type}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">{sj.movement_type || "—"}</span>
                            )
                          ) : col.key === "waste" ? (
                            <span>
                              {sj.waste_description || "—"}
                              {sj.rebate_rate_per_tonne != null && (
                                <Badge variant="outline" className="ml-1.5 text-[10px]">£{Number(sj.rebate_rate_per_tonne).toFixed(2)}/t</Badge>
                              )}
                            </span>
                          ) : col.key === "source" ? (
                            <Badge variant="secondary" className="text-[10px]">Skiptrak</Badge>
                          ) : col.key === "customer" ? (
                            <span className="font-medium">{col.getSkiptrak(sj)}</span>
                          ) : (
                            col.getSkiptrak(sj)
                          )}
                        </TableCell>
                      ))}
                      <TableCell />
                    </TableRow>
                  );
                })}
                {jobs.length === 0 && skiptrakScheduledJobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={activeColumns.length + 1} className="text-center text-muted-foreground py-12">
                      No jobs found for this period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
      /* Dispatch Board (Kanban) */
      <div className="flex-1 min-h-0 overflow-auto p-3 routeone-driver-viewport">
        <div className="flex min-w-max items-start gap-5">
          {/* Unassigned Column */}
          <div
            className={`routeone-unassigned ${dragOverDriverId === "__unassigned__" ? "ring-2 ring-primary" : ""}`}
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(null)}
          >
            <div className={`px-3 ${fullScreen ? "py-1.5" : "py-2.5"} border-b border-hairline bg-muted/40`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Unassigned</span>
                <span className="text-[11px] font-medium text-muted-foreground bg-background rounded-full px-2 py-0.5">{unassignedJobs.length}</span>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              {unassignedJobs.map((job: any) => (
                <JobCard
                  key={job.id}
                  job={job}
                  permit={permitsByJob[job.id]}
                  onEdit={() => openEditDialog(job)}
                  onView={() => openEditDialog(job)}
                  onDelete={() => deleteJob.mutate(job.id)}
                  onStatusChange={(status) => updateJob.mutate({ id: job.id, updates: { status } })}
                  onSendTicket={() => setTicketJob(job)}
                  onToggleLive={() => updateJob.mutate({ id: job.id, updates: { is_live: !job.is_live } })}
                  onDragStart={(e) => handleDragStart(e, job.id)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedJobId === job.id}
                  compact={fullScreen}
                  tinted
                />
              ))}
              {unassignedSkiptrakJobs.map((sj: any) => (
                <SkiptrakJobCard
                  key={sj.id}
                  job={sj}
                  onClick={() => setViewingSkiptrakJob(sj)}
                  onDragStart={(e) => handleSkiptrakDragStart(e, sj.id)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedSkiptrakId === sj.id}
                  compact={fullScreen}
                  tinted
                />
              ))}
              {unassignedJobs.length === 0 && unassignedSkiptrakJobs.length === 0 && (
                <div className="text-center py-8 space-y-2"><CheckCircle2 className="routeone-empty-tick h-8 w-8 mx-auto" /><p className="text-xs font-semibold">All jobs assigned</p><p className="text-[11px] text-muted-foreground">Drag a job here to unassign it</p></div>
              )}
            </div>
          </div>

          {/* Driver Columns */}
          <div className="min-w-0">
          <DriverVehicleBoard groups={driverVehicleGroups} jobCount={(driver: any) => getDriverJobs(driver.id).length + getSkiptrakJobsForDriver(driver.driver_name).length} renderDriver={(driver: any) => {
            const driverJobs = getDriverJobs(driver.id);
            const skiptrakJobs = getSkiptrakJobsForDriver(driver.driver_name);
            const totalCount = driverJobs.length + skiptrakJobs.length;
            const isDropTarget = dragOverDriverId === driver.id;
            const capacity = boardCapacity(totalCount);
            return (
              <div
                key={driver.id}
                className={`routeone-driver-column shrink-0 flex flex-col transition-colors ${
                  isDropTarget ? "ring-2 ring-primary" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, driver.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(driver.id)}
              >
                <div className="routeone-driver-header">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="routeone-driver-avatar" aria-hidden="true">{driver.driver_name.split(/\s+/).filter(Boolean).map((n: string) => n[0]).slice(0, 2).join("")}</div>
                    <div className="min-w-0"><p className="text-[13px] font-semibold leading-tight break-words">{driver.driver_name}</p><p className="text-[11px] font-mono text-muted-foreground mt-1">{boardRegistration(driverDayVehicles.get(driver.id)?.registration)}</p></div>
                  </div>
                  <div className="routeone-capacity" aria-label={`${totalCount} of 10 job capacity`}><div className="routeone-capacity-fill" data-tone={capacity.tone} style={{ "--capacity": `${capacity.percent}%` } as React.CSSProperties} /></div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{totalCount} jobs · {totalCount} / 10 jobs</p>
                </div>
                <div className="space-y-2">
                  {driverJobs.map((job: any) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      permit={permitsByJob[job.id]}
                      onEdit={() => openEditDialog(job)}
                      onView={() => openEditDialog(job)}
                      onDelete={() => deleteJob.mutate(job.id)}
                      onStatusChange={(status) => updateJob.mutate({ id: job.id, updates: { status } })}
                      onSendTicket={() => setTicketJob(job)}
                      onToggleLive={() => updateJob.mutate({ id: job.id, updates: { is_live: !job.is_live } })}
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedJobId === job.id}
                      compact={fullScreen}
                  tinted
                    />
                  ))}
                  {skiptrakJobs.map((sj: any) => (
                    <SkiptrakJobCard
                      key={sj.id}
                      job={sj}
                      onClick={() => setViewingSkiptrakJob(sj)}
                      onDragStart={(e) => handleSkiptrakDragStart(e, sj.id)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedSkiptrakId === sj.id}
                      compact={fullScreen}
                  tinted
                    />
                  ))}
                  {capacity.showRoom && <div className="routeone-room">+ Room for {capacity.room} more</div>}
                </div>
              </div>
            );
          }} />
          </div>

          {/* Empty state if no drivers */}
          {drivers.length > 0 && hiddenDriverCount > 0 && !fullScreen && (
              <div className="hidden">
              {hiddenDriverCount} driver{hiddenDriverCount === 1 ? "" : "s"} with no jobs hidden (Setup → Routing Rules)
            </div>
          )}
          {drivers.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No drivers yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add drivers to start building your dispatch board</p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

// Autocomplete input now lives in src/components/route-one/JobFormFields.tsx


// Shared form fields for Create and Edit dialogs
// JobFormFields now lives in src/components/route-one/JobFormFields.tsx


// Job Card Component
function JobCard({
  job,
  permit,
  onEdit,
  onView,
  onDelete,
  onStatusChange,
  onSendTicket,
  onToggleLive,
  onDragStart,
  onDragEnd,
  isDragging,
  compact,
  tinted,
}: {
  job: any;
  permit?: any;
  onEdit: () => void;
  onView: () => void;
  onSendTicket?: () => void;
  onToggleLive?: () => void;
  onDelete: () => void;
  onStatusChange: (status: JobStatus) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragging: boolean;
  compact?: boolean;
  tinted?: boolean;
}) {
  const jobType = job.job_type as JobType;
  const status = job.status as JobStatus;

  const addr = [job.site_address, job.site_address_2].filter(Boolean).join(", ");
  const statusLabel = status === "completed" ? "Done" : status === "in_progress" ? "In progress" : status === "query" ? "Query" : null;

  if (tinted) return <TintedJobCard job={job} type={jobType} label={jtLabel(jobType)} onClick={onView} onDragStart={onDragStart} onDragEnd={onDragEnd} isDragging={isDragging} permit={<PermitBadge permit={permit} />} actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"
                aria-label="Job actions"
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent/10"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-3 w-3 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadWtnPdf(job); }}>
                <FileDown className="h-3 w-3 mr-2" /> Download WTN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); printWtnPdf(job); }}>
                <Printer className="h-3 w-3 mr-2" /> Print WTN
              </DropdownMenuItem>
              {onSendTicket && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendTicket(); }}>
                  <Send className="h-3 w-3 mr-2" /> Print / Send ticket
                </DropdownMenuItem>
              )}
              {onToggleLive && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleLive(); }}>
                  <Radio className="h-3 w-3 mr-2" /> {job.is_live ? "Take off live (hide from driver)" : "Make live (send to driver)"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("in_progress"); }}>Mark In Progress</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("completed"); }}>Mark Complete</DropdownMenuItem>
              {job.status === "completed" && job.job_type !== "waste_out_skip" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); invoiceFromSource({ jobId: job.id }); }}>
                  <PoundSterling className="h-3 w-3 mr-2" /> Create invoice
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("query"); }}>Flag as Query</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">Delete Job</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
  } />;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onView}
      className={`group relative rounded-lg border ${compact ? "px-2 py-1.5" : "px-3 py-2.5"} cursor-pointer select-none shadow-sm transition-all hover:shadow-hover hover:-translate-y-px overflow-hidden ${jtSolid(jobType)} ${
        status === "completed" ? "saturate-[.55]" : ""
      } ${isDragging ? "opacity-50 scale-95" : ""}`}
    >
      {/* Row 1: type + status */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <GripVertical className="h-3.5 w-3.5 opacity-80" />
          {jtLabel(jobType)}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {statusLabel && (
            <span className="flex items-center gap-1 rounded bg-black/25 px-1.5 py-0.5 text-[11px] font-semibold">
              {status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
              {status === "query" && <AlertTriangle className="h-3 w-3" />}
              {statusLabel}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Job actions"
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-black/20"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-3 w-3 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadWtnPdf(job); }}>
                <FileDown className="h-3 w-3 mr-2" /> Download WTN
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); printWtnPdf(job); }}>
                <Printer className="h-3 w-3 mr-2" /> Print WTN
              </DropdownMenuItem>
              {onSendTicket && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendTicket(); }}>
                  <Send className="h-3 w-3 mr-2" /> Print / Send ticket
                </DropdownMenuItem>
              )}
              {onToggleLive && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleLive(); }}>
                  <Radio className="h-3 w-3 mr-2" /> {job.is_live ? "Take off live (hide from driver)" : "Make live (send to driver)"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("in_progress"); }}>Mark In Progress</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("completed"); }}>Mark Complete</DropdownMenuItem>
              {job.status === "completed" && job.job_type !== "waste_out_skip" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); invoiceFromSource({ jobId: job.id }); }}>
                  <PoundSterling className="h-3 w-3 mr-2" /> Create invoice
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("query"); }}>Flag as Query</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">Delete Job</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: job number + customer */}
      {job.job_number && <div className={`${compact ? "mt-1 text-xs" : "mt-1.5 text-sm"} font-bold tabular-nums`}>Job #{job.job_number}</div>}
      <div className={`${compact ? "text-sm" : "text-[15px]"} font-bold leading-snug break-words`}>{job.customer_name}</div>

      {/* Row 3: site + postcode */}
      {(job.site_name || job.site_postcode) && (
        <div className={`mt-1 flex items-start gap-1.5 ${compact ? "text-xs" : "text-[13px]"} leading-snug`}>
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            {job.site_name && <div className="font-semibold break-words">{job.site_name}</div>}
            {addr && !compact && <div className="opacity-95 break-words">{addr}</div>}
            {job.site_postcode && <div className="font-bold tracking-wide">{job.site_postcode}</div>}
          </div>
        </div>
      )}

      {/* Row 4: details */}
      <div className={`flex items-center gap-1.5 ${compact ? "mt-1.5" : "mt-2"} flex-wrap text-xs font-semibold`}>
        <span className={`rounded px-1.5 py-0.5 ${job.is_live ? "bg-white text-foreground" : "bg-black/25"}`}>
          {job.is_live ? "SENT" : "DRAFT"}
        </span>
        <PermitBadge permit={permit} />
        {(job.container_size || job.container_type) && (
          <span className="rounded bg-black/20 px-1.5 py-0.5">
            {[job.container_size, job.container_type].filter(Boolean).join(" ")}
          </span>
        )}
        {job.estimated_duration_mins && !compact && (
          <span className="flex items-center gap-1 rounded bg-black/20 px-1.5 py-0.5">
            <Clock className="h-3 w-3" /> {job.estimated_duration_mins} min
          </span>
        )}
      </div>
    </div>
  );
}

// Map Skiptrak movement_type to our job type color scheme
function getSkiptrakJobType(movementType: string | null): JobType | null {
  if (!movementType) return null;
  const mt = movementType.toLowerCase().trim();
  if (mt.includes("deliver")) return "delivery";
  if (mt.includes("exchange") || mt.includes("swap")) return "exchange";
  if (mt.includes("collect") || mt.includes("removal") || mt.includes("uplift")) return "collection";
  if (mt.includes("waste") || mt.includes("tip")) return "waste_truck";
  if (mt.includes("wasted") || mt.includes("abortive") || mt.includes("failed")) return "wasted_journey";
  return null;
}

// Skiptrak Job Card (read-only, from data_hub_jobs)
function SkiptrakJobCard({ job, onClick, onDragStart, onDragEnd, isDragging, compact, tinted }: { job: any; onClick?: () => void; onDragStart?: (e: React.DragEvent) => void; onDragEnd?: (e: React.DragEvent) => void; isDragging?: boolean; compact?: boolean; tinted?: boolean }) {
  const mappedType = getSkiptrakJobType(job.movement_type);
  const solid = mappedType ? jtSolid(mappedType) : "bg-slate-600 border-slate-700 text-white";

  if (tinted) return <TintedJobCard imported job={job} type={mappedType || "other"} label={job.movement_type || "Job"} onClick={onClick} onDragStart={onDragStart} onDragEnd={onDragEnd} isDragging={isDragging} />;

  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-lg border-2 border-dashed !border-current/60 ${compact ? "px-2 py-1.5" : "px-3 py-2.5"} cursor-grab active:cursor-grabbing shadow-sm transition-all hover:shadow-hover hover:-translate-y-px overflow-hidden ${solid} ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide truncate">{job.movement_type || "Skiptrak"}</span>
        <span className="rounded bg-black/25 px-1.5 py-0.5 text-[11px] font-semibold shrink-0">Skiptrak</span>
      </div>
      {job.job_number && <div className={`${compact ? "mt-1 text-xs" : "mt-1.5 text-sm"} font-bold tabular-nums`}>Job #{job.job_number}</div>}
      <div className={`${compact ? "text-sm" : "text-[15px]"} font-bold leading-snug break-words`}>{job.customer || "Unknown"}</div>
      {(job.site || job.postcode) && (
        <div className={`mt-1 flex items-start gap-1.5 ${compact ? "text-xs" : "text-[13px]"} leading-snug`}>
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            {job.site && <div className="font-semibold break-words">{job.site}</div>}
            {job.postcode && <div className="font-bold tracking-wide">{job.postcode}</div>}
          </div>
        </div>
      )}
      {(job.tipping_location || job.container_type || (job.weight_t != null && job.weight_t > 0)) && (
        <div className={`flex items-center gap-1.5 ${compact ? "mt-1.5" : "mt-2"} flex-wrap text-xs font-semibold`}>
          {job.container_type && <span className="rounded bg-black/20 px-1.5 py-0.5">{job.container_type}</span>}
          {job.weight_t != null && job.weight_t > 0 && <span className="rounded bg-black/20 px-1.5 py-0.5">{job.weight_t}t</span>}
          {job.tipping_location && <span className="rounded bg-black/20 px-1.5 py-0.5">→ {job.tipping_location}</span>}
        </div>
      )}
    </div>
  );
}

// Simple detail row for view dialogs
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

export default RouteOnePage;
