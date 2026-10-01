import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Guide = {
  id: string;
  title: string;
  section: string;
  intro: string;
  steps: { title: string; detail: string; href?: string; linkLabel?: string }[];
  note?: string;
};

const guides: Guide[] = [
  {
    id: "monthly-rebates",
    title: "How to run rebates each month",
    section: "Rebates",
    intro: "Work through the monthly prices, check for missing setups, review the figures and then send the reports.",
    steps: [
      {
        title: "Enter the monthly values",
        detail: "Open Rebates → Monthly Values. Choose the month you are reporting on, enter the lower and higher rates for each relevant material, then select Save. Missing market values can leave a rebate at £0.",
        href: "/rebate-values", linkLabel: "Open Rebates",
      },
      {
        title: "Check which customers are set up",
        detail: "Open the Check tab, choose the reporting period and select Generate Report. Review any customers marked Not Set Up. If a rebate is due, follow the How to set up a rebate guide before continuing.",
        href: "/help?guide=rebate-setup", linkLabel: "Open rebate setup guide",
      },
      {
        title: "Generate the monthly overview",
        detail: "Open the Monthly tab, set the full reporting period and select Generate Overview. Expand each customer and check their site totals, tonnage, rates and charges. Investigate unexpected £0 lines and any sites with missing data.",
        href: "/rebate-values", linkLabel: "Open monthly rebates",
      },
      {
        title: "Adjust rebates on individual load reports",
        detail: "Some rebate changes are made on the load report itself rather than in the setup. When creating or editing a load report you can tick Exclude from Monthly Rebate Report (for example on liquid loads), set a Weight Rebate Threshold so rebate is only paid on weight above that limit, and enter Bespoke Rebate Rates for individual materials on that load.",
        href: "/load-reports", linkLabel: "Open Load Reports",
      },
      {
        title: "Review and send",
        detail: "Preview or download the customer report. When the figures are correct, use the send action for a site or the customer email action. Check every recipient and message in the review window before selecting Send. Use Sent Rebates and Tracking to confirm what was sent and what remains outstanding.",
      },
    ],
    note: "A locked report keeps its saved figures; changing a monthly rate later will not automatically update that locked report.",
  },
  {
    id: "rebate-setup",
    title: "How to set up a rebate",
    section: "Customer Setup",
    intro: "Set up a customer and site so their jobs appear in the monthly rebate report with the right prices.",
    steps: [
      {
        title: "Open the customer",
        detail: "Open Customer Setup and select the customer. If the rebate is for a brand new customer, create the customer first. On the Edit customer screen you can also switch on Midweigh rebates — only do this for customers whose standalone Midweigh weighbridge tickets should generate rebates (for example Biffa, Conectiv or Transol); when it is off, Midweigh jobs are excluded from that customer's rebate reports.",
        href: "/customer-setup", linkLabel: "Open Customer Setup",
      },
      {
        title: "Open the site and set the load report type",
        detail: "On the Sites tab choose the site and select Edit (or use New site for a fresh one and save it first). In the Details tab set the Load Report Type — this decides which materials appear for rebate values.",
      },
      {
        title: "Assign a rebate set",
        detail: "In the Rebate pricing tab pick the rebate set (pricing template) this site uses, or type a name into Or create new rebate set to make a new one. The rebate set is what links the site to the monthly values you enter in Rebates.",
      },
      {
        title: "Add Skip / RoRo rebate lines",
        detail: "In the Skip / RoRo rebates tab add a line for each rebate material. You can filter by container type (comma-separated for several), set bespoke values, add a per-load weight threshold (pay only on weight above the limit) and apply rate adjustments. Numeric fields update when you click away, not as you type.",
      },
      {
        title: "Check the setup",
        detail: "Open Rebates → Check, choose the reporting period and select Generate Report. The site should no longer be marked Not Set Up. Remember the figures only show money once the month's values have been entered in Rebates → Monthly Values.",
        href: "/rebate-values", linkLabel: "Open Rebates",
      },
    ],
    note: "Not every rebate change lives in the setup — on individual load reports you can exclude a load from the monthly rebate report, set a weight rebate threshold and enter bespoke £/tonne rates for that load. See the How to run rebates each month guide.",
  },
  {
    id: "skip-count",
    title: "How to do a skip count",
    section: "Stock Check",
    intro: "Record the physical skips and RoRos in the yard, alongside runners, in a new stock take.",
    steps: [
      {
        title: "Start a new stock take",
        detail: "Open Stock Check → Live → New Stock Take. Read any notes from the previous count before you start.",
        href: "/performance-hub/stock-check", linkLabel: "Open Stock Check",
      },
      {
        title: "Identify who is counting",
        detail: "Enter your name in Operator Name. This is required before you can submit the count.",
      },
      {
        title: "Count each size separately",
        detail: "Work through Skips and then RoRos. For each size, use the plus and minus controls to record the number In Yard and check the Runners figure. Add an item note for anything that needs explaining, such as a bin stored elsewhere or one needing repair.",
      },
      {
        title: "Check totals and submit",
        detail: "Review the In Yard and Runners totals at the bottom. Add General Notes for anything affecting the whole count, then select Submit. Check Current Stock for the updated position; History holds earlier stock takes.",
      },
      {
        title: "Correct a mistake",
        detail: "Use Edit from Current Stock or History to reopen the latest stock take. Select Update when finished; this overwrites that tally rather than creating a second one.",
      },
    ],
    note: "The Inventory tab tracks individual numbered bins and photos. It is separate from the size-by-size stock take.",
  },
];

