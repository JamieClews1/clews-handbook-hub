import { computeJobTotals } from "./JobFormFields";

const money = (value: unknown) => Number(value || 0).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
export function JobPriceSummary({ form }: { form: any }) {
  const totals = computeJobTotals(form);
  return <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs border-b border-border bg-muted/40 px-5 py-2">
    <span>Booked charge <strong>{money(form.haulage_cost)}</strong></span>
    <span>Per tonne <strong>{money(form.charge_per_tonne)}</strong></span>
    <span>Extras <strong>{money(totals.items + Number(form.contamination_charge || 0))}</strong></span>
    <span className="sm:ml-auto">Net <strong>{money(totals.net)}</strong></span>
    <span>Inc VAT <strong className="text-primary">{money(totals.gross)}</strong></span>
  </div>;
}