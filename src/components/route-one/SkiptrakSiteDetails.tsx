import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";
import { downloadWtnPdf, printWtnPdf } from "@/lib/route-one-wtn";

type SkiptrakJob = {
  job_number?: string | null;
  job_date?: string | null;
  customer?: string | null;
  site?: string | null;
  driver?: string | null;
  vehicle_registration?: string | null;
  container_type?: string | null;
  waste_description?: string | null;
  movement_type?: string | null;
  tipping_location?: string | null;
};

/**
 * Skiptrak jobs are imported and have no RouteOne address record of their own,
 * so we look the site up in Customer Setup (any of the 5 data-hub site mappings,
 * else the data-hub customer mapping) to show the full address / SIC code and
 * to build a waste transfer note.
 */
export function SkiptrakSiteDetails({ job }: { job: SkiptrakJob }) {
  const siteName = (job.site ?? "").trim();
  const customerName = (job.customer ?? "").trim();

  const { data: site, isLoading } = useQuery({
    queryKey: ["skiptrak-site-details", siteName, customerName],
    enabled: !!(siteName || customerName),
    queryFn: async () => {
      const cols =
        "site_name, address_1, address_2, address_3, address_4, address_5, area, postcode, sic_code, site_contact_name, site_contact_phone";
      if (siteName) {
        const { data } = await supabase
          .from("customer_sites")
          .select(cols)
          .or(
            ["data_hub_site", "data_hub_site_2", "data_hub_site_3", "data_hub_site_4", "data_hub_site_5"]
              .map((c) => `${c}.eq.${siteName.replace(/[,()]/g, " ")}`)
              .join(","),
          )
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      if (customerName) {
        const { data } = await supabase
          .from("customer_sites")
          .select(cols)
          .eq("data_hub_customer", customerName)
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      return null;
    },
  });

  const addressLines = [
    site?.site_name,
    site?.address_1,
    site?.address_2,
    site?.address_3,
    site?.address_4,
    site?.address_5,
    site?.area,
    site?.postcode,
  ].filter(Boolean) as string[];

  const wtnJob = {
    job_number: job.job_number,
    scheduled_date: job.job_date,
    customer_name: job.customer,
    site_name: site?.site_name ?? job.site,
    site_address: site?.address_1 ?? null,
    site_address_2: [site?.address_2, site?.address_3].filter(Boolean).join(", ") || null,
    site_area: site?.area ?? null,
    site_postcode: site?.postcode ?? null,
    sic_code: site?.sic_code ?? null,
    site_contact_name: site?.site_contact_name ?? null,
    site_contact_phone: site?.site_contact_phone ?? null,
    job_type: job.movement_type,
    container_type: job.container_type,
    waste_type: job.waste_description,
    disposal_site: job.tipping_location,
    vehicle_reg: job.vehicle_registration,
    driver_name: job.driver,
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Full Address</p>
        <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-line">
          {isLoading ? "Loading…" : addressLines.length ? addressLines.join("\n") : "No site address on file"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground">SIC Code</p>
          <p>{site?.sic_code || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Site Contact</p>
          <p>
            {site?.site_contact_name || "—"}
            {site?.site_contact_phone ? ` · ${site.site_contact_phone}` : ""}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => printWtnPdf(wtnJob)}>
          <Printer className="h-3 w-3 mr-1.5" /> Print WTN
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadWtnPdf(wtnJob)}>
          <FileDown className="h-3 w-3 mr-1.5" /> Download WTN
        </Button>
      </div>
    </div>
  );
}
