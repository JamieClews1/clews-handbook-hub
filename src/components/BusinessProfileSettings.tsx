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
  dwt_environment: string | null;
  dwt_api_base_url: string | null;
  dwt_client_id: string | null;
  dwt_api_code: string | null;
  dwt_client_secret_updated_at: string | null;
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
  dwt_environment: "sandbox",
  dwt_api_base_url: "https://waste-tracking.integration.api.defra.gov.uk",
  dwt_client_id: "",
  dwt_api_code: "1f83215e-4b90-4785-9ab2-2614839aa2e9",
  dwt_client_secret_updated_at: null,
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

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                DEFRA Digital Waste Tracking API
              </CardTitle>
              <CardDescription>
                Credentials used to submit Receipt of Waste records to the government DWT service.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <Radio className="h-3 w-3" /> Sandbox — credentials stored
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={profile.dwt_environment ?? "sandbox"}
                onChange={(e) => set("dwt_environment", e.target.value)}
              >
                <option value="sandbox">Sandbox (Integration)</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>API Base URL</Label>
              <Input
                value={profile.dwt_api_base_url ?? ""}
                onChange={(e) => set("dwt_api_base_url", e.target.value)}
                placeholder="https://waste-tracking.integration.api.defra.gov.uk"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Client ID</Label>
              <Input
                value={profile.dwt_client_id ?? ""}
                onChange={(e) => set("dwt_client_id", e.target.value)}
                placeholder="Client ID issued by DEFRA"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Client Secret</Label>
              <Input value="•••••••••••••••••••••••••••••••••••••••••••••" readOnly className="bg-muted/40 font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">
                Stored securely as backend secret <code>DWT_CLIENT_SECRET</code>. Ask an admin to rotate via secrets manager.
              </p>
            </div>
          </div>


          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription className="space-y-1 text-xs">
              <p>1. Backend exchanges Client ID + Secret for an access token.</p>
              <p>2. Access token authorises Receipt of Waste submissions from Digital Waste Tracking.</p>
              <p>3. Switch to production credentials once sandbox validation is complete.</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="https://defra.github.io/waste-tracking-service/test/api-specification/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  API specification <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://defra.github.io/waste-tracking-service/test/api-authentication-guide/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Authentication guide <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href="https://defra.github.io/waste-tracking-service/test/api-testing-and-examples/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Testing examples <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </AlertDescription>
          </Alert>
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
