import { useState, useRef } from "react";
import { Link } from "react-router-dom";
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
  Smartphone,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DriverSettings } from "@/components/route-one/DriverSettings";
import { VehicleSettings } from "@/components/route-one/VehicleSettings";
import { DriverAppManagement } from "@/components/route-one/DriverAppManagement";
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

const STATUS_COLORS: Record<JobStatus, string> = {
  unassigned: "bg-muted text-muted-foreground",
  assigned: "bg-primary/10 text-primary",
  in_progress: "bg-blue-500/10 text-blue-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  query: "bg-red-500/10 text-red-600",
};

const RouteOnePage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "list">("day");
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
    site_postcode: "",
    job_type: "delivery" as JobType,
    container_type: "",
    container_size: "",
    waste_type: "",
    notes: "",
    po_number: "",
    scheduled_date: format(new Date(), "yyyy-MM-dd"),
    assigned_driver_id: "",
    estimated_duration_mins: 60,
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
  const { data: jobs = [] } = useQuery({
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
  const { data: skiptrakScheduledJobs = [] } = useQuery({
    queryKey: ["route-one-skiptrak-jobs", viewMode, dateStr, weekStart],
    queryFn: async () => {
      let query = supabase
        .from("data_hub_jobs")
        .select("job_number, job_date, customer, site, movement_type, container_type, waste_description, weight_t, vehicle_registration, driver, tipping_location")
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
        estimated_duration_mins: form.estimated_duration_mins,
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
      estimated_duration_mins: editForm.estimated_duration_mins,
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
      estimated_duration_mins: job.estimated_duration_mins || 60,
    });
    setEditingJob(job);
  };

  const resetJobForm = () => {
    setJobForm({
      customer_name: "", site_name: "", site_address: "", site_postcode: "",
      job_type: "delivery", container_type: "", container_size: "", waste_type: "",
      notes: "", po_number: "", scheduled_date: format(selectedDate, "yyyy-MM-dd"),
      assigned_driver_id: "", estimated_duration_mins: 60,
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
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week" | "list")}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-3 h-7">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7">Week</TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-3 h-7"><List className="h-3 w-3 mr-1" />List</TabsTrigger>
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
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="drivers">Drivers</TabsTrigger>
                  <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                  <TabsTrigger value="driver-app">Driver App</TabsTrigger>
                </TabsList>
                <div className="mt-4">
                  <TabsContent value="drivers">
                    <DriverSettings />
                  </TabsContent>
                  <TabsContent value="vehicles">
                    <VehicleSettings />
                  </TabsContent>
                  <TabsContent value="driver-app">
                    <DriverAppManagement />
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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <div className={`rounded-lg p-3 ${JOB_TYPE_COLORS[jt]}`}>
                  <p className="text-sm font-bold">{viewingJob.customer_name}</p>
                  {viewingJob.site_name && <p className="text-xs mt-0.5 opacity-90">{viewingJob.site_name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailRow label="Job Type" value={JOB_TYPE_LABELS[jt]} />
                  <DetailRow label="Status" value={viewingJob.status} />
                  <DetailRow label="Date" value={viewingJob.scheduled_date} />
                  <DetailRow label="Duration" value={viewingJob.estimated_duration_mins ? `${viewingJob.estimated_duration_mins} min` : "—"} />
                  <DetailRow label="Container" value={viewingJob.container_type || "—"} />
                  <DetailRow label="Size" value={viewingJob.container_size || "—"} />
                  <DetailRow label="Waste Type" value={viewingJob.waste_type || "—"} />
                  <DetailRow label="PO Number" value={viewingJob.po_number || "—"} />
                  <DetailRow label="Address" value={viewingJob.site_address || "—"} />
                  <DetailRow label="Postcode" value={viewingJob.site_postcode || "—"} />
                </div>
                {viewingJob.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm bg-muted/50 rounded p-2">{viewingJob.notes}</p>
                  </div>
                )}
                <DialogFooter>
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
            const colorClass = mt ? JOB_TYPE_COLORS[mt] : "bg-muted text-foreground";
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
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dispatch Board */}
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
            <div className="px-3 py-2 border-b border-border bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unassigned</span>
                <Badge variant="secondary" className="text-[10px] h-5">{unassignedJobs.length}</Badge>
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
                <div className="px-3 py-2.5 border-b border-border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{driver.driver_name}</p>
                        {driver.route_one_vehicles && (
                          <p className="text-[10px] text-muted-foreground">
                            {driver.route_one_vehicles.registration} · {driver.route_one_vehicles.vehicle_type}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5 font-bold">{totalCount}</Badge>
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
                    <div className="h-full flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Drop jobs here</p>
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
    </div>
  );
};

// Autocomplete input with dropdown suggestions
function AutocompleteInput({
  value,
  onChange,
  placeholder,
  fetchSuggestions,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  fetchSuggestions: (query: string) => Promise<string[]>;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await fetchSuggestions(val);
      setSuggestions(results);
      setOpen(results.length > 0);
      setLoading(false);
    }, 300);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent truncate"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Shared form fields for Create and Edit dialogs
function JobFormFields({
  form,
  setForm,
  drivers,
}: {
  form: any;
  setForm: (f: any) => void;
  drivers: any[];
}) {
  const fetchCustomers = async (query: string): Promise<string[]> => {
    const { data } = await supabase
      .from("data_hub_jobs")
      .select("customer")
      .ilike("customer", `%${query}%`)
      .not("customer", "is", null)
      .limit(100);
    if (!data) return [];
    const unique = [...new Set(data.map((r: any) => r.customer).filter(Boolean))];
    return unique.slice(0, 10);
  };

  const fetchSites = async (query: string): Promise<string[]> => {
    let q = supabase
      .from("data_hub_jobs")
      .select("site")
      .ilike("site", `%${query}%`)
      .not("site", "is", null)
      .limit(100);
    if (form.customer_name) {
      q = q.ilike("customer", `%${form.customer_name}%`);
    }
    const { data } = await q;
    if (!data) return [];
    const unique = [...new Set(data.map((r: any) => r.site).filter(Boolean))];
    return unique.slice(0, 10);
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Customer *</Label>
          <AutocompleteInput
            value={form.customer_name}
            onChange={(val) => setForm({ ...form, customer_name: val })}
            placeholder="Start typing customer..."
            fetchSuggestions={fetchCustomers}
          />
        </div>
        <div>
          <Label className="text-xs">Site</Label>
          <AutocompleteInput
            value={form.site_name}
            onChange={(val) => setForm({ ...form, site_name: val })}
            placeholder="Start typing site..."
            fetchSuggestions={fetchSites}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Site Address</Label>
          <Input value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Postcode</Label>
          <Input value={form.site_postcode} onChange={(e) => setForm({ ...form, site_postcode: e.target.value })} placeholder="e.g. LS1 4AP" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Job Type *</Label>
          <Select value={form.job_type} onValueChange={(v) => setForm({ ...form, job_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Container Type</Label>
          <Select value={form.container_type} onValueChange={(v) => setForm({ ...form, container_type: v })}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Skip">Skip</SelectItem>
              <SelectItem value="RoRo">RoRo</SelectItem>
              <SelectItem value="Trailer">Trailer</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Duration (mins)</Label>
          <Input type="number" value={form.estimated_duration_mins} onChange={(e) => setForm({ ...form, estimated_duration_mins: parseInt(e.target.value) || 60 })} />
        </div>
        <div>
          <Label className="text-xs">PO Number</Label>
          <Input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Assign Driver</Label>
        <Select value={form.assigned_driver_id || "unassigned"} onValueChange={(v) => setForm({ ...form, assigned_driver_id: v === "unassigned" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {drivers.map((d: any) => (
              <SelectItem key={d.id} value={d.id}>{d.driver_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Container Size</Label>
        <Input value={form.container_size} onChange={(e) => setForm({ ...form, container_size: e.target.value })} placeholder="e.g. 8yd, 20yd" />
      </div>
      <div>
        <Label className="text-xs">Waste Type</Label>
        <Input value={form.waste_type} onChange={(e) => setForm({ ...form, waste_type: e.target.value })} placeholder="e.g. Mixed Waste" />
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
    </div>
  );
}

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
      className={`rounded-lg border p-2.5 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] select-none shadow-sm ${JOB_TYPE_COLORS[jobType]} ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3 w-3 shrink-0 text-white/50" />
          <span className="text-xs font-bold truncate text-white">{job.customer_name}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-white/20 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3 text-white/70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3 w-3 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("in_progress"); }}>Mark In Progress</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("completed"); }}>Mark Complete</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange("query"); }}>Flag as Query</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">Delete Job</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {job.site_name && (
        <div className="flex items-center gap-1 mt-1.5">
          <MapPin className="h-3 w-3 text-white/60 shrink-0" />
          <span className="text-[11px] truncate text-white/90">{job.site_name}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge className={`text-[10px] px-1.5 py-0 h-4 ${JOB_TYPE_BADGE_COLORS[jobType]}`}>
          {JOB_TYPE_LABELS[jobType]}
        </Badge>
        {job.container_type && (
          <span className="text-[10px] text-white/70">{job.container_type}</span>
        )}
        {job.container_size && (
          <span className="text-[10px] text-white/70">{job.container_size}</span>
        )}
        {status === "query" && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 border-0 bg-white text-red-600 font-bold">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Query
          </Badge>
        )}
        {status === "completed" && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 border-0 bg-white/30 text-white">Done</Badge>
        )}
        {status === "in_progress" && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 border-0 bg-white/30 text-white">In Progress</Badge>
        )}
      </div>

      {job.estimated_duration_mins && (
        <div className="flex items-center gap-1 mt-1.5 text-white/50">
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
  const colorClass = mappedType
    ? JOB_TYPE_COLORS[mappedType]
    : "bg-muted border-border text-foreground";
  const badgeClass = mappedType
    ? JOB_TYPE_BADGE_COLORS[mappedType]
    : "bg-muted text-muted-foreground";

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border-2 border-dashed p-2.5 shadow-sm cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all ${colorClass} ${!mappedType ? "border-border" : "border-white/30"}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-bold truncate ${mappedType ? "text-white" : "text-foreground"}`}>{job.customer || "Unknown"}</span>
      </div>
      {job.site && (
        <div className="flex items-center gap-1 mt-1">
          <MapPin className={`h-3 w-3 shrink-0 ${mappedType ? "text-white/60" : "text-muted-foreground"}`} />
          <span className={`text-[11px] truncate ${mappedType ? "text-white/90" : "text-muted-foreground"}`}>{job.site}</span>
        </div>
      )}
      {job.tipping_location && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`text-[10px] ${mappedType ? "text-white/70" : "text-muted-foreground"}`}>→ {job.tipping_location}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {job.movement_type && (
          <Badge className={`text-[10px] px-1.5 py-0 h-4 ${badgeClass}`}>
            {job.movement_type}
          </Badge>
        )}
        {job.container_type && (
          <span className={`text-[10px] ${mappedType ? "text-white/70" : "text-muted-foreground"}`}>{job.container_type}</span>
        )}
        {job.weight_t != null && job.weight_t > 0 && (
          <span className={`text-[10px] ${mappedType ? "text-white/70" : "text-muted-foreground"}`}>{job.weight_t}t</span>
        )}
      </div>
      <div className="mt-1">
        <Badge className={`text-[9px] px-1 py-0 h-3.5 ${mappedType ? "bg-white/20 text-white border-0" : "bg-muted text-muted-foreground"}`}>Skiptrak #{job.job_number}</Badge>
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
