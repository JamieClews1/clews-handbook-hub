import { supabase } from "@/integrations/supabase/client";

/**
 * Midweigh weighbridge tickets are shared/standalone jobs (no site) that must
 * only feed rebate reports for customers explicitly set up for it
 * (e.g. Biffa, Conectiv, Transol). Everyone else must ignore them, otherwise
 * unrelated weighbridge tickets leak into their rebate reports.
 */

const cacheById = new Map<string, boolean>();
const cacheByName = new Map<string, boolean>();

export async function isMidweighRebateCustomer(opts: {
  customerId?: string | null;
  dataHubCustomer?: string | null;
}): Promise<boolean> {
  const { customerId, dataHubCustomer } = opts;

  if (customerId) {
    if (cacheById.has(customerId)) return cacheById.get(customerId)!;
    const { data } = await supabase
      .from("customers")
      .select("midweigh_rebates_enabled")
      .eq("id", customerId)
      .maybeSingle();
    const enabled = Boolean((data as any)?.midweigh_rebates_enabled);
    cacheById.set(customerId, enabled);
    if (enabled) return true;
  }

  const name = (dataHubCustomer ?? "").trim();
  if (!name) return false;
  const key = name.toLowerCase();
  if (cacheByName.has(key)) return cacheByName.get(key)!;

  const { data } = await supabase
    .from("customers")
    .select("midweigh_rebates_enabled")
    .or(`customer_name.ilike.${name},data_hub_customer.ilike.${name}`)
    .limit(20);

  const enabled = (data ?? []).some((c: any) => c.midweigh_rebates_enabled);
  cacheByName.set(key, enabled);
  return enabled;
}

export function clearMidweighRebateCache() {
  cacheById.clear();
  cacheByName.clear();
}
