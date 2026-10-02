import { Link } from "react-router-dom";
import { BarChart3, Database, Radio, Gauge, AlertTriangle, Box, Fuel, PoundSterling, FileText, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";

const sections: { title: string; description: string; path: string; icon: LucideIcon }[] = [
  { title: "Waste KPIs", description: "Zero to Landfill and wood recovery", path: "/performance-hub/waste-kpis", icon: Gauge },
  { title: "Business Reports", description: "Business performance and trends", path: "/performance-hub/reports", icon: BarChart3 },
  { title: "Live Jobs", description: "Skips and RoRos on site", path: "/performance-hub/live-jobs", icon: Radio },
  { title: "Rentals", description: "Over-rentals and agreements", path: "/performance-hub/rentals", icon: PoundSterling },
  { title: "Data Uploads", description: "Skiptrak and Midweigh data", path: "/performance-hub/data", icon: Database },
  { title: "PDA Uploads", description: "Transfer notes matched to jobs", path: "/performance-hub/pda-uploads", icon: FileText },
  { title: "Contaminations", description: "Queries, charges and communications", path: "/performance-hub/contaminations", icon: AlertTriangle },
  { title: "Stock Check", description: "Container stock and availability", path: "/performance-hub/stock-check", icon: Box },
  { title: "Fuel Surcharges", description: "Vehicle and zone surcharges", path: "/performance-hub/fuel-surcharges", icon: Fuel },
];

export default function PerformanceHubPage() {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6">
      <PageHeading title="Performance Hub" section={{ label: "Home", href: "/portal" }} description="Explore operational and business reports." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ title, description, path, icon: Icon }) => (
          <Link key={path} to={path} className="group flex min-h-32 items-start gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-foreground">{title}</span><span className="mt-1 block text-sm text-muted-foreground">{description}</span></span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
