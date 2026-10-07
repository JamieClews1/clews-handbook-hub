import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_WTN_TEMPLATE, WTN_COMPANY_DETAILS, renderWtnSheet } from "@/lib/wtn-ticket-template";
import type { BJob } from "./BanksmanWorkflow";

const kg = (v: number | null | undefined) => (v != null && !isNaN(Number(v)) ? Math.round(Math.abs(Number(v))).toLocaleString() : "");

/** Builds a waste transfer ticket for a completed banksman job, using the shared WeighOne WTN design. */
export async function openBanksmanWtn(job: BJob, templateHtml?: string | null, includePrices = false) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;
  const j = job as any;
  let v: Record<string, string> = {};

  if (j.weighbridge_transaction_id) {
    const { data: t } = await supabase.from("weighbridge_transactions").select("*").eq("id", j.weighbridge_transaction_id).maybeSingle();
    if (t) {
      const w: any = t;
      v = {
        ticket_number: w.ticket_number ?? job.job_number, account: w.linked_job_source ?? "",
        customer_order_no: w.linked_job_number ?? "", direction: w.job_type === "waste_out" ? "OUTWARD" : "INWARD",
        driver_name: w.driver_name ?? "", carrier_name: w.carrier_name ?? "", carrier_registration: w.carrier_registration ?? "",
        waste_description: w.waste_description ?? "", ewc_code: w.ewc_code ?? "", physical_form: w.physical_form ?? "",
        means_of_transport: w.means_of_transport ?? "Road",
        gross_weight: kg(w.gross_weight_kg), tare_weight: kg(w.tare_weight_kg), net_weight: kg(w.net_weight_kg),
        net_tonnes: w.net_weight_kg != null ? (w.net_weight_kg / 1000).toFixed(2) : "",
        price_per_tonne: w.price_per_tonne != null ? `£${Number(w.price_per_tonne).toFixed(2)}` : "",
        total_price: w.total_price != null ? `£${Number(w.total_price).toFixed(2)}` : "",
        gross_time: w.first_weigh_at ? format(new Date(w.first_weigh_at), "HH:mm:ss") : "",
        tare_time: w.second_weigh_at ? format(new Date(w.second_weigh_at), "HH:mm:ss") : "",
        operator_name: w.operator_name ?? "",
      };
    }
  } else if (j.data_hub_job_id) {
    const { data: d } = await supabase.from("data_hub_jobs").select("raw, ewc, customer").eq("id", j.data_hub_job_id).maybeSingle();
    const r: any = (d as any)?.raw ?? {};
    const dir = [r["In / Out"], r["Time"]].map((x) => String(x ?? "").toUpperCase()).find((x) => x === "INWARD" || x === "OUTWARD");
    v = {
      account: r["Account"] ?? "", direction: dir ?? "INWARD", carrier_name: r["Haulier"] ?? "",
      carrier_registration: r["Carrier no"] ?? "", ewc_code: r["ewc"] ?? (d as any)?.ewc ?? "",
      waste_description: r["EWC Desc"] ?? r["Product"] ?? "", means_of_transport: "Road",
      gross_weight: kg(r["Gross"]), tare_weight: kg(r["Tare"]), net_weight: kg(r["Weight"]),
      net_tonnes: r["Weight"] != null ? (Math.abs(Number(r["Weight"])) / 1000).toFixed(2) : "",
    };
  }

  const when = new Date(job.completed_at ?? job.created_at);
  const charges = job.has_contamination
    ? job.contamination_items.map((i) => `${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""} £${Number(i.line_total).toFixed(2)}`).join(" · ")
    : "";
  const vars = {
    date: format(when, "dd/MM/yyyy"), time: format(when, "HH:mm"),
    vehicle_reg: job.vehicle_reg ?? "", customer: job.customer ?? "", site: job.site ?? "",
    container_type: job.container_type ?? "", waste_description: job.material ?? "",
    ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "")),
    ticket_number: v.ticket_number || job.job_number,
    additional_items: charges,
    notes: [job.notes, job.completed_by_name ? `Banksman: ${job.completed_by_name}` : ""].filter(Boolean).join(" · "),
    ...WTN_COMPANY_DETAILS,
  } as Record<string, string>;

  win.document.write(renderWtnSheet(templateHtml || DEFAULT_WTN_TEMPLATE, vars, `WTN ${vars.ticket_number}`, { includePrices }));
  win.document.close();
  win.focus();
  win.print();
}