export default function HelpPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const selected = guides.find((guide) => guide.id === params.get("guide"));
  const visible = guides.filter((guide) => `${guide.title} ${guide.section}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="mb-8 flex items-start gap-4">
        {selected && (
          <Button variant="ghost" size="icon" aria-label="Back to all guides" title="Back to all guides" onClick={() => setParams({})}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><BookOpen className="h-4 w-4" /> Help</div>
          <h1 className="text-3xl font-semibold text-foreground">{selected ? selected.title : "How-to guides"}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{selected ? selected.intro : "Step-by-step guidance for the team's regular portal tasks."}</p>
        </div>
      </div>

      {selected ? (
        <article className="max-w-3xl">
          <div className="mb-6 border-b border-border pb-4 text-sm font-medium text-muted-foreground">{selected.section} · {selected.steps.length} steps</div>
          <ol className="space-y-0">
            {selected.steps.map((step, index) => (
              <li key={step.title} className="relative flex gap-5 border-l border-border pb-9 pl-8 last:border-transparent last:pb-4">
                <span className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-primary bg-background text-sm font-semibold text-primary">{index + 1}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">{step.title}</h2>
                  <p className="mt-2 leading-7 text-muted-foreground">{step.detail}</p>
                  {step.href && <Button asChild variant="link" className="mt-2 h-auto p-0"><Link to={step.href}>{step.linkLabel}<ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>}
                </div>
              </li>
            ))}
          </ol>
          {selected.note && <div className="mt-6 border-l-2 border-primary bg-muted/50 px-5 py-4 text-sm leading-6 text-foreground"><span className="font-semibold">Good to know: </span>{selected.note}</div>}
          <Button variant="outline" className="mt-8 gap-2" onClick={() => setParams({})}><ArrowLeft className="h-4 w-4" />All guides</Button>
        </article>
      ) : (
        <div className="max-w-4xl">
          <div className="relative mb-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search guides" placeholder="Search guides" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((guide) => (
              <Button key={guide.id} variant="outline" className="h-auto min-h-36 w-full items-start justify-between gap-4 whitespace-normal border-border bg-card p-5 text-left hover:border-primary/50" onClick={() => setParams({ guide: guide.id })}>
                <span className="flex min-w-0 flex-col items-start gap-3">
                  <span className="flex items-center gap-2 text-xs font-medium uppercase text-primary"><ClipboardList className="h-4 w-4" />{guide.section}</span>
                  <span className="text-lg font-semibold text-foreground">{guide.title}</span>
                  <span className="text-sm font-normal leading-5 text-muted-foreground">{guide.intro}</span>
                </span>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
              </Button>
            ))}
          </div>
          {visible.length === 0 && <p className="py-10 text-muted-foreground">No guides match your search.</p>}
        </div>
      )}
    </div>
  );
}