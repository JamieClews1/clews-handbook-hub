import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Send, Save, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad } from "@/components/SignaturePad";

interface PartnerQuestionnaire {
  id: string;
  share_token: string;
  status: string;
  company_name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  telephone?: string;
  email_orders?: string;
  email_remittances?: string;
  company_registration_number?: string;
  waste_carriers_licence_number?: string;
  vat_number?: string;
  sic_code?: string;
  can_provide_prices_by_postcode?: boolean;
  price_validity_dates?: string;
  services_chain_lifts?: boolean;
  services_enclosed_skips?: boolean;
  services_roll_on_roll_offs?: boolean;
  services_road_sweeper?: boolean;
  services_wheelie_bin?: boolean;
  services_grab_hire?: boolean;
  services_man_in_van?: boolean;
  services_asbestos?: boolean;
  has_waste_carriers_licence?: boolean;
  has_waste_management_licence?: boolean;
  has_employers_liability_insurance?: boolean;
  has_public_liability_insurance?: boolean;
  has_weighbridge_certificate?: boolean;
  has_quarterly_return?: boolean;
  has_epr_car_report?: boolean;
  has_sample_wtn?: boolean;
  transfers_waste_to_other_sites?: boolean;
  waste_transfer_details?: string;
  sheq_responsible_name?: string;
  sheq_responsible_qualification?: string;
  sheq_responsible_email?: string;
  has_emas_certification?: boolean;
  has_iso_9001?: boolean;
  has_iso_14001?: boolean;
  has_bs_8555?: boolean;
  has_health_safety_policy?: boolean;
  has_environmental_policy?: boolean;
  has_modern_slavery_policy?: boolean;
  has_quality_policy?: boolean;
  has_anti_bribery_policy?: boolean;
  has_equality_diversity_policy?: boolean;
  has_gdpr_policy?: boolean;
  has_slavery_investigation?: boolean;
  slavery_investigation_details?: string;
  has_h_and_s_proceedings?: boolean;
  h_and_s_proceedings_details?: string;
  investigates_accidents?: boolean;
  has_riddor_incidents?: boolean;
  riddor_details?: string;
  provides_ppe?: boolean;
  complies_skip_loader_guidance?: boolean;
  complies_skip_container_safety?: boolean;
  complies_loler?: boolean;
  complies_puwer?: boolean;
  has_fors_clocs?: boolean;
  has_pda_system?: boolean;
  provides_risk_assessments?: boolean;
  operating_systems_used?: string;
  provides_weekly_invoices_wtns?: boolean;
  weekly_reporting_notes?: string;
  invoicing_software?: string;
  invoice_day?: string;
  wtn_delivery_method?: string;
  wtn_delivery_timing?: string;
  provides_weights_breakdowns?: boolean;
  weights_breakdowns_format?: string;
  waste_reporting_name?: string;
  waste_reporting_email?: string;
  waste_reporting_phone?: string;
  community_responsible_name?: string;
  community_responsible_email?: string;
  community_responsible_phone?: string;
  has_sustainability_policy?: boolean;
  has_social_value_policy?: boolean;
  has_community_programmes?: boolean;
  community_programme_details?: string;
  has_social_media_policy?: boolean;
  has_whistle_blowing_policy?: boolean;
  has_employee_handbook?: boolean;
  has_minimum_wage_policy?: boolean;
  issues_zero_hour_contracts?: boolean;
  zero_hour_explanation?: string;
  signatory_name?: string;
  signatory_position?: string;
  signatory_signature?: string;
  signed_at?: string;
  reviewed_by?: string;
  reviewed_signature?: string;
  reviewed_position?: string;
  reviewed_at?: string;
  partner_ranking?: string;
  additional_notes?: string;
  submitted_at?: string;
  partner_id?: string;
}

interface Props {
  questionnaireId?: string;
  shareToken?: string;
  isPublic?: boolean;
  isAdmin?: boolean;
  onBack?: () => void;
  onSaved?: () => void;
}

