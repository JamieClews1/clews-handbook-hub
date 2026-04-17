import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageLayout } from "@/components/AdminPageLayout";
import { BookingsManagement } from "@/components/bookings/BookingsManagement";
import { EnquiriesList } from "@/components/bookings/EnquiriesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarCheck, Mail } from "lucide-react";

const BookingsPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/auth");
    }
  }, [user, isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <AdminPageLayout
      title="Bookings"
      description="Manage skip and container collection bookings"
    >
      <Tabs defaultValue="bookings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bookings" className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="enquiries" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Enquiries
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bookings">
          <BookingsManagement />
        </TabsContent>
        <TabsContent value="enquiries">
          <EnquiriesList />
        </TabsContent>
      </Tabs>
    </AdminPageLayout>
  );
};

export default BookingsPage;
