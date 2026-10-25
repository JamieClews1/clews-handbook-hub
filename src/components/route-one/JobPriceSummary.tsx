import { computeJobTotals } from "./JobFormFields";

const money = (value: unknown) => Number(value || 0).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
export function JobPriceSummary({ form }: { form: any }) {
  const totals = computeJobTotals(form);
  return <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
    <span className="text-muted-foreground">Haulage {money(form.haulage_cost)} · {money(form.charge_per_tonne)}/t</span>
    <span>Net <strong className="text-base text-foreground">{money(totals.net)}</strong></span>
    <span className="text-muted-foreground">{money(totals.gross)} inc VAT</span>
  </div>;
}