export function PartnerQuestionnaireForm({ questionnaireId, shareToken, isPublic = false, isAdmin = false, onBack, onSaved }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<PartnerQuestionnaire>>({
    company_name: '',
    status: 'pending'
  });
  const [showSignature, setShowSignature] = useState(false);
  const [showReviewSignature, setShowReviewSignature] = useState(false);

  useEffect(() => {
    loadQuestionnaire();
  }, [questionnaireId, shareToken]);

  const loadQuestionnaire = async () => {
    if (!questionnaireId && !shareToken) {
      setIsLoading(false);
      return;
    }

    try {
      // Public token access goes through a service-role edge function so the
      // table itself stays locked down to authenticated staff.
      if (!questionnaireId && shareToken) {
        const { data: result, error } = await supabase.functions.invoke('public-forms', {
          body: { action: 'get', resource: 'partner_questionnaires', token: shareToken },
        });
        if (error) throw error;
        if (result?.record) setFormData(result.record);
        return;
      }

      const { data, error } = await supabase
        .from('partner_questionnaires')
        .select('*')
        .eq('id', questionnaireId!)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFormData(data);
      }
    } catch (error: any) {
      toast.error("Failed to load questionnaire");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: keyof PartnerQuestionnaire, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (submit = false) => {
    if (!formData.company_name?.trim()) {
      toast.error("Company name is required");
      return;
    }

    if (submit && !formData.signatory_name) {
      toast.error("Please sign the questionnaire before submitting");
      return;
    }

    setIsSaving(true);
    try {
      if (formData.id) {
        const { error } = await supabase
          .from('partner_questionnaires')
          .update({
            ...formData,
            status: submit ? 'submitted' : formData.status,
            submitted_at: submit ? new Date().toISOString() : formData.submitted_at
          })
          .eq('id', formData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('partner_questionnaires')
          .insert({
            company_name: formData.company_name!,
            ...formData,
            status: submit ? 'submitted' : 'pending',
            submitted_at: submit ? new Date().toISOString() : undefined
          })
          .select()
          .single();
        if (error) throw error;
        setFormData(data);
      }

      toast.success(submit ? "Questionnaire submitted successfully" : "Questionnaire saved");
      onSaved?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to save questionnaire");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminReview = async (ranking: string) => {
    if (!formData.reviewed_by || !formData.reviewed_signature) {
      toast.error("Please complete the review signature");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('partner_questionnaires')
        .update({
          status: 'reviewed',
          partner_ranking: ranking,
          reviewed_at: new Date().toISOString(),
          reviewed_by: formData.reviewed_by,
          reviewed_position: formData.reviewed_position,
          reviewed_signature: formData.reviewed_signature,
          additional_notes: formData.additional_notes
        })
        .eq('id', formData.id);

      if (error) throw error;
      toast.success("Review completed");
      onSaved?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to save review");
    } finally {
      setIsSaving(false);
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/partner-questionnaire/${formData.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  };

  const handleSignature = (signature: string) => {
    updateField('signatory_signature', signature);
    updateField('signed_at', new Date().toISOString());
    setShowSignature(false);
  };

  const handleReviewSignature = (signature: string) => {
    updateField('reviewed_signature', signature);
    setShowReviewSignature(false);
  };

  const isSubmitted = formData.status !== 'pending';
  // Admins can always edit, public users can only edit pending forms
  const isReadOnly = isPublic && isSubmitted;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const CheckboxField = ({ field, label, disabled = false }: { field: keyof PartnerQuestionnaire; label: string; disabled?: boolean }) => (
    <div className="flex items-center gap-3">
      <Checkbox 
        id={field}
        checked={!!formData[field]} 
        onCheckedChange={(checked) => updateField(field, checked)}
        disabled={disabled || isReadOnly}
      />
      <Label htmlFor={field} className="text-sm cursor-pointer">{label}</Label>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      {!isPublic && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {formData.id ? 'Edit Questionnaire' : 'New Partner Questionnaire'}
              </h2>
              {formData.id && (
                <Badge variant={formData.status === 'submitted' ? 'default' : formData.status === 'reviewed' ? 'secondary' : 'outline'}>
                  {formData.status?.charAt(0).toUpperCase() + formData.status?.slice(1)}
                </Badge>
              )}
            </div>
          </div>
          {formData.share_token && (
            <Button variant="outline" size="sm" onClick={copyShareLink} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy Share Link
            </Button>
          )}
        </div>
      )}

      {isPublic && (
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Partner Onboarding Questionnaire</h1>
          <p className="text-muted-foreground mt-2">Please complete all sections below to register as a partner</p>
          {isSubmitted && (
            <Badge variant="secondary" className="mt-4">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Submitted {formData.submitted_at ? `on ${new Date(formData.submitted_at).toLocaleDateString()}` : ''}
            </Badge>
          )}
        </div>
      )}

      {/* Section 1: Company Details */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Section 1 – Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input 
                value={formData.company_name || ''} 
                onChange={(e) => updateField('company_name', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Telephone Number</Label>
              <Input 
                value={formData.telephone || ''} 
                onChange={(e) => updateField('telephone', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input 
                value={formData.address_line1 || ''} 
                onChange={(e) => updateField('address_line1', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Address Line 2</Label>
              <Input 
                value={formData.address_line2 || ''} 
                onChange={(e) => updateField('address_line2', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input 
                value={formData.city || ''} 
                onChange={(e) => updateField('city', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input 
                value={formData.postcode || ''} 
                onChange={(e) => updateField('postcode', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email for Purchase Orders</Label>
              <Input 
                type="email"
                value={formData.email_orders || ''} 
                onChange={(e) => updateField('email_orders', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Email for Remittances</Label>
              <Input 
                type="email"
                value={formData.email_remittances || ''} 
                onChange={(e) => updateField('email_remittances', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Company Registration No.</Label>
              <Input 
                value={formData.company_registration_number || ''} 
                onChange={(e) => updateField('company_registration_number', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Waste Carriers Licence No.</Label>
              <Input 
                value={formData.waste_carriers_licence_number || ''} 
                onChange={(e) => updateField('waste_carriers_licence_number', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>VAT Number</Label>
              <Input 
                value={formData.vat_number || ''} 
                onChange={(e) => updateField('vat_number', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>SIC Code</Label>
              <Input 
                value={formData.sic_code || ''} 
                onChange={(e) => updateField('sic_code', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Services Summary */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Section 2 – Services Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <CheckboxField field="can_provide_prices_by_postcode" label="Can you provide prices by postcode or map?" />
          </div>
          {formData.can_provide_prices_by_postcode && (
            <div className="space-y-2 ml-7">
              <Label>Price validity dates</Label>
              <Input 
                value={formData.price_validity_dates || ''} 
                onChange={(e) => updateField('price_validity_dates', e.target.value)}
                placeholder="Please advise validity dates"
                disabled={isReadOnly}
              />
            </div>
          )}
          
          <Separator />
          
          <div>
            <Label className="text-base font-medium mb-3 block">Do you supply the following services?</Label>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <CheckboxField field="services_chain_lifts" label="Chain Lifts" />
              <CheckboxField field="services_enclosed_skips" label="Enclosed Skips" />
              <CheckboxField field="services_roll_on_roll_offs" label="Roll On Roll Offs" />
              <CheckboxField field="services_road_sweeper" label="Road Sweeper" />
              <CheckboxField field="services_wheelie_bin" label="Wheelie Bin" />
              <CheckboxField field="services_grab_hire" label="Grab Hire" />
              <CheckboxField field="services_man_in_van" label="Man in Van/Caged Vehicle" />
              <CheckboxField field="services_asbestos" label="Asbestos" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Supplier Compliance */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Section 3 – Supplier Compliance</CardTitle>
          <CardDescription>Please confirm you can supply the following documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <CheckboxField field="has_waste_carriers_licence" label="Waste Carriers Licence" />
            <CheckboxField field="has_waste_management_licence" label="Waste Management Licence" />
            <CheckboxField field="has_employers_liability_insurance" label="Employers Liability Insurance" />
            <CheckboxField field="has_public_liability_insurance" label="Public Liability Insurance" />
            <CheckboxField field="has_weighbridge_certificate" label="Current Weighbridge Certificate" />
            <CheckboxField field="has_quarterly_return" label="Quarterly Return for Materials Recycling" />
            <CheckboxField field="has_epr_car_report" label="Latest EPR Compliance Assessment Report (CAR)" />
            <CheckboxField field="has_sample_wtn" label="An example of your Waste Transfer Note (WTN)" />
          </div>
          
          <Separator />
          
          <CheckboxField field="transfers_waste_to_other_sites" label="Do you transfer waste and recovered material to other sites?" />
          {formData.transfers_waste_to_other_sites && (
            <div className="space-y-2 ml-7">
              <Label>Please provide operator details, postcode and licence</Label>
              <Textarea 
                value={formData.waste_transfer_details || ''} 
                onChange={(e) => updateField('waste_transfer_details', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: SHEQ */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Section 4 – Health, Safety, Environmental and Quality (SHEQ)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-medium mb-3 block">Who is responsible for Health & Safety?</Label>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input 
                  value={formData.sheq_responsible_name || ''} 
                  onChange={(e) => updateField('sheq_responsible_name', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Qualification(s)</Label>
                <Input 
                  value={formData.sheq_responsible_qualification || ''} 
                  onChange={(e) => updateField('sheq_responsible_qualification', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={formData.sheq_responsible_email || ''} 
                  onChange={(e) => updateField('sheq_responsible_email', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-base font-medium mb-3 block">Environmental Management System certifications</Label>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <CheckboxField field="has_emas_certification" label="EMAS by UKAS" />
              <CheckboxField field="has_iso_9001" label="ISO 9001" />
              <CheckboxField field="has_iso_14001" label="ISO 14001" />
              <CheckboxField field="has_bs_8555" label="BS 8555" />
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-base font-medium mb-3 block">Can you provide copies of the following policies? (signed and dated within the last 18 months)</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <CheckboxField field="has_health_safety_policy" label="Health & Safety Policy" />
              <CheckboxField field="has_environmental_policy" label="Environmental Policy" />
              <CheckboxField field="has_modern_slavery_policy" label="Modern Slavery Policy" />
              <CheckboxField field="has_quality_policy" label="Quality Policy" />
              <CheckboxField field="has_anti_bribery_policy" label="Anti-Bribery & Corruption Policy" />
              <CheckboxField field="has_equality_diversity_policy" label="Equality & Diversity Policy" />
              <CheckboxField field="has_gdpr_policy" label="GDPR Policy" />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <CheckboxField field="has_slavery_investigation" label="Has your organisation been subject to any investigation regarding slavery and human trafficking?" />
            {formData.has_slavery_investigation && (
              <div className="space-y-2 ml-7">
                <Label>Please supply details and actions taken</Label>
                <Textarea 
                  value={formData.slavery_investigation_details || ''} 
                  onChange={(e) => updateField('slavery_investigation_details', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            )}

            <CheckboxField field="has_h_and_s_proceedings" label="Has your company been involved in H&S proceedings/prosecution in the last 5 years?" />
            {formData.has_h_and_s_proceedings && (
              <div className="space-y-2 ml-7">
                <Label>Please supply details and actions taken</Label>
                <Textarea 
                  value={formData.h_and_s_proceedings_details || ''} 
                  onChange={(e) => updateField('h_and_s_proceedings_details', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            )}

            <CheckboxField field="investigates_accidents" label="Do you investigate accidents, incidents and near misses and report to RIDDOR if required?" />
            
            <CheckboxField field="has_riddor_incidents" label="Have you had any RIDDOR reportable incidents in the last 3 years?" />
            {formData.has_riddor_incidents && (
              <div className="space-y-2 ml-7">
                <Label>Please supply details</Label>
                <Textarea 
                  value={formData.riddor_details || ''} 
                  onChange={(e) => updateField('riddor_details', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            )}

            <CheckboxField field="provides_ppe" label="Is Personal Protective Equipment (PPE) provided to staff onsite?" />
            <CheckboxField field="complies_skip_loader_guidance" label="Do you comply with HSE guidance for safe use of skip loaders?" />
            <CheckboxField field="complies_skip_container_safety" label="Do you comply with Skip and Container Safety in Waste Management & Recycling?" />
            <CheckboxField field="complies_loler" label="Do you comply with LOLER Regulations?" />
            <CheckboxField field="complies_puwer" label="Do you comply with PUWER Regulations?" />
            <CheckboxField field="has_fors_clocs" label="Do you have FORS/CLOCS?" />
            <CheckboxField field="has_pda_system" label="Do you have a PDA system for Waste Transfer Notes?" />
            <CheckboxField field="provides_risk_assessments" label="Can you provide copies of Risk Assessments and/or Method Statements?" />
          </div>

          <div className="space-y-2">
            <Label>Please provide the name(s) of the operating systems you use</Label>
            <Input 
              value={formData.operating_systems_used || ''} 
              onChange={(e) => updateField('operating_systems_used', e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          <CheckboxField field="provides_weekly_invoices_wtns" label="Are you able to provide invoices/copy WTNs and waste reports on a weekly basis?" />
          <div className="space-y-2 ml-7">
            <Label>Additional notes on reporting</Label>
            <Textarea 
              value={formData.weekly_reporting_notes || ''} 
              onChange={(e) => updateField('weekly_reporting_notes', e.target.value)}
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Invoicing */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Section 5 – Invoicing Information</CardTitle>
          <CardDescription>For invoices to be processed efficiently, WTNs, Invoices and Weighbridge Tickets should be sent together where possible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Software/CRM you use</Label>
              <Input 
                value={formData.invoicing_software || ''} 
                onChange={(e) => updateField('invoicing_software', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>What day/date are invoices issued?</Label>
              <Input 
                value={formData.invoice_day || ''} 
                onChange={(e) => updateField('invoice_day', e.target.value)}
                placeholder="e.g., Weekly, 1st of month"
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>How will WTNs be issued?</Label>
              <Input 
                value={formData.wtn_delivery_method || ''} 
                onChange={(e) => updateField('wtn_delivery_method', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>When will WTNs be supplied?</Label>
              <Input 
                value={formData.wtn_delivery_timing || ''} 
                onChange={(e) => updateField('wtn_delivery_timing', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
          <CheckboxField field="provides_weights_breakdowns" label="Are you able to provide weights and breakdowns for all skips?" />
          {formData.provides_weights_breakdowns && (
            <div className="space-y-2 ml-7">
              <Label>When and in what format?</Label>
              <Input 
                value={formData.weights_breakdowns_format || ''} 
                onChange={(e) => updateField('weights_breakdowns_format', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          )}

          <Separator />

          <div>
            <Label className="text-base font-medium mb-3 block">Who is responsible for Waste Reporting?</Label>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input 
                  value={formData.waste_reporting_name || ''} 
                  onChange={(e) => updateField('waste_reporting_name', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={formData.waste_reporting_email || ''} 
                  onChange={(e) => updateField('waste_reporting_email', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  value={formData.waste_reporting_phone || ''} 
                  onChange={(e) => updateField('waste_reporting_phone', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Responsible Business */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Section 6 – Responsible Business</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-base font-medium mb-3 block">Who is responsible for community and environment projects?</Label>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input 
                  value={formData.community_responsible_name || ''} 
                  onChange={(e) => updateField('community_responsible_name', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={formData.community_responsible_email || ''} 
                  onChange={(e) => updateField('community_responsible_email', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  value={formData.community_responsible_phone || ''} 
                  onChange={(e) => updateField('community_responsible_phone', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <CheckboxField field="has_sustainability_policy" label="Do you have a Sustainability or Corporate Responsibility Policy?" />
            <CheckboxField field="has_social_value_policy" label="Do you have a Social Value Policy?" />
            <CheckboxField field="has_community_programmes" label="Do you have programmes involving local community interaction (sponsorship, charities)?" />
            {formData.has_community_programmes && (
              <div className="space-y-2 ml-7">
                <Label>Please provide examples</Label>
                <Textarea 
                  value={formData.community_programme_details || ''} 
                  onChange={(e) => updateField('community_programme_details', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            )}
            <CheckboxField field="has_social_media_policy" label="Do you have a Social Media Policy?" />
            <CheckboxField field="has_whistle_blowing_policy" label="Do you have a Whistle Blowing Policy?" />
            <CheckboxField field="has_employee_handbook" label="Do you have a Company/Employee Handbook?" />
            <CheckboxField field="has_minimum_wage_policy" label="Do you have a policy to ensure compliance with national minimum wage legislation?" />
            <CheckboxField field="issues_zero_hour_contracts" label="Do you issue zero-hour contracts?" />
            {formData.issues_zero_hour_contracts && (
              <div className="space-y-2 ml-7">
                <Label>Please explain why</Label>
                <Textarea 
                  value={formData.zero_hour_explanation || ''} 
                  onChange={(e) => updateField('zero_hour_explanation', e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Signature Section */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Declaration & Signature</CardTitle>
          <CardDescription>
            Please sign to acknowledge that you have fully completed the above and are able to provide all relevant documentation.
            You must notify us of any changes to the above circumstances or documentation within 10 working days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name (please print) *</Label>
              <Input 
                value={formData.signatory_name || ''} 
                onChange={(e) => updateField('signatory_name', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Position in Company *</Label>
              <Input 
                value={formData.signatory_position || ''} 
                onChange={(e) => updateField('signatory_position', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
          </div>
          
          {formData.signatory_signature ? (
            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="border rounded-lg p-4 bg-muted/50">
                <img src={formData.signatory_signature} alt="Signature" className="max-h-20" />
                <p className="text-xs text-muted-foreground mt-2">
                  Signed on {formData.signed_at ? new Date(formData.signed_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              {!isReadOnly && (
                <Button variant="outline" size="sm" onClick={() => setShowSignature(true)}>
                  Re-sign
                </Button>
              )}
            </div>
          ) : (
            !isReadOnly && (
              <Button variant="outline" onClick={() => setShowSignature(true)}>
                Add Signature
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {/* Office Use Only - Admin Section */}
      {isAdmin && formData.status !== 'pending' && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-lg text-amber-600">Office Use Only</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reviewed By</Label>
                <Input 
                  value={formData.reviewed_by || ''} 
                  onChange={(e) => updateField('reviewed_by', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Input 
                  value={formData.reviewed_position || ''} 
                  onChange={(e) => updateField('reviewed_position', e.target.value)}
                />
              </div>
            </div>

            {formData.reviewed_signature ? (
              <div className="space-y-2">
                <Label>Reviewer Signature</Label>
                <div className="border rounded-lg p-4 bg-background">
                  <img src={formData.reviewed_signature} alt="Reviewer Signature" className="max-h-20" />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowReviewSignature(true)}>
                  Re-sign
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setShowReviewSignature(true)}>
                Add Review Signature
              </Button>
            )}

            <div className="space-y-2">
              <Label>Partner Ranking</Label>
              <Select value={formData.partner_ranking || ''} onValueChange={(v) => updateField('partner_ranking', v)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea 
                value={formData.additional_notes || ''} 
                onChange={(e) => updateField('additional_notes', e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleAdminReview(formData.partner_ranking || 'B')} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Complete Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex flex-wrap gap-3 justify-end pt-4">
          {isAdmin && isSubmitted ? (
            <Button onClick={() => handleSave(false)} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          ) : !isSubmitted ? (
            <>
              <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              <Button onClick={() => handleSave(true)} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Questionnaire
              </Button>
            </>
          ) : null}
        </div>
      )}

      {/* Signature Modal */}
      {showSignature && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-lg w-full">
            <SignaturePad
              onSave={handleSignature}
              onCancel={() => setShowSignature(false)}
            />
          </div>
        </div>
      )}

      {showReviewSignature && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-lg w-full">
            <SignaturePad
              onSave={handleReviewSignature}
              onCancel={() => setShowReviewSignature(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
