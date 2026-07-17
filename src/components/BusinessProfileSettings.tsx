import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ShieldCheck, ExternalLink, Radio } from "lucide-react";

type Profile = {
  id?: string;
  company_name: string | null;
  trading_name: string | null;
  operational_address: string | null;
  registered_address: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  company_registration_number: string | null;
  vat_number: string | null;
  waste_carriers_licence_number: string | null;
  waste_carriers_licence_expiry: string | null;
  environment_agency_reference: string | null;
};

const EMPTY: Profile = {
  company_name: "",
  trading_name: "",
  operational_address: "",
  registered_address: "",
  telephone: "",
  email: "",
  website: "",
  company_registration_number: "",
  vat_number: "",
  waste_carriers_licence_number: "",
  waste_carriers_licence_expiry: "",
  environment_agency_reference: "",
};

export const BusinessProfileSettings = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("company_profile")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else if (data) {
        setProfile({ ...EMPTY, ...data });
      }
      setLoading(false);
    })();
  }, [toast]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    const payload = { ...profile, waste_carriers_licence_expiry: profile.waste_carriers_licence_expiry || null };
    const { error } = profile.id
      ? await supabase.from("company_profile").update(payload).eq("id", profile.id)
      : await supabase.from("company_profile").insert(payload as any);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Business profile updated." });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Details</CardTitle>
          <CardDescription>Core company identity used across the portal and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input value={profile.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Trading Name</Label>
            <Input value={profile.trading_name ?? ""} onChange={(e) => set("trading_name", e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Site Address</Label>
            <Textarea
              rows={2}
              value={profile.operational_address ?? ""}
              onChange={(e) => set("operational_address", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Registered Address</Label>
            <Textarea
              rows={2}
              value={profile.registered_address ?? ""}
              onChange={(e) => set("registered_address", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telephone</Label>
            <Input value={profile.telephone ?? ""} onChange={(e) => set("telephone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={profile.website ?? ""} onChange={(e) => set("website", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Company Registration No.</Label>
            <Input
              value={profile.company_registration_number ?? ""}
              onChange={(e) => set("company_registration_number", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>VAT Number</Label>
            <Input value={profile.vat_number ?? ""} onChange={(e) => set("vat_number", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Licences & Permits</CardTitle>
          <CardDescription>Statutory references used on Duty of Care, Annex 7 and DWT submissions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Waste Carriers Licence</Label>
            <Input
              value={profile.waste_carriers_licence_number ?? ""}
              onChange={(e) => set("waste_carriers_licence_number", e.target.value)}
              placeholder="CBDU203180"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Waste Carriers Licence Expiry</Label>
            <Input
              type="date"
              value={profile.waste_carriers_licence_expiry ?? ""}
              onChange={(e) => set("waste_carriers_licence_expiry", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Waste Management Licence (EA Reference)</Label>
            <Input
              value={profile.environment_agency_reference ?? ""}
              onChange={(e) => set("environment_agency_reference", e.target.value)}
              placeholder="EAWML 48106"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Profile
        </Button>
      </div>
    </div>
  );
};
