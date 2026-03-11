import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { StaffRoute } from "./components/StaffRoute";
import { AppLayout } from "./components/AppLayout";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import HandbookPage from "./pages/HandbookPage";
import RAMSPage from "./pages/RAMSPage";
import RAMSDetailPage from "./pages/RAMSDetailPage";
import ToolboxTalksPage from "./pages/ToolboxTalksPage";
import ToolboxTalkDetailPage from "./pages/ToolboxTalkDetailPage";
import ContactPage from "./pages/ContactPage";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import AdminHandbookPage from "./pages/AdminHandbookPage";
import AdminRAMSPage from "./pages/AdminRAMSPage";
import AdminToolboxTalksPage from "./pages/AdminToolboxTalksPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminCustomersPage from "./pages/AdminCustomersPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminQuestionnairesPage from "./pages/AdminQuestionnairesPage";
import MyProfilePage from "./pages/MyProfilePage";
import MassSignOffPage from "./pages/MassSignOffPage";
import DutyOfCarePage from "./pages/DutyOfCarePage";
import WasteReportingPage from "./pages/WasteReportingPage";
import PoliciesPage from "./pages/PoliciesPage";
import SiteReportsPage from "./pages/SiteReportsPage";
import OnePortalPage from "./pages/OnePortalPage";
import LoadReportsPage from "./pages/LoadReportsPage";
import WasteFormPublicPage from "./pages/WasteFormPublicPage";
import PartnerQuestionnairePage from "./pages/PartnerQuestionnairePage";
import CreditApplicationPage from "./pages/CreditApplicationPage";
import DataUploadsPage from "./pages/DataUploadsPage";
import PerformanceHubPage from "./pages/PerformanceHubPage";
import PerformanceHubReportsPage from "./pages/PerformanceHubReportsPage";
import WasteKPIsPage from "./pages/WasteKPIsPage";
import LiveJobsPage from "./pages/LiveJobsPage";
import RebateValuesPage from "./pages/RebateValuesPage";
import CustomerReportingPage from "./pages/CustomerReportingPage";
import CustomerPortalPage from "./pages/CustomerPortalPage";
import NearMissReportPage from "./pages/NearMissReportPage";
import NearMissPage from "./pages/NearMissPage";
import StaciReportsPage from "./pages/StaciReportsPage";
import ContaminationsPage from "./pages/ContaminationsPage";
import StockCheckPage from "./pages/StockCheckPage";
import RouteOnePage from "./pages/RouteOnePage";
import WeighOnePage from "./pages/WeighOnePage";
import DriverAppPage from "./pages/DriverAppPage";
import ProjectionsPage from "./pages/ProjectionsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Wraps children in StaffRoute + AppLayout */
const Staff = ({ children }: { children: React.ReactNode }) => (
  <StaffRoute>
    <AppLayout>{children}</AppLayout>
  </StaffRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/waste-form/:shareToken" element={<WasteFormPublicPage />} />
            <Route path="/partner-questionnaire/:shareToken" element={<PartnerQuestionnairePage />} />
            <Route path="/nearmissreport" element={<NearMissReportPage />} />
            <Route path="/credit-application/:shareToken" element={<CreditApplicationPage />} />
            <Route path="/driver" element={<DriverAppPage />} />

            {/* Customer portal — accessible to all authenticated users */}
            <Route path="/my-portal" element={<CustomerPortalPage />} />

            {/* Staff-only routes with sidebar layout */}
            <Route path="/portal" element={<Staff><Index /></Staff>} />
            <Route path="/handbook" element={<AppLayout><HandbookPage /></AppLayout>} />
            <Route path="/rams" element={<Staff><RAMSPage /></Staff>} />
            <Route path="/rams/:id" element={<Staff><RAMSDetailPage /></Staff>} />
            <Route path="/toolbox-talks" element={<Staff><ToolboxTalksPage /></Staff>} />
            <Route path="/toolbox-talks/:id" element={<Staff><ToolboxTalkDetailPage /></Staff>} />
            <Route path="/contact" element={<Staff><ContactPage /></Staff>} />
            <Route path="/admin" element={<Staff><AdminPage /></Staff>} />
            <Route path="/admin/handbook" element={<Staff><AdminHandbookPage /></Staff>} />
            <Route path="/admin/rams" element={<Staff><AdminRAMSPage /></Staff>} />
            <Route path="/admin/toolbox-talks" element={<Staff><AdminToolboxTalksPage /></Staff>} />
            <Route path="/admin/users" element={<Staff><AdminUsersPage /></Staff>} />
            <Route path="/admin/customers" element={<Staff><AdminCustomersPage /></Staff>} />
            <Route path="/admin/settings" element={<Staff><AdminSettingsPage /></Staff>} />
            <Route path="/admin/questionnaires" element={<Staff><AdminQuestionnairesPage /></Staff>} />
            <Route path="/my-profile" element={<Staff><MyProfilePage /></Staff>} />
            <Route path="/mass-sign-off" element={<Staff><MassSignOffPage /></Staff>} />
            <Route path="/duty-of-care" element={<Staff><DutyOfCarePage /></Staff>} />
            <Route path="/near-miss" element={<Staff><NearMissPage /></Staff>} />
            <Route path="/waste-reporting" element={<Staff><WasteReportingPage /></Staff>} />
            <Route path="/policies" element={<Staff><PoliciesPage /></Staff>} />
            <Route path="/site-reports" element={<Staff><SiteReportsPage /></Staff>} />
            <Route path="/one-portal" element={<Staff><OnePortalPage /></Staff>} />
            <Route path="/load-reports" element={<Staff><LoadReportsPage /></Staff>} />
            <Route path="/performance-hub" element={<Staff><PerformanceHubPage /></Staff>} />
            <Route path="/performance-hub/reports" element={<Staff><PerformanceHubReportsPage /></Staff>} />
            <Route path="/performance-hub/waste-kpis" element={<Staff><WasteKPIsPage /></Staff>} />
            <Route path="/performance-hub/data" element={<Staff><DataUploadsPage /></Staff>} />
            <Route path="/performance-hub/live-jobs" element={<Staff><LiveJobsPage /></Staff>} />
            <Route path="/data-hub/uploads" element={<Staff><DataUploadsPage /></Staff>} />
            <Route path="/rebate-values" element={<Staff><RebateValuesPage /></Staff>} />
            <Route path="/customer-reporting" element={<Staff><CustomerReportingPage /></Staff>} />
            <Route path="/staci-reports" element={<Staff><StaciReportsPage /></Staff>} />
            <Route path="/performance-hub/contaminations" element={<Staff><ContaminationsPage /></Staff>} />
            <Route path="/performance-hub/stock-check" element={<Staff><StockCheckPage /></Staff>} />
            <Route path="/route-one" element={<Staff><RouteOnePage /></Staff>} />
            <Route path="/weigh-one" element={<Staff><WeighOnePage /></Staff>} />
            <Route path="/performance-hub/projections" element={<Staff><ProjectionsPage /></Staff>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
