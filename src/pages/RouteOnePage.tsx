import { useState, useRef } from "react";
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
  Smartphone,

} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DriverSettings } from "@/components/route-one/DriverSettings";
import { VehicleSettings } from "@/components/route-one/VehicleSettings";
import { DriverAppManagement } from "@/components/route-one/DriverAppManagement";
import { YardStaffSettings } from "@/components/route-one/YardStaffSettings";
import DriverTrackingMap from "@/components/route-one/DriverTrackingMap";
import { JobFormFields, computeJobTotals } from "@/components/route-one/JobFormFields";
import { BookingWindowsPanel } from "@/components/route-one/BookingWindowsPanel";
import { downloadWtnPdf, printWtnPdf } from "@/lib/route-one-wtn";
import { FileDown, Printer } from "lucide-react";

import { JobPodSection } from "@/components/route-one/JobPodSection";
import { BespokeRateEditor } from "@/components/route-one/BespokeRateEditor";
import { CostItemsSettings } from "@/components/route-one/CostItemsSettings";
import { JobTypesSettings } from "@/components/route-one/JobTypesSettings";
import { ContainerTypesSettings } from "@/components/route-one/ContainerTypesSettings";
import { useJobTypes, jobTypeLabel, jobTypeSolidClass, jobTypeAccentClass } from "@/components/route-one/jobTypes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type JobType = "delivery" | "exchange" | "collection" | "waste_truck" | "wasted_journey";
type JobStatus = "unassigned" | "assigned" | "in_progress" | "completed" | "query";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  delivery: "Delivery",
  exchange: "Exchange",
  collection: "Collection",
  waste_truck: "Waste Truck",
  wasted_journey: "Wasted Journey",
};

// Legacy fully-colored card style — retained for detail dialogs and list badges.
const JOB_TYPE_COLORS: Record<JobType, string> = {
  delivery: "bg-emerald-600 border-emerald-700 text-white",
  exchange: "bg-amber-500 border-amber-600 text-white",
  collection: "bg-orange-500 border-orange-600 text-white",
  waste_truck: "bg-blue-600 border-blue-700 text-white",
  wasted_journey: "bg-red-600 border-red-700 text-white",
};

const JOB_TYPE_BADGE_COLORS: Record<JobType, string> = {
  delivery: "bg-white/25 text-white hover:bg-white/35 border-0",
  exchange: "bg-white/25 text-white hover:bg-white/35 border-0",
  collection: "bg-white/25 text-white hover:bg-white/35 border-0",
  waste_truck: "bg-white/25 text-white hover:bg-white/35 border-0",
  wasted_journey: "bg-white/25 text-white hover:bg-white/35 border-0",
};

// Kanban job-card accent bar (3px, square-cornered, left edge).
const JOB_TYPE_ACCENT: Record<JobType, string> = {
  delivery: "bg-emerald-500",
  exchange: "bg-amber-500",
  collection: "bg-orange-500",
  waste_truck: "bg-blue-500",
  wasted_journey: "bg-red-500",
};

// Independent tag colors used for the job-type pill on kanban cards.
const JOB_TYPE_TAG: Record<JobType, string> = {
  delivery: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20",
  exchange: "bg-amber-500/10 text-amber-700 border border-amber-500/20",
  collection: "bg-orange-500/10 text-orange-700 border border-orange-500/20",
  waste_truck: "bg-blue-500/10 text-blue-700 border border-blue-500/20",
  wasted_journey: "bg-red-500/10 text-red-700 border border-red-500/20",
};

