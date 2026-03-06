import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DriverSettings } from "@/components/route-one/DriverSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  delivery: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700",
  exchange: "bg-amber-500/15 border-amber-500/40 text-amber-700",
  collection: "bg-orange-500/15 border-orange-500/40 text-orange-700",
  waste_truck: "bg-blue-500/15 border-blue-500/40 text-blue-700",
  wasted_journey: "bg-red-500/15 border-red-500/40 text-red-700",
};

const JOB_TYPE_BADGE_COLORS: Record<JobType, string> = {
  delivery: "bg-emerald-500 text-white hover:bg-emerald-600",
  exchange: "bg-amber-500 text-white hover:bg-amber-600",
  collection: "bg-orange-500 text-white hover:bg-orange-600",
  waste_truck: "bg-blue-500 text-white hover:bg-blue-600",
  wasted_journey: "bg-red-500 text-white hover:bg-red-600",
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
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [newDriverOpen, setNewDriverOpen] = useState(false);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);

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

  // Update job (reassign driver)
  const updateJob = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("route_one_jobs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["route-one-jobs"] }),
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
  const handleDragStart = (jobId: string) => setDraggedJobId(jobId);

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
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // Get jobs for a specific driver (manual + Skiptrak)
  const getDriverJobs = (driverId: string) =>
    jobs.filter((j: any) => j.assigned_driver_id === driverId);

  // Match Skiptrak jobs to drivers by name (fuzzy: lowercase trim)
  const getSkiptrakJobsForDriver = (driverName: string) => {
    const normalized = driverName.toLowerCase().trim();
    return skiptrakScheduledJobs.filter((j: any) => {
      const d = (j.driver || "").toLowerCase().trim();
      // Match if driver name contains or equals (handles "Lee.Gane" vs "Lee Gane")
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
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week")}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-3 h-7">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3 h-7">Week</TabsTrigger>
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

          {/* Add buttons */}
          {/* Driver Settings */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Drivers
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[800px] sm:max-w-[800px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Driver Settings</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <DriverSettings />
              </div>
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
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Customer *</Label>
                    <Input value={jobForm.customer_name} onChange={(e) => setJobForm({ ...jobForm, customer_name: e.target.value })} placeholder="Customer name" />
                  </div>
                  <div>
                    <Label className="text-xs">Site</Label>
                    <Input value={jobForm.site_name} onChange={(e) => setJobForm({ ...jobForm, site_name: e.target.value })} placeholder="Site name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Site Address</Label>
                    <Input value={jobForm.site_address} onChange={(e) => setJobForm({ ...jobForm, site_address: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Postcode</Label>
                    <Input value={jobForm.site_postcode} onChange={(e) => setJobForm({ ...jobForm, site_postcode: e.target.value })} placeholder="e.g. LS1 4AP" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Job Type *</Label>
                    <Select value={jobForm.job_type} onValueChange={(v) => setJobForm({ ...jobForm, job_type: v as JobType })}>
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
                    <Select value={jobForm.container_type} onValueChange={(v) => setJobForm({ ...jobForm, container_type: v })}>
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
                    <Input type="date" value={jobForm.scheduled_date} onChange={(e) => setJobForm({ ...jobForm, scheduled_date: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Duration (mins)</Label>
                    <Input type="number" value={jobForm.estimated_duration_mins} onChange={(e) => setJobForm({ ...jobForm, estimated_duration_mins: parseInt(e.target.value) || 60 })} />
                  </div>
                  <div>
                    <Label className="text-xs">PO Number</Label>
                    <Input value={jobForm.po_number} onChange={(e) => setJobForm({ ...jobForm, po_number: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Assign Driver</Label>
                  <Select value={jobForm.assigned_driver_id} onValueChange={(v) => setJobForm({ ...jobForm, assigned_driver_id: v === "unassigned" ? "" : v })}>
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
                  <Label className="text-xs">Waste Type</Label>
                  <Input value={jobForm.waste_type} onChange={(e) => setJobForm({ ...jobForm, waste_type: e.target.value })} placeholder="e.g. Mixed Waste" />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} rows={2} />
                </div>
                <Button onClick={() => createJob.mutate(jobForm)} disabled={!jobForm.customer_name || createJob.isPending}>
                  {createJob.isPending ? "Creating..." : "Create Job"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dispatch Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max">
          {/* Unassigned Column */}
          <div
            className="w-64 shrink-0 border-r border-border bg-muted/30 flex flex-col"
            onDragOver={handleDragOver}
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
                <JobCard key={job.id} job={job} onDelete={() => deleteJob.mutate(job.id)} onStatusChange={(status) => updateJob.mutate({ id: job.id, updates: { status } })} onDragStart={() => handleDragStart(job.id)} />
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
            return (
              <div
                key={driver.id}
                className="w-64 shrink-0 border-r border-border flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(driver.id)}
              >
                <div className="px-3 py-2 border-b border-border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{driver.driver_name}</p>
                        {driver.route_one_vehicles && (
                          <p className="text-[10px] text-muted-foreground">
                            {driver.route_one_vehicles.registration} · {driver.route_one_vehicles.vehicle_type}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5">{totalCount}</Badge>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {driverJobs.map((job: any) => (
                    <JobCard key={job.id} job={job} onDelete={() => deleteJob.mutate(job.id)} onStatusChange={(status) => updateJob.mutate({ id: job.id, updates: { status } })} onDragStart={() => handleDragStart(job.id)} />
                  ))}
                  {skiptrakJobs.length > 0 && driverJobs.length > 0 && (
                    <div className="border-t border-border/50 my-1 pt-1">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Skiptrak</span>
                    </div>
                  )}
                  {skiptrakJobs.map((sj: any) => (
                    <SkiptrakJobCard key={sj.job_number} job={sj} />
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

// Job Card Component
function JobCard({
  job,
  onDelete,
  onStatusChange,
  onDragStart,
}: {
  job: any;
  onDelete: () => void;
  onStatusChange: (status: JobStatus) => void;
  onDragStart: () => void;
}) {
  const jobType = job.job_type as JobType;
  const status = job.status as JobStatus;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`rounded-lg border p-2.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${JOB_TYPE_COLORS[jobType]}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="h-3 w-3 shrink-0 opacity-40" />
          <span className="text-xs font-bold truncate">{job.customer_name}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-black/5 shrink-0">
              <MoreVertical className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onStatusChange("in_progress")}>Mark In Progress</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange("completed")}>Mark Complete</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange("query")}>Flag as Query</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">Delete Job</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {job.site_name && (
        <div className="flex items-center gap-1 mt-1.5">
          <MapPin className="h-3 w-3 opacity-50 shrink-0" />
          <span className="text-[10px] truncate">{job.site_name}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 ${JOB_TYPE_BADGE_COLORS[jobType]}`}>
          {JOB_TYPE_LABELS[jobType]}
        </Badge>
        {job.container_type && (
          <span className="text-[10px] opacity-60">{job.container_type}</span>
        )}
        {status === "query" && (
          <AlertTriangle className="h-3 w-3 text-red-500" />
        )}
        {status === "completed" && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 border-0 bg-emerald-500 text-white">Done</Badge>
        )}
      </div>

      {job.estimated_duration_mins && (
        <div className="flex items-center gap-1 mt-1.5 opacity-50">
          <Clock className="h-2.5 w-2.5" />
          <span className="text-[10px]">{job.estimated_duration_mins} min</span>
        </div>
      )}
    </div>
  );
}

export default RouteOnePage;
