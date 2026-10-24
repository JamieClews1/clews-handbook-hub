import { useQuery } from "@tanstack/react-query";
import { Fuel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePostcodeZoneLookup } from "@/hooks/usePostcodeZoneLookup";
import { bookingFuelRate, isBookingFuelItem, setBookingFuel } from "@/lib/route-booking-pricing";
import { formatGBP, type FuelSurchargeRate } from "@/lib/fuel-surcharge";

export function BookingFuelSurcharge({ form, setForm }: { form: any; setForm: (form: any) => void }) {
  const { zoneFor } = usePostcodeZoneLookup();
  const { data: rates = [], isPending, isError } = useQuery({ queryKey: ["booking-fuel-rates"], queryFn: async () => {
    const { data, error } = await supabase.from("fuel_surcharge_rates").select("*").eq("active", true);
    if (error) throw error;
    return data as FuelSurchargeRate[];
  } });
  const items = Array.isArray(form.cost_items) ? form.cost_items : [];
  const applied = items.find(isBookingFuelItem);
  const zone = zoneFor(form.site_postcode);
  const rate = bookingFuelRate(form, zone, rates);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
    <div className="space-y-1"><Label htmlFor="booking-fuel" className="flex items-center gap-2 text-sm font-semibold"><Fuel className="h-4 w-4 text-primary" />Apply Fuel Surcharge</Label>
      <p className="text-xs text-muted-foreground">{applied ? `${formatGBP(Number(applied.charge) * Number(applied.qty))} + VAT added` : isPending ? "Loading current rates…" : isError ? "Rates unavailable — try again before applying" : rate ? `${formatGBP(Number(rate.surcharge_amount))} + VAT · ${rate.vehicle_category} · ${rate.customer_match ? "customer rate" : zone}` : "Select a configured postcode zone, container and date to find a rate"}</p>
    </div>
    <Switch id="booking-fuel" checked={!!applied} disabled={!applied && !rate} onCheckedChange={checked => setForm({ ...form, cost_items: setBookingFuel(items, checked && rate ? Number(rate.surcharge_amount) : null) })} />
  </div>;
}