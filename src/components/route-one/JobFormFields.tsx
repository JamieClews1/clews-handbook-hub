import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, Plus, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useJobTypes } from "./jobTypes";
import { JobPricingPicker } from "./JobPricingPicker";

/** Legacy static labels — configured job types come from route_one_job_types. */
export const JOB_TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  exchange: "Exchange",
  collection: "Collection",
  waste_truck: "Waste Truck",
  wasted_journey: "Wasted Journey",
};

export type CostItem = { name: string; charge: number; qty: number };

const num = (v: any) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

/** Net / gross totals derived from the cost fields on a job form. */
export function computeJobTotals(form: any) {
  const haulage = num(form.haulage_cost);
  const perTonne = num(form.charge_per_tonne);
  const weight = num(form.weight_included_t);
  const minCharge = num(form.min_weight_charge);
  const tonnage = Math.max(perTonne * weight, minCharge);
  const items = (form.cost_items ?? []).reduce(
    (s: number, i: CostItem) => s + num(i.charge) * (num(i.qty) || 1),
    0,
  );
  const contamination = num(form.contamination_charge);
  const net = Math.round((haulage + tonnage + items + contamination) * 100) / 100;
  const vatRate = form.vat_rate == null ? 20 : num(form.vat_rate);
  const gross = Math.round(net * (1 + vatRate / 100) * 100) / 100;
  return { tonnage, items, net, gross, vatRate };
}

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(val);
      setSuggestions(results);
      setOpen(results.length > 0);
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

