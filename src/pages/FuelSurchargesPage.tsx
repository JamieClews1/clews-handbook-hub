import { Link } from "react-router-dom";
import { ArrowLeft, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FuelSurchargeDashboard from "@/components/fuel-surcharge/FuelSurchargeDashboard";
import FuelSurchargeJobsList from "@/components/fuel-surcharge/FuelSurchargeJobsList";
import FuelSurchargeRatesEditor from "@/components/fuel-surcharge/FuelSurchargeRatesEditor";
import BiffaFuelSurcharge from "@/components/fuel-surcharge/BiffaFuelSurcharge";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function FuelSurchargesPage() {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_types").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const isMgmt = (profile?.user_types ?? []).includes("management");
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      setCanEdit(isMgmt || isAdmin);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/performance-hub">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Performance Hub</Button>
          </Link>
          <div className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">Fuel Surcharges</h1>
          </div>
          <div className="w-32" />
        </div>
      </header>

      <main className="container max-w-screen-2xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="jobs">Jobs & Export</TabsTrigger>
            <TabsTrigger value="rates">Rates</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard"><FuelSurchargeDashboard /></TabsContent>
          <TabsContent value="jobs"><FuelSurchargeJobsList /></TabsContent>
          <TabsContent value="rates"><FuelSurchargeRatesEditor canEdit={canEdit} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
