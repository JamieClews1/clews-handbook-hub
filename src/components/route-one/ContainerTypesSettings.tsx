import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CONTAINER_GROUPS } from "@/lib/container-taxonomy";
import { pricingContainerOptions, type PricingSize } from "@/lib/booking-container-options";
import { CONTAINER_STANDARDS, CONTAINER_STANDARD_VERSION, containerStandardForCode } from "@/lib/container-standard";
import { WasteRefChip } from "@/components/waste/WasteRefChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";

const OTHER = CONTAINER_STANDARDS.filter(s => s.status === "other");
const HISTORY = CONTAINER_STANDARDS.filter(s => s.status === "history");

/** Read-only view of the agreed container standard: what Route One offers, and what stays on old records only. */
export function ContainerTypesSettings() {
  const [sizes, setSizes] = useState<PricingSize[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("pricing_skip_sizes").select("size_code,display_name,is_active").order("display_order");
    setError(Boolean(error));
    setSizes(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold">Containers</h3>
        <p className="text-xs text-muted-foreground">{CONTAINER_STANDARD_VERSION}. Old jobs keep their recorded wording; screens show the agreed name and code.</p>
      </div>
      <Button asChild variant="outline" size="sm"><Link to="/admin/pricing"><Settings className="h-4 w-4 mr-2" />Pricing containers</Link></Button>
    </div>
    {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : error ? <div role="alert">Could not load containers.<Button variant="link" onClick={load}>Try again</Button></div> :
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{CONTAINER_GROUPS.map(group => <section key={group.value} className="space-y-2">
        <h4 className="font-semibold text-sm border-b border-border pb-2">{group.label}</h4>
        <ul className="space-y-2 text-sm">{pricingContainerOptions(sizes, group.value).map(size => <li key={size.size_code} className="flex flex-wrap items-center gap-2">
          <WasteRefChip refCode={containerStandardForCode(size.size_code)?.ref} />
          <span>{containerStandardForCode(size.size_code)?.name ?? size.display_name}</span>
          {size.bespoke && <Badge variant="outline" className="font-normal">Bespoke · no price line</Badge>}
        </li>)}</ul>
      </section>)}</div>}
    <section className="space-y-2">
      <h4 className="font-semibold text-sm border-b border-border pb-2">Recorded on tickets, not offered in Route One</h4>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">{OTHER.map(s => <li key={s.ref} className="flex flex-wrap items-center gap-2"><WasteRefChip refCode={s.ref} /><span>{s.name}</span>{s.note && <span className="text-xs text-muted-foreground">{s.note}</span>}</li>)}</ul>
    </section>
    <section className="space-y-2">
      <h4 className="font-semibold text-sm border-b border-border pb-2">Old records only</h4>
      <ul className="space-y-2 text-sm">{HISTORY.map(s => <li key={s.ref} className="flex flex-wrap items-center gap-2"><WasteRefChip refCode={s.ref} /><span>{s.name}</span><span className="text-xs text-muted-foreground">{s.note}</span></li>)}</ul>
    </section>
  </div>;
}
