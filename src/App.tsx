import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import Index from "./pages/Index";
import HandbookPage from "./pages/HandbookPage";
import RAMSPage from "./pages/RAMSPage";
import ToolboxTalksPage from "./pages/ToolboxTalksPage";
import ContactPage from "./pages/ContactPage";
import AuthPage from "./pages/AuthPage";
import AdminPage from "./pages/AdminPage";
import AdminHandbookPage from "./pages/AdminHandbookPage";
import AdminRAMSPage from "./pages/AdminRAMSPage";
import AdminToolboxTalksPage from "./pages/AdminToolboxTalksPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import MyProfilePage from "./pages/MyProfilePage";
import MassSignOffPage from "./pages/MassSignOffPage";
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
            <Route path="/" element={<LandingPage />} />
            <Route path="/portal" element={<Index />} />
            <Route path="/handbook" element={<HandbookPage />} />
            <Route path="/rams" element={<RAMSPage />} />
            <Route path="/toolbox-talks" element={<ToolboxTalksPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/handbook" element={<AdminHandbookPage />} />
            <Route path="/admin/rams" element={<AdminRAMSPage />} />
            <Route path="/admin/toolbox-talks" element={<AdminToolboxTalksPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/my-profile" element={<MyProfilePage />} />
            <Route path="/mass-sign-off" element={<MassSignOffPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
