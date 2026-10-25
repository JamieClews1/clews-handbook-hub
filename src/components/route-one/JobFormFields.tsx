import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAllRows } from "@/lib/fetch-all";
import { importedSiteDetails, applyBookingSite, type BookingSite } from "@/lib/route-booking-sites";
import { History, Plus, Trash2, AlertTriangle, ExternalLink, MapPin, Check, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { usePostcodeZoneLookup } from "@/hooks/usePostcodeZoneLookup";
import { useJobTypes } from "./jobTypes";
import { boardJobType } from "@/lib/route-board-presentation";

import { JobPricingPicker } from "./JobPricingPicker";
import { EwcCodePicker, SicCodePicker } from "@/components/codes/CodePicker";
import { EstablishedSitePicker } from "./EstablishedSitePicker";
import { BookingFuelSurcharge } from "./BookingFuelSurcharge";
import { importedBookingPrices } from "@/lib/route-booking-pricing";
import { loadExchangeBookingDate } from "@/lib/load-exchange-booking-date";
import { WasteOutSkipPanel } from "./WasteOutSkipPanel";
import { WasteClassificationFields, asClassification } from "@/components/dwt/WasteClassificationFields";

/** Legacy static labels — configured job types come from route_one_job_types. */
export const JOB_TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  exchange: "Exchange",
  collection: "Collection",
  waste_truck: "Waste Truck",
  wasted_journey: "Wasted Journey",
  waste_out_skip: "Waste Out Skip",
};

export type CostItem = { name: string; charge: number; qty: number };

type KnownSite = BookingSite;

const normaliseCustomer = (value: string) =>
  value
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const rawText = (raw: Record<string, unknown> | null | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

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

/** Normalise a postcode to the "NN6 7XY" spaced form for matching. */
const postcodeVariants = (input: string) => {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 3) return [compact];
  const spaced = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  return compact === spaced ? [compact] : [compact, spaced];
};

type PostcodeMatch = {
  customer: string;
  site: string;
  address: string;
  postcode: string;
  container_type?: string;
  waste_type?: string;
  last_date?: string;
  source: "routeone" | "datahub";
};

