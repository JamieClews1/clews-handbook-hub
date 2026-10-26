import { useMemo } from "react";
import { useOutgoingSites } from "@/hooks/useOutgoingSites";
import { useVerifiedTippingSites } from "@/hooks/useVerifiedTippingSites";

export interface TippingSiteOption {
  site_name: string;
  loads: number;
  last_date: string | null;
  verified: boolean;
  registration_number?: string | null;
  postcode?: string | null;
}

/**
 * Tipping/outgoing site choices for RouteOne Waste Out and WeighOne.
 * Register-verified sites (Duty of Care) are pinned first, then recent outgoing sites.
 */
export function useTippingSites() {
  const { data: outgoing = [], ...outgoingState } = useOutgoingSites();
  const { data: verified = [] } = useVerifiedTippingSites();

  const sites = useMemo<TippingSiteOption[]>(() => {
    const verifiedNames = new Set(verified.map(v => v.site_name.trim().toLowerCase()));
    const pinned: TippingSiteOption[] = verified.map(v => ({
      site_name: v.site_name,
      loads: 0,
      last_date: null,
      verified: true,
      registration_number: v.registration_number,
      postcode: v.postcode,
    }));
    const rest = outgoing
      .filter(o => !verifiedNames.has(o.site_name.trim().toLowerCase()))
      .map(o => ({ ...o, verified: false }));
    return [...pinned, ...rest];
  }, [outgoing, verified]);

  return { data: sites, ...outgoingState };
}
