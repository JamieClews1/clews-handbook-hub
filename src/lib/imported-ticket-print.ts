import { supabase } from "@/integrations/supabase/client";
import { parseLoadReportDate } from "@/lib/load-report-dates";
import { DEFAULT_WTN_TEMPLATE, WTN_COMPANY_DETAILS, renderWtnSheet } from "@/lib/wtn-ticket-template";
import { downloadWtnPdf, printWtnPdf, type WtnJob } from "@/lib/route-one-wtn";

export const escapePrintValue = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));

export function skiptrakWtnJob(job: Record<string, any>): WtnJob {
  return { job_number: job.job_number, scheduled_date: job.job_date, customer_name: job.customer, site_name: job.site, site_postcode: job.postcode, vehicle_reg: job.vehicle_registration, driver_name: job.driver, job_type: job.movement_type, container_type: job.container_type, waste_type: job.waste_description, ewc_code: job.ewc, disposal_site: job.tipping_location, po_number: job.order_number_override, account_code: job.account_code, quantity: job.weight_t == null ? null : `${job.weight_t} t` };
}

export function midweighPrintVars(job: Record<string, any>) {
  const raw = job.raw && typeof job.raw === "object" && !Array.isArray(job.raw) ? job.raw : {};
  const weight = (value: unknown) => value == null || value === "" || !Number.isFinite(Number(value)) ? "" : Math.abs(Number(value)).toLocaleString("en-GB");
  const net = job.weight_t ?? raw.Weight;
  const date = parseLoadReportDate(job.job_date)?.toLocaleDateString("en-GB", { timeZone: "UTC" }) ?? "";
  const direction = [job.movement_type, raw["In / Out"], raw.Time].find(v => /^(INWARD|OUTWARD)$/i.test(String(v ?? ""))) ?? "";
  return Object.fromEntries(Object.entries({ ...WTN_COMPANY_DETAILS,
    ticket_number: job.job_number, date, time: /^\d{1,2}:\d{2}/.test(String(raw.Time ?? "")) ? raw.Time : "",
    account: raw.Account, customer_order_no: raw["Order no"] ?? raw["Order No"] ?? raw.PO,
    direction, customer: job.customer, site: job.site, driver_name: job.driver,
    vehicle_reg: job.vehicle_registration, waste_description: job.waste_description ?? raw["EWC Desc"] ?? raw.Product,
    ewc_code: job.ewc ?? raw.ewc, container_type: job.container_type,
    carrier_name: raw.Haulier, carrier_registration: raw["Carrier no"], means_of_transport: "Road",
    gross_weight: weight(raw.Gross), tare_weight: weight(raw.Tare), net_weight: weight(net),
    net_tonnes: net == null || !Number.isFinite(Number(net)) ? "" : (Math.abs(Number(net)) / 1000).toFixed(3),
  }).map(([key, value]) => [key, escapePrintValue(value)]));
}

export async function printMidweighTicket(id: string) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) throw new Error("Allow pop-ups to print this ticket.");
  win.document.body.textContent = "Loading ticket…";
  try {
    const { data, error } = await supabase.from("data_hub_jobs").select("*").eq("id", id).eq("source", "midweigh").single();
    if (error) throw error;
    const vars = midweighPrintVars(data);
    win.document.open();
    win.document.write(renderWtnSheet(DEFAULT_WTN_TEMPLATE, vars, `WTN ${vars.ticket_number}`, { includePrices: false }));
    win.document.close();
    win.focus();
    win.print();
  } catch (error) {
    win.close();
    throw error;
  }
}