export function JobFormFields({
  form,
  setForm,
  drivers,
  allowPrevious = true,
  exchangeMode = false,
}: {
  form: any;
  setForm: (f: any) => void;
  drivers: any[];
  allowPrevious?: boolean;
  exchangeMode?: boolean;
}) {
  const [bookingTab, setBookingTab] = useState("booking");
  const [siteLoadError, setSiteLoadError] = useState("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteRetry, setSiteRetry] = useState(0);
  const [setupSites, setSetupSites] = useState<KnownSite[]>([]);
  const [postcodeQuery, setPostcodeQuery] = useState("");
  const [postcodeMatches, setPostcodeMatches] = useState<PostcodeMatch[]>([]);
  const [postcodeSearching, setPostcodeSearching] = useState(false);
  const [postcodeSearched, setPostcodeSearched] = useState(false);
  const [manualSite, setManualSite] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevJobs, setPrevJobs] = useState<any[]>([]);
  const [prevLoading, setPrevLoading] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [containerTypes, setContainerTypes] = useState<string[]>([]);
  const { types: jobTypes } = useJobTypes();
  const { zoneFor } = usePostcodeZoneLookup();
  const queryZone = zoneFor(postcodeQuery);
  const siteZone = zoneFor(form.site_postcode);

  const customer = form.customer_name || "";


  // Sites for the chosen customer — from customer setup AND the Data Hub history
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!customer || customer.length < 2) { setSetupSites([]); return; }
      setSiteLoading(true); setSiteLoadError(""); setSetupSites([]);
      const customerSearch = normaliseCustomer(customer);
      const candidates = await fetchAllRows<any>("customers", "id,customer_name,data_hub_customer", "id", q => q.eq("is_active", true));
      const wanted = customerSearch.toLowerCase();
      const custs = candidates.filter(c => [c.customer_name, c.data_hub_customer].some(n => n && normaliseCustomer(n).toLowerCase() === wanted));
      const setup = custs.length ? await fetchAllRows<any>("customer_sites", "*", "id", q => q.in("customer_id", custs.map(c => c.id)).eq("is_archived", false)) : [];
      const aliases = [...new Set([customer.trim(), customerSearch, ...custs.flatMap(c => [c.customer_name, c.data_hub_customer]), ...setup.map(r => r.data_hub_customer)].filter(Boolean))];
      const hub = await fetchAllRows<any>("data_hub_jobs", "customer,site,postcode,raw,job_date,id", "id", q => q.eq("source", "skiptrak").in("customer", aliases).not("site", "is", null));
      if (cancelled) return;
      const known = new Map<string, KnownSite>();
      for (const row of setup) {
        const address = [row.address_1, row.address_2, row.address_3, row.address_4, row.address_5].filter(Boolean).join("\n");
        known.set(row.site_name.toLowerCase(), { name: row.site_name, address, postcode: row.postcode || "", area: row.area || "", contact: row.site_contact_name || "", phone: row.site_contact_phone || "", sic: row.sic_code || "" });
      }
      for (const row of hub.sort((a,b) => String(b.job_date).localeCompare(String(a.job_date)))) {
        const name = String(row.site || "").trim(); if (!name) continue;
        const mapped = setup.find(s => [s.site_name,s.data_hub_site,s.data_hub_site_2,s.data_hub_site_3,s.data_hub_site_4,s.data_hub_site_5].some(n => n?.trim().toLowerCase() === name.toLowerCase()));
        const displayName = mapped?.site_name || name;
        const existing = known.get(displayName.toLowerCase());
        const details = importedSiteDetails(row.raw, row.postcode);
        known.set(displayName.toLowerCase(), { ...details, ...existing, name: displayName, address: existing?.address || details.address, postcode: existing?.postcode || details.postcode, area: existing?.area || details.area, contact: existing?.contact || details.contact, phone: existing?.phone || details.phone, sic: existing?.sic || details.sic });
      }

      setSetupSites([...known.values()].sort((a, b) => a.name.localeCompare(b.name)));
    };
    const timer = setTimeout(() => {
      load().catch(() => { if (!cancelled) { setSetupSites([]); setSiteLoadError("Unable to load established sites. Try again before selecting a site."); } }).finally(() => { if (!cancelled) setSiteLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [customer, siteRetry]);


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
      supabase
        .from("customers")
        .select("customer_name, customer_code")
        .or(`customer_name.ilike.%${query}%,customer_code.ilike.%${query}%`)
        .limit(20),
      supabase.from("data_hub_jobs").select("customer").ilike("customer", `%${query}%`).not("customer", "is", null).limit(100),
    ]);

    const displayByNormalised = new Map<string, string>();
    for (const r of (setup ?? []) as any[]) {
      const display = r.customer_code ? `${r.customer_name} (${r.customer_code})` : r.customer_name;
      displayByNormalised.set(normaliseCustomer(display).toLowerCase(), display);
    }
    for (const r of (hub ?? []) as any[]) {
      const name = r.customer;
      if (!name) continue;
      const key = normaliseCustomer(name).toLowerCase();
      if (!displayByNormalised.has(key)) displayByNormalised.set(key, name);
    }
    return [...displayByNormalised.values()].slice(0, 10);
  };

  /** Postcode-first lookup: find known sites/jobs at this postcode. */
  const searchPostcode = async () => {
    const input = postcodeQuery.trim();
    if (input.length < 3) return;
    setPostcodeSearching(true);
    setPostcodeSearched(false);
    const variants = postcodeVariants(input);
    const orFilter = variants.map((v) => `postcode.ilike.%${v}%`).join(",");
    const roOrFilter = variants.map((v) => `site_postcode.ilike.%${v}%`).join(",");
    const query = input.replace(/[,().%]/g, " ").trim();

    const [{ data: ro }, { data: hub }] = await Promise.all([
      supabase
        .from("route_one_jobs")
        .select("customer_name, site_name, site_address, site_postcode, container_type, container_size, waste_type, scheduled_date")
        .or(`${roOrFilter},customer_name.ilike.%${query}%,site_name.ilike.%${query}%`)
        .order("scheduled_date", { ascending: false })
        .limit(50),
      supabase
        .from("data_hub_jobs")
        .select("customer, site, postcode, container_type, waste_description, job_date, raw")
        .or(`${orFilter},customer.ilike.%${query}%,site.ilike.%${query}%`)
        .limit(200),
    ]);

    const byKey = new Map<string, PostcodeMatch>();
    for (const j of (ro ?? []) as any[]) {
      const key = `${(j.customer_name || "").toLowerCase()}|${(j.site_name || "").toLowerCase()}|${(j.site_postcode || "").toLowerCase()}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        customer: j.customer_name || "",
        site: j.site_name || "",
        address: j.site_address || "",
        postcode: j.site_postcode || "",
        container_type: j.container_type || "",
        waste_type: j.waste_type || "",
        last_date: j.scheduled_date || "",
        source: "routeone",
      });
    }
    for (const j of (hub ?? []) as any[]) {
      const key = `${(j.customer || "").toLowerCase()}|${(j.site || "").toLowerCase()}|${(j.postcode || "").toLowerCase()}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        customer: j.customer || "",
        site: j.site || "",
        address: importedSiteDetails(j.raw, j.postcode).address,
        postcode: j.postcode || "",
        container_type: j.container_type || "",
        waste_type: j.waste_description || "",
        last_date: j.job_date || "",
        source: "datahub",
      });
    }
    setPostcodeMatches([...byKey.values()].slice(0, 15));
    setPostcodeSearching(false);
    setPostcodeSearched(true);
  };

  /** Fill the form from a postcode match and jump straight to previous jobs. */
  const applyPostcodeMatch = (m: PostcodeMatch) => {
    setForm({
      ...form,
      customer_name: m.customer || form.customer_name,
      site_name: m.site || form.site_name,
      site_address: m.address,
      site_address_2: "",
      site_contact_name: "", site_contact_phone: "", site_area: "",
      site_postcode: m.postcode || postcodeQuery.trim(),
    });
    setPostcodeMatches([]);
    setPostcodeSearched(false);
  };

  /** Start a brand new site (and delivery) from scratch at the searched postcode. */
  const startNewSite = () => {
    setForm({
      ...form,
      job_type: form.job_type || "delivery",
      site_name: "",
      site_address: "",
      site_postcode: postcodeQuery.trim() || form.site_postcode || "",
      site_area: "",
      site_contact_name: "",
      site_contact_phone: "",
    });
    setManualSite(true);
    setPostcodeMatches([]);
    setPostcodeSearched(false);
  };


  /** Previous jobs for this customer/site — used to set up an exchange. */
  const loadPreviousJobs = async () => {
    setPrevLoading(true);
    setPrevOpen(true);
    // NOTE: no server-side ORDER BY here — sorting 100k+ Data Hub rows alongside
    // an ilike filter times out. We fetch then sort client-side.
    const site = (form.site_name || "").trim();
    const customerSearch = normaliseCustomer(customer);
    let q = supabase
      .from("data_hub_jobs")
      .select("job_number, job_date, customer, site, movement_type, container_type, waste_description, weight_t, raw")
      .limit(200);
    // The selected site is the strongest key. Customer names often carry source
    // suffixes such as “(Weighbridge)”, so normalise those before matching.
    if (site) q = q.ilike("site", site);
    else if (customerSearch) q = q.ilike("customer", `%${customerSearch}%`);
    const { data: hub, error: hubErr } = await q;
    if (hubErr) console.error("Previous jobs (Data Hub) lookup failed", hubErr);

    let rq = supabase
      .from("route_one_jobs")
      .select("id, job_number, scheduled_date, customer_name, site_name, site_address, site_postcode, job_type, container_type, container_size, waste_type, haulage_cost, charge_per_tonne, min_weight_charge, weight_included_t, cost_items, vat_rate, po_number")
      .order("scheduled_date", { ascending: false })
      .limit(25);
    if (customerSearch) rq = rq.ilike("customer_name", `%${customerSearch}%`);
    if (site) rq = rq.ilike("site_name", site);
    const { data: own, error: ownErr } = await rq;
    if (ownErr) console.error("Previous jobs (RouteOne) lookup failed", ownErr);

    const matchingHub = (hub ?? []).filter((job: any) => {
      if (!customerSearch) return true;
      const jobCustomer = normaliseCustomer(job.customer || "").toLowerCase();
      const wanted = customerSearch.toLowerCase();
      return jobCustomer.includes(wanted) || wanted.includes(jobCustomer);
    });
    const rows = [
      ...(own ?? []).map((j: any) => ({ ...j, _source: "routeone" })),
      ...matchingHub.map((j: any) => ({ ...j, _source: "skiptrak" })),
    ].sort((a, b) =>
      String(b.scheduled_date || b.job_date || "").localeCompare(String(a.scheduled_date || a.job_date || ""))
    );
    setPrevJobs(rows.slice(0, 40));
    setPrevLoading(false);
  };


  /** Prefill the form from a previous job, defaulting to an exchange. */
  const applyPrevious = async (j: any) => {
    let bookingDate = form.scheduled_date;
    try { bookingDate = await loadExchangeBookingDate({ container_type: j.container_type, container_size: j.container_size, site_postcode: j.site_postcode || j.postcode || rawText(j.raw, ["Postcode", "Location Postc"]) || form.site_postcode }) || bookingDate; }
    catch { setSiteLoadError("Booking dates unavailable. Check the exchange date before saving."); }
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
        scheduled_date: bookingDate,
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
      const previousAddress = importedSiteDetails(j.raw).address;
      const previousPostcode = rawText(j.raw, ["Location Postc", "Location Postcode", "Postcode"]);
      setForm({
        ...form,
        customer_name: j.customer || form.customer_name,
        site_name: j.site || form.site_name,
        site_address: previousAddress || form.site_address,
        site_postcode: previousPostcode || form.site_postcode,
        job_type: "exchange",
        container_type: j.container_type || "",
        waste_type: j.waste_description || "",
        scheduled_date: bookingDate,
        ...importedBookingPrices(j.raw || {}),
        notes: `${form.notes ? form.notes + "\n" : ""}Exchange of container from job ${j.job_number || ""}`.trim(),
      });
    }
    setPrevOpen(false);
  };

  const items: CostItem[] = Array.isArray(form.cost_items) ? form.cost_items : [];
  const setItems = (next: CostItem[]) => setForm({ ...form, cost_items: next });

  const totals = useMemo(() => computeJobTotals(form), [form]);

  return (
    <div className="routeone-booking-flow">
      <Tabs value={bookingTab} onValueChange={setBookingTab}>
        <TabsList className="sticky top-0 z-10 w-full justify-start bg-background border border-border">
          <TabsTrigger value="booking">{exchangeMode ? "Exchange details" : "Booking"}</TabsTrigger>
          <TabsTrigger value="site">Site details</TabsTrigger>
          <TabsTrigger value="costs">Business costs</TabsTrigger>
        </TabsList>
      <TabsContent value="booking" className="grid gap-0">
      {exchangeMode && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{form.site_name || "Site not selected"}</span>{siteZone && <Badge variant="secondary">{siteZone}</Badge>}</div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{[form.site_address, form.site_address_2, form.site_postcode].filter(Boolean).join(" · ") || "Site address not recorded"}</p>
            {(form.site_contact_name || form.site_contact_phone) && <p className="text-sm">{[form.site_contact_name, form.site_contact_phone].filter(Boolean).join(" · ")}</p>}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setBookingTab("site")}>Change customer / site</Button>
        </div>
      )}
      {/* Customer & site */}
      {!exchangeMode && <section className="booking-section space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="booking-step"><span>1</span>Customer and site</h4>
          {allowPrevious && <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={loadPreviousJobs}>
            <History className="h-3.5 w-3.5" />
            Use previous job / exchange
          </Button>}
        </div>

        {/* Postcode-first lookup — start the call here */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold">Customer, site or postcode</Label>
            {queryZone && (
              <Badge className="gap-1 text-[10px]">
                <MapPin className="h-3 w-3" /> {queryZone}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={postcodeQuery}
              onChange={(e) => setPostcodeQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPostcode(); } }}
              placeholder="Search customer, site or postcode…" aria-label="Search customer, site or postcode"
              className="border-primary"
              autoFocus
            />
            <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={searchPostcode} disabled={postcodeSearching}>
              <Search className="h-4 w-4" />{postcodeSearching ? "Searching..." : "Search"}
            </Button>
          </div>
          {postcodeQuery.trim().length >= 3 && !queryZone && (
            <p className="text-[11px] text-muted-foreground">No zone configured for this postcode.</p>
          )}
          {postcodeSearched && postcodeMatches.length === 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">No matching sites found.</p>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={startNewSite}>
                <Plus className="h-3.5 w-3.5" /> New site &amp; delivery
              </Button>
            </div>
          )}
          {postcodeMatches.length > 0 && (
            <div className="rounded-md border border-border bg-background divide-y divide-border max-h-56 overflow-y-auto">
              {postcodeMatches.map((m, i) => (
                <Button variant="ghost"
                  key={i}
                  type="button"
                  className="h-auto w-full text-left px-3 py-2 text-xs flex-col items-stretch rounded-none"
                  onClick={() => applyPostcodeMatch(m)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{m.customer} · {m.site || m.address || m.postcode}</span>
                    <span className="font-mono text-muted-foreground shrink-0">{m.postcode}</span>
                  </div>
                  <div className="text-muted-foreground truncate">
                    {m.customer}
                    {m.container_type ? ` · ${m.container_type}` : ""}
                    {m.waste_type ? ` · ${m.waste_type}` : ""}
                    {m.last_date ? ` · last job ${new Date(m.last_date).toLocaleDateString("en-GB")}` : ""}
                  </div>
                </Button>
              ))}
            </div>
          )}
          <Button type="button" size="sm" variant="link" className="px-0" onClick={() => { startNewSite(); setBookingTab("site"); }}><Plus className="h-3.5 w-3.5 mr-1" />New customer or site</Button>
        </div>


        <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Customer and established sites</summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Customer *</Label>
            <AutocompleteInput
              value={form.customer_name || ""}
              onChange={(val) => { setManualSite(false); setForm({ ...applyBookingSite(form, { name: "", address: "", postcode: "" }), customer_name: normaliseCustomer(val) }); }}
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
                placeholder={siteLoading ? "Loading established sites…" : setupSites.length === 0 ? "No established sites — type site name" : "Site name"}
              />
            ) : (
              <EstablishedSitePicker sites={setupSites} value={form.site_name || ""} onSelect={site => setForm(applyBookingSite(form, site))} onNew={startNewSite} />
            )}

          </div>
        </div>
        </details>
        {siteLoadError && <p role="alert" className="text-sm text-destructive">{siteLoadError}<Button type="button" variant="link" onClick={() => setSiteRetry(n => n + 1)}>Try again</Button></p>}
        <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm whitespace-pre-line">{[form.site_address, form.site_address_2, form.site_postcode].filter(Boolean).join("\n") || "Site address not recorded"}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setBookingTab("site")}>Full site details</Button>
        </div>
        </section>}
      <section className="booking-section space-y-4">
        <h4 className="booking-step"><span>2</span>{exchangeMode ? "Exchange job" : "Job"}</h4>
        <div className="space-y-2"><Label className="text-xs">Job type *</Label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {jobTypes.map(t => { const presentation = boardJobType(t.key, t.label); return <Button key={t.key} type="button" variant="outline" data-job-palette={presentation.palette} aria-pressed={form.job_type === t.key} className="booking-type-choice" onClick={() => setForm({ ...form, job_type: t.key })}>{form.job_type === t.key && <Check className="h-3.5 w-3.5 shrink-0" />}{presentation.label}</Button>; })}
        </div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label className="text-xs">Container</Label><div className="flex flex-wrap gap-1.5">{containerTypes.map(c => <Button type="button" key={c} size="sm" variant={form.container_type === c ? "secondary" : "outline"} aria-pressed={form.container_type === c} className="h-8 px-3 text-xs" onClick={() => setForm({ ...form, container_type: c })}>{c}</Button>)}</div><Input aria-label="Container type" value={form.container_type || ""} onChange={e => setForm({ ...form, container_type: e.target.value })} placeholder="Other container" /></div>
          <div className="space-y-2"><Label className="text-xs">Size</Label><div className="flex flex-wrap gap-1.5">{(/ro\s*ro/i.test(form.container_type || "") ? ["20yd", "35yd", "40yd"] : ["4yd", "6yd", "8yd", "12yd", "16yd"]).map(size => <Button type="button" key={size} size="sm" variant={form.container_size === size ? "secondary" : "outline"} aria-pressed={form.container_size === size} className="h-8 px-3 text-xs" onClick={() => setForm({ ...form, container_size: size })}>{size}</Button>)}</div><Input aria-label="Container size" value={form.container_size || ""} onChange={e => setForm({ ...form, container_size: e.target.value })} placeholder="Other size" /></div>
        </div>
      </section>
      <section className="booking-section space-y-3">
        <h4 className="booking-step"><span>3</span>Waste</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label className="text-xs">Waste type</Label><Input aria-label="Waste type" value={form.waste_type || ""} onChange={e => setForm({ ...form, waste_type: e.target.value })} placeholder="Mixed waste" /></div><div><Label className="text-xs">EWC code</Label><EwcCodePicker value={form.ewc_code || ""} onChange={v => setForm({ ...form, ewc_code: v })} /></div></div>
      </section>
      <section className="booking-section space-y-3">
        <h4 className="booking-step"><span>4</span>{exchangeMode ? "Exchange schedule" : "Schedule"}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label className="text-xs" htmlFor="booking-date">{exchangeMode ? "Exchange date" : "Date"}</Label><Input id="booking-date" autoFocus={exchangeMode} type="date" value={form.scheduled_date || ""} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} /></div>
          <div><Label className="text-xs">Driver</Label><Select value={form.assigned_driver_id || "unassigned"} onValueChange={v => setForm({ ...form, assigned_driver_id: v === "unassigned" ? "" : v })}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.driver_name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">PO number (optional)</Label><Input aria-label="PO number" value={form.po_number || ""} onChange={e => setForm({ ...form, po_number: e.target.value })} /></div>
        </div>
        <div><Label className="text-xs">Notes (optional)</Label><Textarea aria-label="Booking notes" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      </section>

      </TabsContent>
        <TabsContent value="site" className="space-y-3">
        <h4 className="font-semibold">{form.customer_name || "Customer"} — {form.site_name || "Site details"}</h4>
        {exchangeMode && <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="text-xs">Customer *</Label><AutocompleteInput value={form.customer_name || ""} onChange={(val) => { setManualSite(false); setForm({ ...applyBookingSite(form, { name: "", address: "", postcode: "" }), customer_name: normaliseCustomer(val) }); }} placeholder="Start typing customer..." fetchSuggestions={fetchCustomers} /></div>
          <div><div className="flex items-center justify-between"><Label className="text-xs">Site</Label><Button type="button" variant="link" size="sm" onClick={() => setManualSite(m => !m)}>{manualSite ? "Pick from known sites" : "Enter manually"}</Button></div>{manualSite || setupSites.length === 0 ? <Input value={form.site_name || ""} onChange={e => setForm({ ...form, site_name: e.target.value })} placeholder={siteLoading ? "Loading established sites…" : "Site name"} /> : <EstablishedSitePicker sites={setupSites} value={form.site_name || ""} onSelect={site => setForm(applyBookingSite(form, site))} onNew={startNewSite} />}</div>
          {siteLoadError && <p role="alert" className="text-sm text-destructive md:col-span-2">{siteLoadError}<Button type="button" variant="link" onClick={() => setSiteRetry(n => n + 1)}>Try again</Button></p>}
        </div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Site Address</Label>
            <Textarea
              value={form.site_address || ""}
              onChange={(e) => setForm({ ...form, site_address: e.target.value })}
              rows={4}
              placeholder={"Customer site street address\nTown\nCounty"}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">One line per address line.</p>
            <Label className="text-xs">Additional address lines</Label>
            <Textarea value={form.site_address_2 || ""} onChange={e => setForm({ ...form, site_address_2: e.target.value })} rows={2} placeholder="Additional site address details" />
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Postcode</Label>
                {siteZone && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <MapPin className="h-3 w-3" /> {siteZone}
                  </Badge>
                )}
              </div>
              <Input value={form.site_postcode || ""} onChange={(e) => setForm({ ...form, site_postcode: e.target.value })} placeholder="e.g. CV21 1EA" />
              {!siteZone && (form.site_postcode || "").trim().length >= 3 && (
                <p className="text-[11px] text-muted-foreground mt-1">No zone configured for this postcode.</p>
              )}
            </div>

            <div>
              <Label className="text-xs">Area / County</Label>
              <Input value={form.site_area || ""} onChange={(e) => setForm({ ...form, site_area: e.target.value })} placeholder="e.g. Warwickshire" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">SIC Code</Label>
            <SicCodePicker value={form.sic_code || ""} onChange={(v) => setForm({ ...form, sic_code: v })} />
          </div>
          <div>
            <Label className="text-xs">Site Contact</Label>
            <Input value={form.site_contact_name || ""} onChange={(e) => setForm({ ...form, site_contact_name: e.target.value })} placeholder="Name on site" />
          </div>
          <div>
            <Label className="text-xs">Contact Phone</Label>
            <Input value={form.site_contact_phone || ""} onChange={(e) => setForm({ ...form, site_contact_phone: e.target.value })} placeholder="e.g. 01788 541549" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Account Code</Label>
            <Input value={form.account_code || ""} onChange={(e) => setForm({ ...form, account_code: e.target.value })} placeholder="e.g. ZZWIL004" />
          </div>
          <div>
            <Label className="text-xs">Vehicle Registration</Label>
            <Input value={form.vehicle_reg || ""} onChange={(e) => setForm({ ...form, vehicle_reg: e.target.value.toUpperCase() })} placeholder="e.g. FJ18 FDM" className="font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Invoice Address</Label>
            <Textarea
              value={form.invoice_address || ""}
              onChange={(e) => setForm({ ...form, invoice_address: e.target.value })}
              rows={3}
              placeholder="Billing address for this job"
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Directions / Access notes</Label>
            <Textarea
              value={form.directions || ""}
              onChange={(e) => setForm({ ...form, directions: e.target.value })}
              rows={3}
              placeholder="Gate codes, access restrictions…"
              className="text-xs"
            />
          </div>
        </div>

      </TabsContent>
      <TabsContent value="booking" className="space-y-4">
      {form.job_type === "waste_out_skip" && <WasteOutSkipPanel form={form} setForm={setForm} />}

      <details open={asClassification(form.waste_classification).contains_pops || undefined} className="space-y-3 border-t border-border pt-4">
        <summary className="text-sm font-semibold cursor-pointer">Hazardous, POPs and extra items{items.length ? ` (${items.length})` : ""}</summary>
        <WasteClassificationFields value={asClassification(form.waste_classification)} onChange={(v) => setForm({ ...form, waste_classification: v })} ewcCode={form.ewc_code || ""} />
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

      </details>
      {/* Pricing (Pricing CMS: tier × zone) */}
      <details className="border-t border-border pt-3"><summary className="text-sm font-semibold cursor-pointer">Rate card lookup</summary><div className="pt-3"><JobPricingPicker form={form} setForm={setForm} /></div></details>

      {/* Costs */}

      <section className="space-y-3">
        <h4 className="booking-step"><span>5</span>Customer pricing</h4>
        <BookingFuelSurcharge form={form} setForm={setForm} />
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
      </section>

      </TabsContent>
      <TabsContent value="costs" className="space-y-3">
        <h4 className="font-semibold">Business costs</h4>
        <p className="text-sm text-muted-foreground">Internal cost assessment — to be added later.</p>
      </TabsContent>
      </Tabs>
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
            <DialogTitle>Add chargeable item</DialogTitle>
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