export function JobFormFields({
  form,
  setForm,
  drivers,
}: {
  form: any;
  setForm: (f: any) => void;
  drivers: any[];
}) {
  const [setupSites, setSetupSites] = useState<string[]>([]);
  const [manualSite, setManualSite] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevJobs, setPrevJobs] = useState<any[]>([]);
  const [prevLoading, setPrevLoading] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [containerTypes, setContainerTypes] = useState<string[]>([]);
  const { types: jobTypes } = useJobTypes();

  const customer = form.customer_name || "";

  // Sites for the chosen customer — from customer setup AND the Data Hub history
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!customer || customer.length < 2) { setSetupSites([]); return; }
      const { data: custs } = await supabase
        .from("customers")
        .select("id, customer_name")
        .ilike("customer_name", `%${customer}%`)
        .limit(5);

      const [setupRes, hubRes] = await Promise.all([
        custs?.length
          ? supabase
              .from("customer_sites")
              .select("site_name")
              .in("customer_id", custs.map((c) => c.id))
              .order("site_name")
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("data_hub_jobs")
          .select("site")
          .ilike("customer", `%${customer}%`)
          .not("site", "is", null)
          .order("job_date", { ascending: false })
          .limit(1000),
      ]);

      if (cancelled) return;
      const names = [
        ...((setupRes.data ?? []) as any[]).map((s) => s.site_name),
        ...((hubRes.data ?? []) as any[]).map((s) => s.site),
      ]
        .map((n: any) => (typeof n === "string" ? n.trim() : ""))
        .filter(Boolean);

      // De-dupe case-insensitively, keeping first-seen casing
      const seen = new Map<string, string>();
      for (const n of names) if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
      setSetupSites([...seen.values()].sort((a, b) => a.localeCompare(b)));
    };
    load();
    return () => { cancelled = true; };
  }, [customer]);


  useEffect(() => {
    supabase
      .from("route_one_cost_items")
      .select("*")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => setCatalogue(data ?? []));
  }, []);

  useEffect(() => {
    supabase
      .from("route_one_container_types")
      .select("name")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => setContainerTypes((data ?? []).map((r: any) => r.name).filter(Boolean)));
  }, []);

  const fetchCustomers = async (query: string): Promise<string[]> => {
    const [{ data: setup }, { data: hub }] = await Promise.all([
      supabase.from("customers").select("customer_name").ilike("customer_name", `%${query}%`).limit(20),
      supabase.from("data_hub_jobs").select("customer").ilike("customer", `%${query}%`).not("customer", "is", null).limit(100),
    ]);
    const names = [
      ...(setup ?? []).map((r: any) => r.customer_name),
      ...(hub ?? []).map((r: any) => r.customer),
    ].filter(Boolean);
    return [...new Set(names)].slice(0, 10);
  };

  /** Previous jobs for this customer/site — used to set up an exchange. */
  const loadPreviousJobs = async () => {
    setPrevLoading(true);
    setPrevOpen(true);
    let q = supabase
      .from("data_hub_jobs")
      .select("job_number, job_date, customer, site, movement_type, container_type, waste_description, weight_t")
      .order("job_date", { ascending: false })
      .limit(25);
    const site = (form.site_name || "").trim();
    if (customer) q = q.ilike("customer", `%${customer}%`);
    // When a site is chosen, restrict history to that exact site (case-insensitive)
    if (site) q = q.ilike("site", site);
    const { data: hub } = await q;

    let rq = supabase
      .from("route_one_jobs")
      .select("id, job_number, scheduled_date, customer_name, site_name, site_address, site_postcode, job_type, container_type, container_size, waste_type, haulage_cost, charge_per_tonne, min_weight_charge, weight_included_t, cost_items, vat_rate, po_number")
      .order("scheduled_date", { ascending: false })
      .limit(25);
    if (customer) rq = rq.ilike("customer_name", `%${customer}%`);
    if (site) rq = rq.ilike("site_name", site);
    const { data: own } = await rq;

    const rows = [
      ...(own ?? []).map((j: any) => ({ ...j, _source: "routeone" })),
      ...(hub ?? []).map((j: any) => ({ ...j, _source: "skiptrak" })),
    ];
    setPrevJobs(rows);
    setPrevLoading(false);
  };

  /** Prefill the form from a previous job, defaulting to an exchange. */
  const applyPrevious = (j: any) => {
    if (j._source === "routeone") {
      setForm({
        ...form,
        customer_name: j.customer_name || form.customer_name,
        site_name: j.site_name || form.site_name,
        site_address: j.site_address || form.site_address,
        site_postcode: j.site_postcode || form.site_postcode,
        job_type: "exchange",
        container_type: j.container_type || "",
        container_size: j.container_size || "",
        waste_type: j.waste_type || "",
        po_number: j.po_number || form.po_number,
        haulage_cost: j.haulage_cost ?? "",
        charge_per_tonne: j.charge_per_tonne ?? "",
        min_weight_charge: j.min_weight_charge ?? "",
        weight_included_t: j.weight_included_t ?? "",
        cost_items: Array.isArray(j.cost_items) ? j.cost_items : [],
        vat_rate: j.vat_rate ?? 20,
        notes: `${form.notes ? form.notes + "\n" : ""}Exchange of container from job ${j.job_number || ""}`.trim(),
      });
    } else {
      setForm({
        ...form,
        customer_name: j.customer || form.customer_name,
        site_name: j.site || form.site_name,
        job_type: "exchange",
        container_type: j.container_type || "",
        waste_type: j.waste_description || "",
        notes: `${form.notes ? form.notes + "\n" : ""}Exchange of container from job ${j.job_number || ""}`.trim(),
      });
    }
    setPrevOpen(false);
  };

  const items: CostItem[] = Array.isArray(form.cost_items) ? form.cost_items : [];
  const setItems = (next: CostItem[]) => setForm({ ...form, cost_items: next });

  const totals = useMemo(() => computeJobTotals(form), [form]);

  return (
    <div className="grid gap-4">
      {/* Customer & site */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer &amp; Site</h4>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={loadPreviousJobs}>
            <History className="h-3.5 w-3.5" />
            Use previous job / exchange
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Customer *</Label>
            <AutocompleteInput
              value={form.customer_name || ""}
              onChange={(val) => setForm({ ...form, customer_name: val })}
              placeholder="Start typing customer..."
              fetchSuggestions={fetchCustomers}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Site</Label>
              <button
                type="button"
                className="text-[11px] text-primary hover:underline"
                onClick={() => setManualSite((m) => !m)}
              >
                {manualSite ? "Pick from known sites" : "Enter manually"}
              </button>
            </div>
            {manualSite || setupSites.length === 0 ? (
              <Input
                value={form.site_name || ""}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                placeholder={setupSites.length === 0 ? "No known sites — type site name" : "Site name"}
              />
            ) : (
              <Select value={form.site_name || ""} onValueChange={(v) => setForm({ ...form, site_name: v })}>
                <SelectTrigger><SelectValue placeholder={`Select from ${setupSites.length} known sites...`} /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {setupSites.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Site Address</Label>
            <Textarea
              value={form.site_address || ""}
              onChange={(e) => setForm({ ...form, site_address: e.target.value })}
              rows={4}
              placeholder={"Unit 17\nHunters Lane\nRugby\nWarwickshire"}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">One line per address line.</p>
          </div>
          <div>
            <Label className="text-xs">Postcode</Label>
            <Input value={form.site_postcode || ""} onChange={(e) => setForm({ ...form, site_postcode: e.target.value })} placeholder="e.g. CV21 1EA" />
          </div>
        </div>
      </div>

      {/* Job details */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job Details</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Job Type *</Label>
            <Select value={form.job_type} onValueChange={(v) => setForm({ ...form, job_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {jobTypes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
                {form.job_type && !jobTypes.some((t) => t.key === form.job_type) && (
                  <SelectItem value={form.job_type}>
                    {JOB_TYPE_LABELS[form.job_type] ?? form.job_type}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Container Type</Label>
            <Select value={form.container_type || ""} onValueChange={(v) => setForm({ ...form, container_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent className="max-h-64">
                {containerTypes.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                {form.container_type && !containerTypes.includes(form.container_type) && (
                  <SelectItem value={form.container_type}>{form.container_type}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Container Size</Label>
            <Input value={form.container_size || ""} onChange={(e) => setForm({ ...form, container_size: e.target.value })} placeholder="e.g. 8yd, 20yd" />
          </div>
          <div>
            <Label className="text-xs">Waste Type</Label>
            <Input value={form.waste_type || ""} onChange={(e) => setForm({ ...form, waste_type: e.target.value })} placeholder="e.g. Mixed Waste" />
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.scheduled_date || ""} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">PO Number</Label>
            <Input value={form.po_number || ""} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Assign Driver</Label>
            <Select
              value={form.assigned_driver_id || "unassigned"}
              onValueChange={(v) => setForm({ ...form, assigned_driver_id: v === "unassigned" ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {drivers.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.driver_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
      </div>

      {/* Pricing (Pricing CMS: tier × zone) */}
      <JobPricingPicker form={form} setForm={setForm} />

      {/* Costs */}

      <div className="rounded-lg border border-border p-3 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Costs</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Haulage (£)</Label>
            <Input type="number" step="0.01" value={form.haulage_cost ?? ""} onChange={(e) => setForm({ ...form, haulage_cost: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Charge per Tonne (£)</Label>
            <Input type="number" step="0.01" value={form.charge_per_tonne ?? ""} onChange={(e) => setForm({ ...form, charge_per_tonne: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Weight Included (t)</Label>
            <Input type="number" step="0.01" value={form.weight_included_t ?? ""} onChange={(e) => setForm({ ...form, weight_included_t: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Min Weight Charge (£)</Label>
            <Input type="number" step="0.01" value={form.min_weight_charge ?? ""} onChange={(e) => setForm({ ...form, min_weight_charge: e.target.value })} />
          </div>
        </div>

        {/* Added items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Added Items</Label>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setItemsOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">No items added.</p>
          ) : (
            <div className="space-y-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1.5">
                  <span className="flex-1 truncate">{it.name}</span>
                  <Input
                    type="number"
                    className="h-7 w-16 text-xs"
                    value={it.qty}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...it, qty: parseFloat(e.target.value) || 0 };
                      setItems(next);
                    }}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    className="h-7 w-24 text-xs"
                    value={it.charge}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...it, charge: parseFloat(e.target.value) || 0 };
                      setItems(next);
                    }}
                  />
                  <span className="w-20 text-right font-medium">{money(num(it.charge) * (num(it.qty) || 1))}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contamination */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label className="text-xs flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Contamination Charge (£)
            </Label>
            <Input type="number" step="0.01" value={form.contamination_charge ?? ""} onChange={(e) => setForm({ ...form, contamination_charge: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Linked Contamination Ref</Label>
            <Input
              value={form.contamination_query_id ?? ""}
              onChange={(e) => setForm({ ...form, contamination_query_id: e.target.value })}
              placeholder="Contamination query ID"
            />
          </div>
          <Link to="/contaminations" target="_blank">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full">
              <ExternalLink className="h-3.5 w-3.5" /> Open Contaminations
            </Button>
          </Link>
        </div>

        {/* Totals */}
        <div className="rounded-md bg-muted/50 p-3 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Tonnage charge</span><span>{money(totals.tonnage)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span>{money(totals.items)}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">VAT rate</span>
            <Input
              type="number"
              className="h-7 w-20 text-xs"
              value={form.vat_rate ?? 20}
              onChange={(e) => setForm({ ...form, vat_rate: e.target.value })}
            />
          </div>
          <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border">
            <span>Total Net</span><span>{money(totals.net)}</span>
          </div>
          <div className="flex justify-between font-semibold text-sm">
            <span>Total inc VAT</span><span>{money(totals.gross)}</span>
          </div>
        </div>
      </div>

      {/* Previous jobs dialog */}
      <Dialog open={prevOpen} onOpenChange={setPrevOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Previous jobs {customer ? `for ${customer}` : ""}
              {form.site_name ? ` — ${form.site_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {prevLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : prevJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {form.site_name
                ? `No previous jobs found at ${form.site_name}.`
                : "No previous jobs found. Enter a customer first."}
            </p>
          ) : (
            <div className="space-y-1">
              {prevJobs.map((j, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyPrevious(j)}
                  className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-accent text-xs flex items-center gap-3"
                >
                  <Badge variant="outline" className="shrink-0">{j._source === "routeone" ? "RouteOne" : "Skiptrak"}</Badge>
                  <span className="font-medium shrink-0">{j.job_number}</span>
                  <span className="text-muted-foreground shrink-0">{j.scheduled_date || j.job_date}</span>
                  <span className="truncate flex-1">{j.site_name || j.site}</span>
                  <span className="truncate text-muted-foreground">{j.container_type} {j.container_size} · {j.waste_type || j.waste_description}</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Item picker dialog */}
      <Dialog open={itemsOpen} onOpenChange={setItemsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add cost item</DialogTitle>
          </DialogHeader>
          {catalogue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items configured yet — add them in RouteOne Setup → Cost Items.</p>
          ) : (
            <div className="space-y-1">
              {catalogue.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-accent text-sm flex justify-between"
                  onClick={() => {
                    setItems([...items, { name: c.name, charge: num(c.default_charge), qty: 1 }]);
                    setItemsOpen(false);
                  }}
                >
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{money(num(c.default_charge))}</span>
                </button>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setItems([...items, { name: "Other", charge: 0, qty: 1 }]);
              setItemsOpen(false);
            }}
          >
            Add blank item
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobFormFields;
