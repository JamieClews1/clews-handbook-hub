import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { StaffRoute } from "./components/StaffRoute";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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

            {/* Customer portal — accessible to all authenticated users */}
            <Route path="/my-portal" element={<CustomerPortalPage />} />

            {/* Staff-only routes — portal customers are redirected to /my-portal */}
            <Route path="/portal" element={<StaffRoute><Index /></StaffRoute>} />
            <Route path="/handbook" element={<StaffRoute><HandbookPage /></StaffRoute>} />
            <Route path="/rams" element={<StaffRoute><RAMSPage /></StaffRoute>} />
            <Route path="/rams/:id" element={<StaffRoute><RAMSDetailPage /></StaffRoute>} />
            <Route path="/toolbox-talks" element={<StaffRoute><ToolboxTalksPage /></StaffRoute>} />
            <Route path="/toolbox-talks/:id" element={<StaffRoute><ToolboxTalkDetailPage /></StaffRoute>} />
            <Route path="/contact" element={<StaffRoute><ContactPage /></StaffRoute>} />
            <Route path="/admin" element={<StaffRoute><AdminPage /></StaffRoute>} />
            <Route path="/admin/handbook" element={<StaffRoute><AdminHandbookPage /></StaffRoute>} />
            <Route path="/admin/rams" element={<StaffRoute><AdminRAMSPage /></StaffRoute>} />
            <Route path="/admin/toolbox-talks" element={<StaffRoute><AdminToolboxTalksPage /></StaffRoute>} />
            <Route path="/admin/users" element={<StaffRoute><AdminUsersPage /></StaffRoute>} />
            <Route path="/admin/customers" element={<StaffRoute><AdminCustomersPage /></StaffRoute>} />
            <Route path="/admin/settings" element={<StaffRoute><AdminSettingsPage /></StaffRoute>} />
            <Route path="/admin/questionnaires" element={<StaffRoute><AdminQuestionnairesPage /></StaffRoute>} />
            <Route path="/my-profile" element={<StaffRoute><MyProfilePage /></StaffRoute>} />
            <Route path="/mass-sign-off" element={<StaffRoute><MassSignOffPage /></StaffRoute>} />
            <Route path="/duty-of-care" element={<StaffRoute><DutyOfCarePage /></StaffRoute>} />
            <Route path="/near-miss" element={<StaffRoute><NearMissPage /></StaffRoute>} />
            <Route path="/waste-reporting" element={<StaffRoute><WasteReportingPage /></StaffRoute>} />
            <Route path="/policies" element={<StaffRoute><PoliciesPage /></StaffRoute>} />
            <Route path="/site-reports" element={<StaffRoute><SiteReportsPage /></StaffRoute>} />
            <Route path="/load-reports" element={<StaffRoute><LoadReportsPage /></StaffRoute>} />
            <Route path="/performance-hub" element={<StaffRoute><PerformanceHubPage /></StaffRoute>} />
            <Route path="/performance-hub/reports" element={<StaffRoute><PerformanceHubReportsPage /></StaffRoute>} />
            <Route path="/performance-hub/waste-kpis" element={<StaffRoute><WasteKPIsPage /></StaffRoute>} />
            <Route path="/performance-hub/data" element={<StaffRoute><DataUploadsPage /></StaffRoute>} />
            <Route path="/performance-hub/live-jobs" element={<StaffRoute><LiveJobsPage /></StaffRoute>} />
            <Route path="/data-hub/uploads" element={<StaffRoute><DataUploadsPage /></StaffRoute>} />
            <Route path="/rebate-values" element={<StaffRoute><RebateValuesPage /></StaffRoute>} />
            <Route path="/customer-reporting" element={<StaffRoute><CustomerReportingPage /></StaffRoute>} />
            <Route path="/staci-reports" element={<StaffRoute><StaciReportsPage /></StaffRoute>} />
            <Route path="/performance-hub/contaminations" element={<StaffRoute><ContaminationsPage /></StaffRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
