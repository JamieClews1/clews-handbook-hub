// Registry of togglable portal sections used by the Section Visibility CMS.
// Keys are stable identifiers stored in portal_section_visibility.section_key.

export interface PortalSection {
  key: string;
  label: string;
  category: string;
  path?: string; // primary route (informational)
}

export const PORTAL_SECTIONS: PortalSection[] = [
  // Top-level
  { key: "assistant", label: "Ask One", category: "Top level", path: "/assistant" },
  { key: "ai-assistant", label: "Claude Assistant", category: "Top level", path: "/ai-assistant" },

  // WasteOne
  { key: "route-one", label: "RouteOne", category: "WasteOne", path: "/route-one" },
  { key: "weigh-one", label: "WeighOne", category: "WasteOne", path: "/weigh-one" },
  { key: "digital-waste-tracking", label: "Digital Waste Tracking", category: "WasteOne", path: "/digital-waste-tracking" },
  { key: "permits", label: "Permits", category: "WasteOne", path: "/permits" },

  // OnePortal
  { key: "duty-of-care", label: "Duty of Care", category: "OnePortal", path: "/duty-of-care" },
  { key: "site-reports", label: "Site Reports", category: "OnePortal", path: "/site-reports" },
  { key: "policies", label: "Policies", category: "OnePortal", path: "/policies" },
  { key: "handbook", label: "Handbook", category: "OnePortal", path: "/handbook" },
  { key: "load-reports", label: "Load Reports", category: "OnePortal", path: "/load-reports" },
  { key: "container-loads", label: "Container Loads", category: "OnePortal", path: "/container-loads" },
  { key: "diary", label: "Diary", category: "OnePortal", path: "/diary" },
  { key: "bookings", label: "Bookings", category: "OnePortal", path: "/bookings" },
  { key: "crm", label: "Inbox", category: "OnePortal", path: "/inbox" },
  { key: "pricing", label: "Pricing", category: "OnePortal", path: "/pricing" },
  { key: "finance", label: "Invoicing", category: "Finance", path: "/finance" },
  { key: "company-pl", label: "Company P&L", category: "Finance", path: "/finance/company-pl" },
  { key: "payroll", label: "Payroll & Time", category: "Finance", path: "/payroll" },
  { key: "metals", label: "Non-Ferrous Metals", category: "OnePortal", path: "/metals" },
  { key: "hs-rams", label: "RAMS", category: "Health & Safety", path: "/rams" },
  { key: "hs-site-inductions", label: "Site Inductions", category: "Team", path: "/site-inductions" },
  { key: "hs-near-miss", label: "Near Misses", category: "Health & Safety", path: "/near-miss" },
  { key: "hs-toolbox-talks", label: "Toolbox Talks", category: "Health & Safety", path: "/toolbox-talks" },
  { key: "hs-fire-safety", label: "Fire Safety", category: "Health & Safety", path: "/fire-safety" },
  { key: "walk-around-checks", label: "Walk Around Checks", category: "Walk Around Checks", path: "/walk-around-checks" },

  // Performance
  { key: "performance-waste-kpis", label: "Waste KPIs", category: "Performance", path: "/performance-hub/waste-kpis" },
  { key: "performance-projections", label: "Projections", category: "Performance", path: "/performance-hub/projections" },
  { key: "performance-reports", label: "Reports", category: "Performance", path: "/performance-hub/reports" },
  { key: "performance-live-jobs", label: "Live Jobs", category: "Performance", path: "/performance-hub/live-jobs" },
  { key: "performance-rentals", label: "Rentals", category: "Performance", path: "/performance-hub/rentals" },
  { key: "performance-data", label: "Data Uploads", category: "Performance", path: "/performance-hub/data" },
  { key: "performance-contaminations", label: "Contaminations", category: "Performance", path: "/performance-hub/contaminations" },
  { key: "performance-stock-check", label: "Stock Check", category: "Performance", path: "/performance-hub/stock-check" },
  { key: "performance-fuel-surcharges", label: "Fuel Surcharges", category: "Performance", path: "/performance-hub/fuel-surcharges" },
  { key: "staci-reports", label: "STACI Reports", category: "Performance", path: "/staci-reports" },
  { key: "customer-reporting", label: "Customer Reporting", category: "Performance", path: "/customer-reporting" },
  { key: "rebate-values", label: "Rebate Values", category: "Performance", path: "/rebate-values" },
  { key: "po-checks", label: "PO Checks", category: "Performance", path: "/po-checks" },
];
