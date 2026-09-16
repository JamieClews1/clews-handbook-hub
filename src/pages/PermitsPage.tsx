import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileCheck, Clock, Settings } from "lucide-react";
import { PermitApplicationsTab } from "@/components/permits/PermitApplicationsTab";
import { PermitExpiryTab } from "@/components/permits/PermitExpiryTab";
import { PermitSettingsTab } from "@/components/permits/PermitSettingsTab";

const PermitsPage = () => {
  return (
    <>
      <div className="p-4 md:p-6 max-w-screen-2xl mx-auto w-full space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Permits</h1>
          <p className="text-sm text-muted-foreground">
            Skip road permits — council lookup by postcode, applications, and expiry tracking.
          </p>
        </div>

        <Tabs defaultValue="applications" className="space-y-4">
          <TabsList>
            <TabsTrigger value="applications" className="gap-2">
              <FileCheck className="h-4 w-4" /> Applications
            </TabsTrigger>
            <TabsTrigger value="expiry" className="gap-2">
              <Clock className="h-4 w-4" /> Expiry tracking
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="applications"><PermitApplicationsTab /></TabsContent>
          <TabsContent value="expiry"><PermitExpiryTab /></TabsContent>
          <TabsContent value="settings"><PermitSettingsTab /></TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default PermitsPage;
