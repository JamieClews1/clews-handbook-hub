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

  // OnePortal
  { key: "duty-of-care", label: "Duty of Care", category: "OnePortal", path: "/duty-of-care" },
  { key: "near-miss", label: "Near Miss", category: "OnePortal", path: "/near-miss" },
  { key: "site-reports", label: "Site Reports", category: "OnePortal", path: "/site-reports" },
  { key: "policies", label: "Policies", category: "OnePortal", path: "/policies" },
  { key: "handbook", label: "Handbook", category: "OnePortal", path: "/handbook" },
  { key: "rams", label: "RAMS", category: "OnePortal", path: "/rams" },
  { key: "toolbox-talks", label: "Toolbox Talks", category: "OnePortal", path: "/toolbox-talks" },
  { key: "waste-reporting", label: "Waste Reporting", category: "OnePortal", path: "/waste-reporting" },
  { key: "load-reports", label: "Load Reports", category: "OnePortal", path: "/load-reports" },
  { key: "container-loads", label: "Container Loads", category: "OnePortal", path: "/container-loads" },
  { key: "diary", label: "Diary", category: "OnePortal", path: "/diary" },
  { key: "bookings", label: "Bookings", category: "OnePortal", path: "/bookings" },
  { key: "crm", label: "CRM Inbox", category: "OnePortal", path: "/crm" },
  { key: "pricing", label: "Pricing", category: "OnePortal", path: "/pricing" },

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
