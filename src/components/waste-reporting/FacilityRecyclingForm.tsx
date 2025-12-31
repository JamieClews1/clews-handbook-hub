import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save, Send, Link, Plus, Trash2, Recycle, Loader2 } from "lucide-react";
import clewsLogo from "@/assets/clews-logo.png";

interface WasteEntry {
  id?: string;
  waste_type: string;
  ewc_code: string;
  percent_recycled: number;
  percent_recovered: number;
  percent_landfill: number;
  final_destination_info: string;
  display_order: number;
}

interface FormData {
  id?: string;
  form_date: string;
  facility_name: string;
  company_name: string;
  wml_license_number: string;
  completed_by: string;
  average_recycling_rate: number;
  average_recovery_rate: number;
  can_skips_be_weighed: string;
  skips_weighed_notes: string;
  can_waste_breakdown_per_skip: string;
  waste_breakdown_notes: string;
  desktop_audit: boolean;
  visual_audit: boolean;
  desktop_audit_completed_by: string;
  desktop_audit_checked_by: string;
  additional_comments: string;
  status: string;
  share_token?: string;
}

interface FacilityRecyclingFormProps {
  formId?: string;
  shareToken?: string;
  readOnly?: boolean;
  onSave?: () => void;
}

const defaultFormData: FormData = {
  form_date: new Date().toISOString().split('T')[0],
  facility_name: "",
  company_name: "Clews Recycling",
  wml_license_number: "",
  completed_by: "",
  average_recycling_rate: 0,
  average_recovery_rate: 0,
  can_skips_be_weighed: "",
  skips_weighed_notes: "",
  can_waste_breakdown_per_skip: "",
  waste_breakdown_notes: "",
  desktop_audit: false,
  visual_audit: false,
  desktop_audit_completed_by: "",
  desktop_audit_checked_by: "",
  additional_comments: "",
  status: "draft",
};

