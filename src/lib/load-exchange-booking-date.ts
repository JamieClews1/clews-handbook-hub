import { supabase } from "@/integrations/supabase/client";
import { nextExchangeBookingDate } from "./route-exchange-date";

/** Resolve once before opening the form; never overwrite subsequent staff edits. */
export async function loadExchangeBookingDate(form: Record<string, any>): Promise<string | null> {
  const [windows, zones] = await Promise.all([
    supabase.from("route_one_booking_windows").select("zone_label,skip_day,roro_day"),
    supabase.from("postcode_zones").select("zone_name,postcodes"),
  ]);
  if (windows.error) throw windows.error;
  if (zones.error) throw zones.error;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return nextExchangeBookingDate(form, windows.data || [], zones.data || [], today);
}