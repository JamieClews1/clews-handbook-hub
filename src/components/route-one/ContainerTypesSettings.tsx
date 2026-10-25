import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CONTAINER_GROUPS } from "@/lib/container-taxonomy";
import { pricingContainerOptions, type PricingSize } from "@/lib/booking-container-options";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";

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
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-semibold">Containers</h3>
      <Button asChild variant="outline" size="sm"><Link to="/admin/pricing"><Settings className="h-4 w-4 mr-2" />Pricing containers</Link></Button>
    </div>
    {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : error ? <div role="alert">Could not load containers.<Button variant="link" onClick={load}>Try again</Button></div> :
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{CONTAINER_GROUPS.map(group => <section key={group.value} className="space-y-2">
        <h4 className="font-semibold text-sm border-b border-border pb-2">{group.label}</h4>
        <ul className="space-y-2 text-sm">{pricingContainerOptions(sizes, group.value).map(size => <li key={size.size_code}>{size.display_name}</li>)}</ul>
      </section>)}</div>}
  </div>;
}