export const FacilityRecyclingForm = ({ formId, shareToken, readOnly = false, onSave }: FacilityRecyclingFormProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [wasteEntries, setWasteEntries] = useState<WasteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (formId || shareToken) {
      loadForm();
    } else {
      loadDefaultWasteTypes();
    }
    checkAdminRole();
  }, [formId, shareToken]);

  const checkAdminRole = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const loadDefaultWasteTypes = async () => {
    const { data, error } = await supabase
      .from('default_waste_types')
      .select('*')
      .order('display_order');

    if (!error && data) {
      setWasteEntries(data.map((wt, index) => ({
        waste_type: wt.waste_type,
        ewc_code: wt.ewc_code || "",
        percent_recycled: 0,
        percent_recovered: 0,
        percent_landfill: 0,
        final_destination_info: "",
        display_order: index,
      })));
    }
  };

  const loadForm = async () => {
    setLoading(true);
    try {
      let query = supabase.from('facility_recycling_forms').select('*');
      
      if (shareToken) {
        query = query.eq('share_token', shareToken);
      } else if (formId) {
        query = query.eq('id', formId);
      }

      const { data: form, error } = await query.maybeSingle();

      if (error) throw error;
      if (!form) {
        toast.error("Form not found");
        return;
      }

      setFormData({
        id: form.id,
        form_date: form.form_date,
        facility_name: form.facility_name,
        company_name: form.company_name,
        wml_license_number: form.wml_license_number || "",
        completed_by: form.completed_by,
        average_recycling_rate: Number(form.average_recycling_rate) || 0,
        average_recovery_rate: Number(form.average_recovery_rate) || 0,
        can_skips_be_weighed: form.can_skips_be_weighed || "",
        skips_weighed_notes: form.skips_weighed_notes || "",
        can_waste_breakdown_per_skip: form.can_waste_breakdown_per_skip || "",
        waste_breakdown_notes: form.waste_breakdown_notes || "",
        desktop_audit: form.desktop_audit || false,
        visual_audit: form.visual_audit || false,
        desktop_audit_completed_by: form.desktop_audit_completed_by || "",
        desktop_audit_checked_by: form.desktop_audit_checked_by || "",
        additional_comments: form.additional_comments || "",
        status: form.status,
        share_token: form.share_token,
      });

      // Load waste entries
      const { data: entries, error: entriesError } = await supabase
        .from('facility_recycling_waste_entries')
        .select('*')
        .eq('form_id', form.id)
        .order('display_order');

      if (!entriesError && entries) {
        setWasteEntries(entries.map(e => ({
          id: e.id,
          waste_type: e.waste_type,
          ewc_code: e.ewc_code || "",
          percent_recycled: Number(e.percent_recycled) || 0,
          percent_recovered: Number(e.percent_recovered) || 0,
          percent_landfill: Number(e.percent_landfill) || 0,
          final_destination_info: e.final_destination_info || "",
          display_order: e.display_order,
        })));
      }
    } catch (error) {
      console.error("Error loading form:", error);
      toast.error("Failed to load form");
    } finally {
      setLoading(false);
    }
  };

  const calculateAverages = () => {
    const validEntries = wasteEntries.filter(e => 
      e.percent_recycled > 0 || e.percent_recovered > 0 || e.percent_landfill > 0
    );
    
    if (validEntries.length === 0) return { recycling: 0, recovery: 0 };

    const totalRecycled = validEntries.reduce((sum, e) => sum + e.percent_recycled, 0);
    const totalRecovered = validEntries.reduce((sum, e) => sum + e.percent_recovered, 0);

    return {
      recycling: Math.round((totalRecycled / validEntries.length) * 100) / 100,
      recovery: Math.round((totalRecovered / validEntries.length) * 100) / 100,
    };
  };

  const handleSave = async (submit = false) => {
    if (!user) {
      toast.error("Please log in to save");
      return;
    }

    if (!formData.facility_name || !formData.completed_by) {
      toast.error("Please fill in required fields");
      return;
    }

    setSaving(true);
    try {
      const averages = calculateAverages();
      const formPayload = {
        form_date: formData.form_date,
        facility_name: formData.facility_name,
        company_name: formData.company_name,
        wml_license_number: formData.wml_license_number || null,
        completed_by: formData.completed_by,
        average_recycling_rate: averages.recycling,
        average_recovery_rate: averages.recovery,
        can_skips_be_weighed: formData.can_skips_be_weighed || null,
        skips_weighed_notes: formData.skips_weighed_notes || null,
        can_waste_breakdown_per_skip: formData.can_waste_breakdown_per_skip || null,
        waste_breakdown_notes: formData.waste_breakdown_notes || null,
        desktop_audit: formData.desktop_audit,
        visual_audit: formData.visual_audit,
        desktop_audit_completed_by: formData.desktop_audit_completed_by || null,
        desktop_audit_checked_by: formData.desktop_audit_checked_by || null,
        additional_comments: formData.additional_comments || null,
        status: submit ? 'submitted' : formData.status,
        submitted_at: submit ? new Date().toISOString() : null,
        created_by: user.id,
      };

      let savedFormId = formData.id;

      if (formData.id) {
        const { error } = await supabase
          .from('facility_recycling_forms')
          .update(formPayload)
          .eq('id', formData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('facility_recycling_forms')
          .insert(formPayload)
          .select()
          .single();
        if (error) throw error;
        savedFormId = data.id;
        setFormData(prev => ({ ...prev, id: data.id, share_token: data.share_token }));
      }

      // Delete existing entries and insert new ones
      if (savedFormId) {
        await supabase
          .from('facility_recycling_waste_entries')
          .delete()
          .eq('form_id', savedFormId);

        const entriesPayload = wasteEntries.map((entry, index) => ({
          form_id: savedFormId,
          waste_type: entry.waste_type,
          ewc_code: entry.ewc_code || null,
          percent_recycled: entry.percent_recycled,
          percent_recovered: entry.percent_recovered,
          percent_landfill: entry.percent_landfill,
          final_destination_info: entry.final_destination_info || null,
          display_order: index,
        }));

        if (entriesPayload.length > 0) {
          const { error } = await supabase
            .from('facility_recycling_waste_entries')
            .insert(entriesPayload);
          if (error) throw error;
        }
      }

      toast.success(submit ? "Form submitted successfully" : "Form saved successfully");
      onSave?.();
    } catch (error) {
      console.error("Error saving form:", error);
      toast.error("Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = () => {
    if (formData.share_token) {
      const shareUrl = `${window.location.origin}/waste-form/${formData.share_token}`;
      navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard");
    } else {
      toast.error("Please save the form first to get a share link");
    }
  };

  const addWasteEntry = () => {
    setWasteEntries([...wasteEntries, {
      waste_type: "",
      ewc_code: "",
      percent_recycled: 0,
      percent_recovered: 0,
      percent_landfill: 0,
      final_destination_info: "",
      display_order: wasteEntries.length,
    }]);
  };

  const removeWasteEntry = (index: number) => {
    setWasteEntries(wasteEntries.filter((_, i) => i !== index));
  };

  const updateWasteEntry = (index: number, field: keyof WasteEntry, value: string | number) => {
    const updated = [...wasteEntries];
    updated[index] = { ...updated[index], [field]: value };
    setWasteEntries(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const averages = calculateAverages();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                <Recycle className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Facility Recycling Form</h1>
                <p className="text-green-100">GoGreen - Think green, Be green</p>
              </div>
            </div>
            <img src={clewsLogo} alt="Clews Recycling" className="h-12 w-auto hidden sm:block" />
          </div>
        </div>
      </Card>

      {/* Facility Info */}
      <Card>
        <CardHeader>
          <CardTitle>Facility Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="form_date">Date *</Label>
            <Input
              id="form_date"
              type="date"
              value={formData.form_date}
              onChange={(e) => setFormData({ ...formData, form_date: e.target.value })}
              disabled={readOnly}
            />
          </div>
          <div>
            <Label htmlFor="facility_name">Facility Name *</Label>
            <Input
              id="facility_name"
              value={formData.facility_name}
              onChange={(e) => setFormData({ ...formData, facility_name: e.target.value })}
              placeholder="e.g., Clews Recycling Hunters Lane"
              disabled={readOnly}
            />
          </div>
          <div>
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              disabled={readOnly}
            />
          </div>
          <div>
            <Label htmlFor="wml_license_number">WML License Number</Label>
            <Input
              id="wml_license_number"
              value={formData.wml_license_number}
              onChange={(e) => setFormData({ ...formData, wml_license_number: e.target.value })}
              placeholder="e.g., 48106"
              disabled={readOnly}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="completed_by">Completed By (Name) *</Label>
            <Input
              id="completed_by"
              value={formData.completed_by}
              onChange={(e) => setFormData({ ...formData, completed_by: e.target.value })}
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Waste Entries Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Waste Type Breakdown</CardTitle>
          {!readOnly && (
            <Button onClick={addWasteEntry} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Waste Type</th>
                  <th className="text-left p-2 font-medium w-24">EWC Code</th>
                  <th className="text-center p-2 font-medium w-20">% Recycled</th>
                  <th className="text-center p-2 font-medium w-20">% Recovered</th>
                  <th className="text-center p-2 font-medium w-20">% Landfill</th>
                  <th className="text-left p-2 font-medium">Final Destination Info</th>
                  {!readOnly && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {wasteEntries.map((entry, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">
                      <Input
                        value={entry.waste_type}
                        onChange={(e) => updateWasteEntry(index, 'waste_type', e.target.value)}
                        placeholder="Waste type"
                        disabled={readOnly}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={entry.ewc_code}
                        onChange={(e) => updateWasteEntry(index, 'ewc_code', e.target.value)}
                        placeholder="XX.XX.XX"
                        disabled={readOnly}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={entry.percent_recycled || ""}
                        onChange={(e) => updateWasteEntry(index, 'percent_recycled', Number(e.target.value))}
                        disabled={readOnly}
                        className="h-8 text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={entry.percent_recovered || ""}
                        onChange={(e) => updateWasteEntry(index, 'percent_recovered', Number(e.target.value))}
                        disabled={readOnly}
                        className="h-8 text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={entry.percent_landfill || ""}
                        onChange={(e) => updateWasteEntry(index, 'percent_landfill', Number(e.target.value))}
                        disabled={readOnly}
                        className="h-8 text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={entry.final_destination_info}
                        onChange={(e) => updateWasteEntry(index, 'final_destination_info', e.target.value)}
                        placeholder="How is it recycled or recovered?"
                        disabled={readOnly}
                        className="h-8"
                      />
                    </td>
                    {!readOnly && (
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWasteEntry(index)}
                          className="h-8 w-8 p-0 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Averages */}
          <div className="mt-4 p-4 bg-muted/50 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Average Recycling Rate:</span>
              <span className="text-green-600 font-bold">{averages.recycling.toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Average Recovery Rate:</span>
              <span className="text-amber-600 font-bold">{averages.recovery.toFixed(2)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Can all skips be weighed?</Label>
              <RadioGroup
                value={formData.can_skips_be_weighed}
                onValueChange={(value) => setFormData({ ...formData, can_skips_be_weighed: value })}
                disabled={readOnly}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="skips-yes" />
                  <Label htmlFor="skips-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="skips-no" />
                  <Label htmlFor="skips-no">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="skips-na" />
                  <Label htmlFor="skips-na">N/A</Label>
                </div>
              </RadioGroup>
              <Input
                placeholder="Notes"
                value={formData.skips_weighed_notes}
                onChange={(e) => setFormData({ ...formData, skips_weighed_notes: e.target.value })}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-3">
              <Label>Can waste breakdown be supplied per skip?</Label>
              <RadioGroup
                value={formData.can_waste_breakdown_per_skip}
                onValueChange={(value) => setFormData({ ...formData, can_waste_breakdown_per_skip: value })}
                disabled={readOnly}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="breakdown-yes" />
                  <Label htmlFor="breakdown-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="breakdown-no" />
                  <Label htmlFor="breakdown-no">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="breakdown-na" />
                  <Label htmlFor="breakdown-na">N/A</Label>
                </div>
              </RadioGroup>
              <Input
                placeholder="Notes"
                value={formData.waste_breakdown_notes}
                onChange={(e) => setFormData({ ...formData, waste_breakdown_notes: e.target.value })}
                disabled={readOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Office Use Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>For Office Use Only</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="desktop_audit"
                  checked={formData.desktop_audit}
                  onCheckedChange={(checked) => setFormData({ ...formData, desktop_audit: !!checked })}
                  disabled={readOnly}
                />
                <Label htmlFor="desktop_audit">Desktop Audit Completed</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="visual_audit"
                  checked={formData.visual_audit}
                  onCheckedChange={(checked) => setFormData({ ...formData, visual_audit: !!checked })}
                  disabled={readOnly}
                />
                <Label htmlFor="visual_audit">Visual Audit Completed</Label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="desktop_audit_completed_by">Desktop Audit Completed By</Label>
                <Input
                  id="desktop_audit_completed_by"
                  value={formData.desktop_audit_completed_by}
                  onChange={(e) => setFormData({ ...formData, desktop_audit_completed_by: e.target.value })}
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label htmlFor="desktop_audit_checked_by">Desktop Audit Checked By</Label>
                <Input
                  id="desktop_audit_checked_by"
                  value={formData.desktop_audit_checked_by}
                  onChange={(e) => setFormData({ ...formData, desktop_audit_checked_by: e.target.value })}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="additional_comments">Additional Comments</Label>
              <Textarea
                id="additional_comments"
                value={formData.additional_comments}
                onChange={(e) => setFormData({ ...formData, additional_comments: e.target.value })}
                disabled={readOnly}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="flex flex-wrap gap-3 justify-end">
          {formData.id && (
            <Button variant="outline" onClick={copyShareLink}>
              <Link className="h-4 w-4 mr-2" />
              Copy Share Link
            </Button>
          )}
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Submit Form
          </Button>
        </div>
      )}

      {/* Version Info */}
      <div className="text-center text-sm text-muted-foreground">
        Version 5 - June 2023
      </div>
    </div>
  );
};
