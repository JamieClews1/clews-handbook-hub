import { useMemo } from "react";
import { useOutgoingSites } from "@/hooks/useOutgoingSites";
import { useVerifiedTippingSites } from "@/hooks/useVerifiedTippingSites";
import { tippingEligible, unlistedOutgoing } from "@/lib/tipping-site-classification";

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
    const pinned: TippingSiteOption[] = tippingEligible(verified).map(v => ({
      site_name: v.site_name,
      loads: 0,
      last_date: null,
      verified: true,
      registration_number: v.registration_number,
      postcode: v.postcode,
    }));
    const rest = unlistedOutgoing(outgoing, verified)
      .map(o => ({ ...o, verified: false }));
    return [...pinned, ...rest];
  }, [outgoing, verified]);

  return { data: sites, ...outgoingState };
}