// Configured job types (route_one_job_types) win; static maps are the fallback
// for legacy keys such as `wasted_journey`.
const jtLabel = (k: string) => jobTypeLabel(k) || JOB_TYPE_LABELS[k as JobType] || k;
const jtSolid = (k: string) => JOB_TYPE_COLORS[k as JobType] ?? jobTypeSolidClass(k);
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
  const [searchParams] = useSearchParams();
  // Loads configured job types into the shared registry used by jtLabel/jtSolid.
  useJobTypes();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "list" | "map" | "bookings">("day");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [newDriverOpen, setNewDriverOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverDriverId, setDragOverDriverId] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<any | null>(null);
  const [viewingSkiptrakJob, setViewingSkiptrakJob] = useState<any | null>(null);

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
    job_type: "delivery" as JobType,
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

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});

  // New driver form
  const [driverForm, setDriverForm] = useState({ driver_name: "", vehicle_type: "Skip" });

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");

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

  // Fetch jobs for selected date/week
  const { data: routeJobs = [] } = useQuery({
    queryKey: ["route-one-jobs", viewMode, dateStr, weekStart],
    queryFn: async () => {
      let query = supabase.from("route_one_jobs").select("*");
      if (viewMode === "day") {
        query = query.eq("scheduled_date", dateStr);
      } else {
        query = query.gte("scheduled_date", weekStart).lte("scheduled_date", weekEnd);
      }
      const { data, error } = await query.order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Fetch Skiptrak scheduled jobs for the selected date range (from data_hub_jobs)
  const { data: allSkiptrakScheduledJobs = [] } = useQuery({
    queryKey: ["route-one-skiptrak-jobs", viewMode, dateStr, weekStart],
    queryFn: async () => {
      let query = supabase
        .from("data_hub_jobs")
        .select("id, job_number, job_date, customer, site, movement_type, container_type, waste_description, weight_t, vehicle_registration, driver, tipping_location, rebate_rate_per_tonne")
        .eq("source", "skiptrak");
      if (viewMode === "day") {
        query = query.eq("job_date", dateStr);
      } else {
        query = query.gte("job_date", weekStart).lte("job_date", weekEnd);
      }
      const { data, error } = await query.not("driver", "is", null).order("job_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
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

  const skiptrakScheduledJobs = allSkiptrakScheduledJobs.filter((job: any) =>
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
    mutationFn: async (form: typeof jobForm) => {
      const { error } = await supabase.from("route_one_jobs").insert({
        customer_name: form.customer_name,
        site_name: form.site_name || null,
        site_address: form.site_address || null,
        site_postcode: form.site_postcode || null,
        job_type: form.job_type,
        container_type: form.container_type || null,
        container_size: form.container_size || null,
        waste_type: form.waste_type || null,
        notes: form.notes || null,
        po_number: form.po_number || null,
        scheduled_date: form.scheduled_date,
        assigned_driver_id: form.assigned_driver_id || null,
        status: form.assigned_driver_id ? "assigned" : "unassigned",
        ...costFields(form),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-one-jobs"] });
      setNewJobOpen(false);
      resetJobForm();
      toast({ title: "Job created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Create driver mutation
  const createDriver = useMutation({
    mutationFn: async (form: typeof driverForm) => {
      const { error } = await supabase.from("route_one_drivers").insert({
        driver_name: form.driver_name,
        display_order: drivers.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-one-drivers"] });
      setNewDriverOpen(false);
      setDriverForm({ driver_name: "", vehicle_type: "Skip" });
      toast({ title: "Driver added" });
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
      site_postcode: editForm.site_postcode || null,
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
    setEditForm({
      customer_name: job.customer_name || "",
      site_name: job.site_name || "",
      site_address: job.site_address || "",
      site_postcode: job.site_postcode || "",
      job_type: job.job_type || "delivery",
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
    });
    setEditingJob(job);
  };

  const resetJobForm = () => {
    setJobForm({
      customer_name: "", site_name: "", site_address: "", site_address_2: "", site_area: "",
      site_postcode: "", sic_code: "", site_contact_name: "", site_contact_phone: "",
      account_code: "", invoice_address: "", directions: "", disposal_site: "",
      vehicle_reg: "", carrier_name: "", ewc_code: "",
      job_type: "delivery", container_type: "", container_size: "", waste_type: "",
      notes: "", po_number: "", scheduled_date: format(selectedDate, "yyyy-MM-dd"),
      assigned_driver_id: "",
      haulage_cost: "", charge_per_tonne: "", min_weight_charge: "", weight_included_t: "",
      cost_items: [], contamination_charge: "", contamination_query_id: "", vat_rate: 20,
    });
  };


  const navigateDate = (dir: number) => {
    setSelectedDate((d) => addDays(d, viewMode === "day" ? dir : dir * 7));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.dataTransfer.effectAllowed = "move";
    // Add a slight delay to allow the drag image to render
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedJobId(null);
    setDragOverDriverId(null);
  };

  const handleDrop = (driverId: string | null) => {
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

  // Match Skiptrak jobs to drivers by name (fuzzy: lowercase trim)
  const getSkiptrakJobsForDriver = (driverName: string) => {
    const normalized = driverName.toLowerCase().trim();
    return skiptrakScheduledJobs.filter((j: any) => {
      const d = (j.driver || "").toLowerCase().trim();
      const dNorm = d.replace(/[.\-_]/g, " ");
      const nNorm = normalized.replace(/[.\-_]/g, " ");
      return dNorm === nNorm || dNorm.includes(nNorm) || nNorm.includes(dNorm);
    });
  };

  const unassignedJobs = jobs.filter((j: any) => !j.assigned_driver_id);

  // Stats
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j: any) => j.status === "completed").length;
  const queryJobs = jobs.filter((j: any) => j.status === "query").length;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header Bar */}
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Route className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">RouteOne</h1>
            <p className="text-xs text-muted-foreground">Transport Dispatch</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-3 h-7">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7">Week</TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-3 h-7"><List className="h-3 w-3 mr-1" />List</TabsTrigger>
              <TabsTrigger value="map" className="text-xs px-3 h-7"><MapPin className="h-3 w-3 mr-1" />Live Map</TabsTrigger>
              <TabsTrigger value="bookings" className="text-xs px-3 h-7"><CalendarClock className="h-3 w-3 mr-1" />Bookings</TabsTrigger>
            </TabsList>
          </Tabs>


          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs font-medium min-w-[120px]" onClick={() => setSelectedDate(new Date())}>
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              {viewMode === "day"
                ? format(selectedDate, "EEE dd MMM")
                : `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd MMM")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd MMM")}`
              }
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground ml-2">
            <span><strong className="text-foreground">{totalJobs}</strong> jobs</span>
            <span><strong className="text-emerald-600">{completedJobs}</strong> done</span>
            {queryJobs > 0 && <span><strong className="text-red-600">{queryJobs}</strong> queries</span>}
          </div>

          {/* Driver App Link */}
          <Link to="/driver" target="_blank">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Smartphone className="h-3.5 w-3.5" />
              Driver App
            </Button>
          </Link>

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
                <TabsList className="w-full grid grid-cols-4 lg:grid-cols-7">
                  <TabsTrigger value="drivers">Drivers</TabsTrigger>
                  <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                  <TabsTrigger value="yard-staff">Yard Staff</TabsTrigger>
                  <TabsTrigger value="driver-app">Driver App</TabsTrigger>
                  <TabsTrigger value="cost-items">Cost Items</TabsTrigger>
                  <TabsTrigger value="job-types">Job Types</TabsTrigger>
                  <TabsTrigger value="container-types">Containers</TabsTrigger>
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
                    <DriverAppManagement />
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
                </div>

              </Tabs>
            </SheetContent>
          </Sheet>

          <Dialog open={newDriverOpen} onOpenChange={setNewDriverOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <User className="h-3.5 w-3.5" />
                Add Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Driver</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Driver Name</Label>
                  <Input value={driverForm.driver_name} onChange={(e) => setDriverForm({ ...driverForm, driver_name: e.target.value })} placeholder="e.g. John Smith" />
                </div>
                <Button className="w-full" onClick={() => createDriver.mutate(driverForm)} disabled={!driverForm.driver_name || createDriver.isPending}>
                  {createDriver.isPending ? "Adding..." : "Add Driver"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={newJobOpen} onOpenChange={(open) => { setNewJobOpen(open); if (open) resetJobForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Job
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Job</DialogTitle>
              </DialogHeader>
              <JobFormFields form={jobForm} setForm={setJobForm} drivers={drivers} />
              <DialogFooter>
                <Button onClick={() => createJob.mutate(jobForm)} disabled={!jobForm.customer_name || createJob.isPending} className="w-full">
                  {createJob.isPending ? "Creating..." : "Create Job"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Job Dialog */}
      <Dialog open={!!editingJob} onOpenChange={(open) => { if (!open) setEditingJob(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Job
            </DialogTitle>
          </DialogHeader>
          <JobFormFields form={editForm} setForm={setEditForm} drivers={drivers} />
          <div className="flex items-center gap-2 mt-2">
            <Select value={editingJob?.status || "assigned"} onValueChange={(v) => setEditForm({ ...editForm, _status: v })}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="query">Query</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (editingJob) {
                  deleteJob.mutate(editingJob.id);
                  setEditingJob(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingJob(null)}>Cancel</Button>
            <Button onClick={saveEditedJob} disabled={!editForm.customer_name || updateJob.isPending}>
              {updateJob.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Native Job Dialog (read-only) */}
      <Dialog open={!!viewingJob} onOpenChange={(open) => { if (!open) setViewingJob(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Job Details
            </DialogTitle>
          </DialogHeader>
          {viewingJob && (() => {
            const jt = viewingJob.job_type as JobType;
            return (
              <div className="space-y-4">
                <div className={`rounded-lg p-3 ${jtSolid(jt)}`}>
                  <p className="text-sm font-bold">{viewingJob.customer_name}</p>
                  {viewingJob.site_name && <p className="text-xs mt-0.5 opacity-90">{viewingJob.site_name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailRow label="Job Type" value={jtLabel(jt)} />
                  <DetailRow label="Status" value={viewingJob.status} />
                  <DetailRow label="Date" value={viewingJob.scheduled_date} />
                  <DetailRow label="Duration" value={viewingJob.estimated_duration_mins ? `${viewingJob.estimated_duration_mins} min` : "—"} />
                  <DetailRow label="Container" value={viewingJob.container_type || "—"} />
                  <DetailRow label="Size" value={viewingJob.container_size || "—"} />
                  <DetailRow label="Waste Type" value={viewingJob.waste_type || "—"} />
                  <DetailRow label="EWC" value={viewingJob.ewc_code || "—"} />
                  <DetailRow label="PO Number" value={viewingJob.po_number || "—"} />
                  <DetailRow label="Account" value={viewingJob.account_code || "—"} />
                  <DetailRow label="Vehicle Reg" value={viewingJob.vehicle_reg || "—"} />
                  <DetailRow label="SIC Code" value={viewingJob.sic_code || "—"} />
                  <DetailRow label="Site Contact" value={viewingJob.site_contact_name || "—"} />
                  <DetailRow label="Contact Phone" value={viewingJob.site_contact_phone || "—"} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Full Address</p>
                  <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-line">
                    {[
                      viewingJob.site_name,
                      viewingJob.site_address,
                      viewingJob.site_address_2,
                      viewingJob.site_area,
                      viewingJob.site_postcode,
                    ]
                      .filter(Boolean)
                      .join("\n") || "—"}
                  </p>
                </div>
                {viewingJob.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm bg-muted/50 rounded p-2">{viewingJob.notes}</p>
                  </div>
                )}
                {(viewingJob.customer_signature || viewingJob.driver_signature) && (
                  <div className="grid grid-cols-2 gap-3">
                    {viewingJob.customer_signature && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Customer{viewingJob.customer_signoff_name ? ` — ${viewingJob.customer_signoff_name}` : ""}
                        </p>
                        <img src={viewingJob.customer_signature} alt="Customer signature" className="h-14 w-full rounded border bg-white object-contain" />
                      </div>
                    )}
                    {viewingJob.driver_signature && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Driver{viewingJob.driver_signoff_name ? ` — ${viewingJob.driver_signoff_name}` : ""}
                        </p>
                        <img src={viewingJob.driver_signature} alt="Driver signature" className="h-14 w-full rounded border bg-white object-contain" />
                      </div>
                    )}
                  </div>
                )}
                <JobPodSection jobNumber={viewingJob.job_number} />
                <DialogFooter className="gap-2 sm:gap-2">
                  <Button variant="outline" size="sm" onClick={() => printWtnPdf(viewingJob)}>
                    <Printer className="h-3 w-3 mr-1.5" /> Print WTN
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadWtnPdf(viewingJob)}>
                    <FileDown className="h-3 w-3 mr-1.5" /> Download WTN
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setViewingJob(null); openEditDialog(viewingJob); }}>
                    <Pencil className="h-3 w-3 mr-1.5" /> Edit Job
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* View Skiptrak Job Dialog */}
      <Dialog open={!!viewingSkiptrakJob} onOpenChange={(open) => { if (!open) setViewingSkiptrakJob(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Skiptrak Job Details
            </DialogTitle>
          </DialogHeader>
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
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailRow label="Job Number" value={viewingSkiptrakJob.job_number} />
                  <DetailRow label="Date" value={viewingSkiptrakJob.job_date || "—"} />
                  <DetailRow label="Customer" value={viewingSkiptrakJob.customer || "—"} />
                  <DetailRow label="Site" value={viewingSkiptrakJob.site || "—"} />
                  <DetailRow label="Driver" value={viewingSkiptrakJob.driver || "—"} />
                  <DetailRow label="Vehicle" value={viewingSkiptrakJob.vehicle_registration || "—"} />
                  <DetailRow label="Container" value={viewingSkiptrakJob.container_type || "—"} />
                  <DetailRow label="Waste" value={viewingSkiptrakJob.waste_description || "—"} />
                  <DetailRow label="Weight" value={viewingSkiptrakJob.weight_t != null ? `${viewingSkiptrakJob.weight_t}t` : "—"} />
                  <DetailRow label="Tipping Location" value={viewingSkiptrakJob.tipping_location || "—"} />
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
                <JobPodSection jobNumber={viewingSkiptrakJob.job_number} />
              </div>
            );
          })()}
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
        <div className="flex-1 overflow-auto p-4">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Job No</TableHead>
                  <TableHead className="w-[40px]">Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Container</TableHead>
                  <TableHead className="hidden lg:table-cell">Net Weight</TableHead>
                  <TableHead className="hidden lg:table-cell">Waste</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">PO</TableHead>
                  <TableHead className="hidden lg:table-cell">Source</TableHead>
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
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setViewingJob(job)}
                    >
                      <TableCell className="text-sm tabular-nums font-medium">{job.job_number || "—"}</TableCell>
                      <TableCell>
                        <div className={`w-3 h-3 rounded-full ${
                          status === "completed" ? "bg-emerald-500" :
                          status === "in_progress" ? "bg-blue-500" :
                          status === "query" ? "bg-red-500" :
                          status === "assigned" ? "bg-primary" :
                          "bg-muted-foreground/30"
                        }`} />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{job.customer_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.site_name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className={`text-[10px] ${jtSolid(jt)}`}>{jtLabel(jt)}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{job.container_type || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm tabular-nums">{job.net_weight_t != null ? `${job.net_weight_t}t` : job.weight_t != null ? `${job.weight_t}t` : "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{job.waste_type || "—"}</TableCell>
                      <TableCell className="text-sm">{driver?.driver_name || "Unassigned"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{job.scheduled_date ? format(new Date(job.scheduled_date), "dd/MM/yy") : ""}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{job.po_number || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-[10px]">Native</Badge>
                      </TableCell>
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateJob.mutate({ id: job.id, updates: { status: "completed" } }); }}>Mark Complete</DropdownMenuItem>
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
                      <TableCell className="text-sm tabular-nums font-medium">{sj.job_number || "—"}</TableCell>
                      <TableCell>
                        <div className="w-3 h-3 rounded-full bg-muted-foreground/20 border border-dashed border-muted-foreground/40" />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{sj.customer || "Unknown"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sj.site || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {mt ? (
                          <Badge className={`text-[10px] ${jtSolid(mt)}`}>{sj.movement_type}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{sj.movement_type || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{sj.container_type || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm tabular-nums">{sj.weight_t != null ? `${sj.weight_t}t` : "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        <span>{sj.waste_description || "—"}</span>
                        {sj.rebate_rate_per_tonne != null && (
                          <Badge variant="outline" className="ml-1.5 text-[10px]">£{Number(sj.rebate_rate_per_tonne).toFixed(2)}/t</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{sj.driver || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{sj.job_date ? format(new Date(sj.job_date), "dd/MM/yy") : ""}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">—</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="secondary" className="text-[10px]">Skiptrak</Badge>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })}
                {jobs.length === 0 && skiptrakScheduledJobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-muted-foreground py-12">
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
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max">
          {/* Unassigned Column */}
          <div
            className={`w-64 shrink-0 border-r border-border flex flex-col transition-colors ${
              dragOverDriverId === "__unassigned__" ? "bg-primary/5" : "bg-muted/30"
            }`}
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(null)}
          >
            <div className="px-3 py-2.5 border-b border-hairline bg-muted/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Unassigned</span>
                <span className="text-[11px] font-medium text-muted-foreground bg-background rounded-full px-2 py-0.5">{unassignedJobs.length}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {unassignedJobs.map((job: any) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onEdit={() => openEditDialog(job)}
                  onView={() => setViewingJob(job)}
                  onDelete={() => deleteJob.mutate(job.id)}
                  onStatusChange={(status) => updateJob.mutate({ id: job.id, updates: { status } })}
                  onDragStart={(e) => handleDragStart(e, job.id)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedJobId === job.id}
                />
              ))}
              {unassignedJobs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No unassigned jobs</p>
              )}
            </div>
          </div>

          {/* Driver Columns */}
          {drivers.map((driver: any) => {
            const driverJobs = getDriverJobs(driver.id);
            const skiptrakJobs = getSkiptrakJobsForDriver(driver.driver_name);
            const totalCount = driverJobs.length + skiptrakJobs.length;
            const isDropTarget = dragOverDriverId === driver.id;
            return (
              <div
                key={driver.id}
                className={`w-64 shrink-0 border-r border-border flex flex-col transition-colors ${
                  isDropTarget ? "bg-primary/5" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, driver.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(driver.id)}
              >
                <div className="px-3 py-2.5 border-b border-hairline bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{driver.driver_name}</p>
                        {driver.route_one_vehicles && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {driver.route_one_vehicles.registration} · {driver.route_one_vehicles.vehicle_type}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">{totalCount}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {driverJobs.map((job: any) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onEdit={() => openEditDialog(job)}
                      onView={() => setViewingJob(job)}
                      onDelete={() => deleteJob.mutate(job.id)}
                      onStatusChange={(status) => updateJob.mutate({ id: job.id, updates: { status } })}
                      onDragStart={(e) => handleDragStart(e, job.id)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedJobId === job.id}
                    />
                  ))}
                  {skiptrakJobs.length > 0 && driverJobs.length > 0 && (
                    <div className="border-t border-dashed border-border my-2 pt-2 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Skiptrak</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  {skiptrakJobs.map((sj: any) => (
                    <SkiptrakJobCard key={sj.job_number} job={sj} onClick={() => setViewingSkiptrakJob(sj)} />
                  ))}
                  {totalCount === 0 && (
                    <div className="h-full flex items-center justify-center py-8">
                      <div className="w-full mx-2 rounded-md border border-dashed border-hairline py-6 flex flex-col items-center gap-1.5 text-muted-foreground">
                        <Truck className="h-5 w-5 opacity-60" />
                        <p className="text-[11px]">Drop jobs here</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state if no drivers */}
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
  onEdit,
  onView,
  onDelete,
  onStatusChange,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  job: any;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onStatusChange: (status: JobStatus) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragging: boolean;
}) {
  const jobType = job.job_type as JobType;
  const status = job.status as JobStatus;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onView}
      className={`group relative rounded-md bg-card border border-hairline pl-3 pr-2.5 py-2 cursor-pointer select-none transition-all hover:shadow-hover hover:-translate-y-px overflow-hidden ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
    >
      {/* 3px square-cornered left accent bar */}
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${jtAccent(jobType) ?? "bg-muted"}`} />

      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/50" />
          <span className="text-[13px] font-medium truncate text-foreground">{job.customer_name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {job.job_number && (
            <span className="text-[10px] text-muted-foreground tabular-nums">#{job.job_number}</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3 text-muted-foreground" />
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("in_progress"); }}>Mark In Progress</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("completed"); }}>Mark Complete</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("query"); }}>Flag as Query</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">Delete Job</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {job.site_name && (
        <div className="flex items-center gap-1 mt-1">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] truncate text-muted-foreground">{job.site_name}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium ${jtTag(jobType)}`}>
          {jtLabel(jobType)}
        </Badge>
        {job.container_type && (
          <span className="text-[10px] text-muted-foreground">{job.container_type}</span>
        )}
        {job.container_size && (
          <span className="text-[10px] text-muted-foreground">{job.container_size}</span>
        )}
        {status === "query" && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 border-0 bg-destructive/10 text-destructive font-medium">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Query
          </Badge>
        )}
        {status === "completed" && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 border-0 bg-success/10 text-success">Done</Badge>
        )}
        {status === "in_progress" && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 border-0 bg-info/10 text-info">In Progress</Badge>
        )}
      </div>

      {job.estimated_duration_mins && (
        <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          <span className="text-[10px]">{job.estimated_duration_mins} min</span>
        </div>
      )}
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
function SkiptrakJobCard({ job, onClick }: { job: any; onClick?: () => void }) {
  const mappedType = getSkiptrakJobType(job.movement_type);
  const accent = mappedType ? jtAccent(mappedType) : "bg-muted-foreground/40";
  const tagClass = mappedType ? JOB_TYPE_TAG[mappedType] : "bg-muted text-muted-foreground border border-hairline";

  return (
    <div
      onClick={onClick}
      className="group relative rounded-md bg-card border border-dashed border-hairline pl-3 pr-2.5 py-2 cursor-pointer transition-all hover:shadow-hover hover:-translate-y-px overflow-hidden"
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${accent}`} />

      <div className="flex items-start justify-between gap-1">
        <span className="text-[13px] font-medium truncate text-foreground">{job.customer || "Unknown"}</span>
        {job.job_number && (
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">#{job.job_number}</span>
        )}
      </div>

      {job.site && (
        <div className="flex items-center gap-1 mt-1">
          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-[11px] truncate text-muted-foreground">{job.site}</span>
        </div>
      )}
      {job.tipping_location && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-muted-foreground">→ {job.tipping_location}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {job.movement_type && (
          <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium ${tagClass}`}>
            {job.movement_type}
          </Badge>
        )}
        {job.container_type && (
          <span className="text-[10px] text-muted-foreground">{job.container_type}</span>
        )}
        {job.weight_t != null && job.weight_t > 0 && (
          <span className="text-[10px] text-muted-foreground">{job.weight_t}t</span>
        )}
      </div>
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
