import { useState, useEffect } from "react";
import { Save, Building2, CreditCard, Shield, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface CompanyProfileData {
  id: string;
  company_name: string;
  trading_name: string | null;
  registered_address: string | null;
  operational_address: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  company_registration_number: string | null;
  date_of_incorporation: string | null;
  vat_number: string | null;
  sic_code: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_swift_bic: string | null;
  credit_terms: string | null;
  waste_carriers_licence_number: string | null;
  waste_carriers_licence_expiry: string | null;
  environment_agency_reference: string | null;
  iso_14001_certified: boolean;
  iso_9001_certified: boolean;
  health_safety_policy: boolean;
  environmental_policy: boolean;
  public_liability_insurance_provider: string | null;
  public_liability_insurance_expiry: string | null;
  employers_liability_insurance_provider: string | null;
  employers_liability_insurance_expiry: string | null;
}

interface CompanyProfileProps {
  isAdmin: boolean;
}

export function CompanyProfile({ isAdmin }: CompanyProfileProps) {
  const [profile, setProfile] = useState<CompanyProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<CompanyProfileData>>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('company_profile')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setProfile(data);
        setFormData(data);
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('company_profile')
        .update(formData)
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, ...formData } as CompanyProfileData);
      setIsEditing(false);
      toast.success("Company profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof CompanyProfileData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading company profile...</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
          <p className="text-muted-foreground">No company profile found</p>
        </CardContent>
      </Card>
    );
  }

  const renderField = (label: string, field: keyof CompanyProfileData, type: 'text' | 'date' | 'email' | 'tel' | 'url' = 'text') => (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      {isEditing ? (
        <Input
          type={type}
          value={formData[field] as string || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          className="bg-background"
        />
      ) : (
        <p className="text-sm font-medium py-2">
          {type === 'date' && profile[field] 
            ? format(new Date(profile[field] as string), 'dd MMM yyyy')
            : (profile[field] as string) || '-'}
        </p>
      )}
    </div>
  );

  const renderSwitch = (label: string, field: keyof CompanyProfileData) => (
    <div className="flex items-center justify-between py-2">
      <Label className="text-sm">{label}</Label>
      {isEditing ? (
        <Switch
          checked={formData[field] as boolean}
          onCheckedChange={(checked) => handleChange(field, checked)}
        />
      ) : (
        <span className={`text-sm font-medium ${profile[field] ? 'text-green-600' : 'text-muted-foreground'}`}>
          {profile[field] ? 'Yes' : 'No'}
        </span>
      )}
    </div>
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Profile
        </CardTitle>
        {isAdmin && (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData(profile);
                    setIsEditing(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="key-info" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="key-info" className="gap-2">
              <Building2 className="h-4 w-4 hidden sm:inline" />
              Key Info
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <CreditCard className="h-4 w-4 hidden sm:inline" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="duty-of-care" className="gap-2">
              <Shield className="h-4 w-4 hidden sm:inline" />
              Duty of Care
            </TabsTrigger>
          </TabsList>

          <TabsContent value="key-info" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderField("Company Name", "company_name")}
              {renderField("Trading Name", "trading_name")}
              {renderField("Company Registration Number", "company_registration_number")}
              {renderField("Date of Incorporation", "date_of_incorporation", "date")}
              {renderField("VAT Number", "vat_number")}
              {renderField("SIC Code", "sic_code")}
            </div>
            <div className="grid grid-cols-1 gap-6">
              {renderField("Registered Address", "registered_address")}
              {renderField("Operational Address", "operational_address")}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {renderField("Telephone", "telephone", "tel")}
              {renderField("Email", "email", "email")}
              {renderField("Website", "website", "url")}
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderField("Bank Name", "bank_name")}
              {renderField("Account Name", "bank_account_name")}
              {renderField("Sort Code", "bank_sort_code")}
              {renderField("Account Number", "bank_account_number")}
              {renderField("IBAN", "bank_iban")}
              {renderField("SWIFT/BIC", "bank_swift_bic")}
            </div>
            <div className="grid grid-cols-1 gap-6">
              {renderField("Credit Terms", "credit_terms")}
            </div>
          </TabsContent>

          <TabsContent value="duty-of-care" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderField("Waste Carriers Licence Number", "waste_carriers_licence_number")}
              {renderField("Waste Carriers Licence Expiry", "waste_carriers_licence_expiry", "date")}
              {renderField("Environment Agency Reference", "environment_agency_reference")}
            </div>
            
            <div className="border-t border-border pt-6">
              <h4 className="font-medium mb-4">Certifications & Policies</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderSwitch("ISO 14001 Certified", "iso_14001_certified")}
                {renderSwitch("ISO 9001 Certified", "iso_9001_certified")}
                {renderSwitch("Health & Safety Policy", "health_safety_policy")}
                {renderSwitch("Environmental Policy", "environmental_policy")}
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h4 className="font-medium mb-4">Insurance Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderField("Public Liability Insurance Provider", "public_liability_insurance_provider")}
                {renderField("Public Liability Expiry", "public_liability_insurance_expiry", "date")}
                {renderField("Employers Liability Insurance Provider", "employers_liability_insurance_provider")}
                {renderField("Employers Liability Expiry", "employers_liability_insurance_expiry", "date")}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
