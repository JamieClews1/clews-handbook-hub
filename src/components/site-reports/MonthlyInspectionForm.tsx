import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Save, Send, CheckCircle, AlertTriangle, XCircle, MinusCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import InspectionTodoList, { generateTodoItems } from "./InspectionTodoList";

interface TodoItem {
  id: string;
  category: string;
  item: string;
  priority: 'high' | 'medium';
  comment?: string;
  completed: boolean;
}

type Rating = 'good' | 'acceptable' | 'poor' | 'n/a' | null;

interface FormData {
  id?: string;
  report_date: string;
  site_location: string;
  inspector_name: string;
  
  // Housekeeping
  housekeeping_general_cleanliness: Rating;
  housekeeping_waste_disposal: Rating;
  housekeeping_storage_areas: Rating;
  housekeeping_walkways_clear: Rating;
  housekeeping_comments: string;
  
  // Fire Safety
  fire_extinguishers_accessible: Rating;
  fire_exits_clear: Rating;
  fire_signage_visible: Rating;
  fire_assembly_point_clear: Rating;
  fire_safety_comments: string;
  
  // First Aid
  first_aid_kit_stocked: Rating;
  first_aid_signage: Rating;
  first_aid_trained_personnel: Rating;
  first_aid_comments: string;
  
  // PPE
  ppe_available: Rating;
  ppe_condition: Rating;
  ppe_being_worn: Rating;
  ppe_comments: string;
  
  // Equipment
  equipment_condition: Rating;
  equipment_guarding: Rating;
  equipment_maintenance_records: Rating;
  equipment_comments: string;
  
  // Electrical
  electrical_equipment_condition: Rating;
  electrical_cables_secure: Rating;
  electrical_pat_testing: Rating;
  electrical_comments: string;
  
  // Welfare
  welfare_toilets_clean: Rating;
  welfare_drinking_water: Rating;
  welfare_rest_areas: Rating;
  welfare_comments: string;
  
  // Environmental
  environmental_spill_kits: Rating;
  environmental_waste_segregation: Rating;
  environmental_drainage: Rating;
  environmental_comments: string;
  
  // Actions
  actions_required: string;
  overall_comments: string;
  signature_image: string;
  status: string;
  
  // Todo items (stored as JSON)
  todo_items?: TodoItem[];
}

const defaultFormData: FormData = {
  report_date: new Date().toISOString().split('T')[0],
  site_location: "",
  inspector_name: "",
  housekeeping_general_cleanliness: null,
  housekeeping_waste_disposal: null,
  housekeeping_storage_areas: null,
  housekeeping_walkways_clear: null,
  housekeeping_comments: "",
  fire_extinguishers_accessible: null,
  fire_exits_clear: null,
  fire_signage_visible: null,
  fire_assembly_point_clear: null,
  fire_safety_comments: "",
  first_aid_kit_stocked: null,
  first_aid_signage: null,
  first_aid_trained_personnel: null,
  first_aid_comments: "",
  ppe_available: null,
  ppe_condition: null,
  ppe_being_worn: null,
  ppe_comments: "",
  equipment_condition: null,
  equipment_guarding: null,
  equipment_maintenance_records: null,
  equipment_comments: "",
  electrical_equipment_condition: null,
  electrical_cables_secure: null,
  electrical_pat_testing: null,
  electrical_comments: "",
  welfare_toilets_clean: null,
  welfare_drinking_water: null,
  welfare_rest_areas: null,
  welfare_comments: "",
  environmental_spill_kits: null,
  environmental_waste_segregation: null,
  environmental_drainage: null,
  environmental_comments: "",
  actions_required: "",
  overall_comments: "",
  signature_image: "",
  status: "draft",
  todo_items: [],
};

interface RatingFieldProps {
  label: string;
  value: Rating;
  onChange: (value: Rating) => void;
}

const RatingField = ({ label, value, onChange }: RatingFieldProps) => {
  const options: { value: Rating; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'good', label: 'Good', icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
    { value: 'acceptable', label: 'Acceptable', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-amber-600' },
    { value: 'poor', label: 'Poor', icon: <XCircle className="h-4 w-4" />, color: 'text-red-600' },
    { value: 'n/a', label: 'N/A', icon: <MinusCircle className="h-4 w-4" />, color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup
        value={value || ""}
        onValueChange={(v) => onChange(v as Rating)}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center">
            <RadioGroupItem
              value={option.value!}
              id={`${label}-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`${label}-${option.value}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg cursor-pointer transition-all
                peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10
                hover:bg-muted ${option.color}`}
            >
              {option.icon}
              <span className="hidden sm:inline">{option.label}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

interface MonthlyInspectionFormProps {
  reportId?: string;
  onSave?: () => void;
}

export default function MonthlyInspectionForm({ reportId, onSave }: MonthlyInspectionFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [currentPart, setCurrentPart] = useState<1 | 2>(1);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);

  useEffect(() => {
    if (reportId) {
      loadReport(reportId);
    }
  }, [reportId]);

  useEffect(() => {
    // Pre-fill inspector name from profile
    const loadProfile = async () => {
      if (user && !formData.inspector_name) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (data?.full_name) {
          setFormData(prev => ({ ...prev, inspector_name: data.full_name }));
        }
      }
    };
    loadProfile();
  }, [user]);

  const loadReport = async (id: string) => {
    const { data, error } = await supabase
      .from('site_inspection_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast.error("Failed to load report");
      return;
    }

    if (data) {
      setFormData({
        id: data.id,
        report_date: data.report_date,
        site_location: data.site_location,
        inspector_name: data.inspector_name,
        housekeeping_general_cleanliness: data.housekeeping_general_cleanliness as Rating,
        housekeeping_waste_disposal: data.housekeeping_waste_disposal as Rating,
        housekeeping_storage_areas: data.housekeeping_storage_areas as Rating,
        housekeeping_walkways_clear: data.housekeeping_walkways_clear as Rating,
        housekeeping_comments: data.housekeeping_comments || "",
        fire_extinguishers_accessible: data.fire_extinguishers_accessible as Rating,
        fire_exits_clear: data.fire_exits_clear as Rating,
        fire_signage_visible: data.fire_signage_visible as Rating,
        fire_assembly_point_clear: data.fire_assembly_point_clear as Rating,
        fire_safety_comments: data.fire_safety_comments || "",
        first_aid_kit_stocked: data.first_aid_kit_stocked as Rating,
        first_aid_signage: data.first_aid_signage as Rating,
        first_aid_trained_personnel: data.first_aid_trained_personnel as Rating,
        first_aid_comments: data.first_aid_comments || "",
        ppe_available: data.ppe_available as Rating,
        ppe_condition: data.ppe_condition as Rating,
        ppe_being_worn: data.ppe_being_worn as Rating,
        ppe_comments: data.ppe_comments || "",
        equipment_condition: data.equipment_condition as Rating,
        equipment_guarding: data.equipment_guarding as Rating,
        equipment_maintenance_records: data.equipment_maintenance_records as Rating,
        equipment_comments: data.equipment_comments || "",
        electrical_equipment_condition: data.electrical_equipment_condition as Rating,
        electrical_cables_secure: data.electrical_cables_secure as Rating,
        electrical_pat_testing: data.electrical_pat_testing as Rating,
        electrical_comments: data.electrical_comments || "",
        welfare_toilets_clean: data.welfare_toilets_clean as Rating,
        welfare_drinking_water: data.welfare_drinking_water as Rating,
        welfare_rest_areas: data.welfare_rest_areas as Rating,
        welfare_comments: data.welfare_comments || "",
        environmental_spill_kits: data.environmental_spill_kits as Rating,
        environmental_waste_segregation: data.environmental_waste_segregation as Rating,
        environmental_drainage: data.environmental_drainage as Rating,
        environmental_comments: data.environmental_comments || "",
        actions_required: data.actions_required || "",
        overall_comments: data.overall_comments || "",
        signature_image: data.signature_image || "",
        status: data.status,
        todo_items: [],
      });
      
      // Load todo items if they exist (cast to any to handle types before regeneration)
      const reportData = data as unknown as { todo_items?: TodoItem[] };
      if (reportData.todo_items && Array.isArray(reportData.todo_items)) {
        setTodoItems(reportData.todo_items);
      }
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (submit = false) => {
    if (!user) {
      toast.error("Please log in to save");
      return;
    }

    if (!formData.site_location || !formData.inspector_name) {
      toast.error("Please fill in site location and inspector name");
      return;
    }

    if (submit && !formData.signature_image) {
      toast.error("Please add your signature before submitting");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        report_date: formData.report_date,
        site_location: formData.site_location,
        inspector_name: formData.inspector_name,
        housekeeping_general_cleanliness: formData.housekeeping_general_cleanliness,
        housekeeping_waste_disposal: formData.housekeeping_waste_disposal,
        housekeeping_storage_areas: formData.housekeeping_storage_areas,
        housekeeping_walkways_clear: formData.housekeeping_walkways_clear,
        housekeeping_comments: formData.housekeeping_comments || null,
        fire_extinguishers_accessible: formData.fire_extinguishers_accessible,
        fire_exits_clear: formData.fire_exits_clear,
        fire_signage_visible: formData.fire_signage_visible,
        fire_assembly_point_clear: formData.fire_assembly_point_clear,
        fire_safety_comments: formData.fire_safety_comments || null,
        first_aid_kit_stocked: formData.first_aid_kit_stocked,
        first_aid_signage: formData.first_aid_signage,
        first_aid_trained_personnel: formData.first_aid_trained_personnel,
        first_aid_comments: formData.first_aid_comments || null,
        ppe_available: formData.ppe_available,
        ppe_condition: formData.ppe_condition,
        ppe_being_worn: formData.ppe_being_worn,
        ppe_comments: formData.ppe_comments || null,
        equipment_condition: formData.equipment_condition,
        equipment_guarding: formData.equipment_guarding,
        equipment_maintenance_records: formData.equipment_maintenance_records,
        equipment_comments: formData.equipment_comments || null,
        electrical_equipment_condition: formData.electrical_equipment_condition,
        electrical_cables_secure: formData.electrical_cables_secure,
        electrical_pat_testing: formData.electrical_pat_testing,
        electrical_comments: formData.electrical_comments || null,
        welfare_toilets_clean: formData.welfare_toilets_clean,
        welfare_drinking_water: formData.welfare_drinking_water,
        welfare_rest_areas: formData.welfare_rest_areas,
        welfare_comments: formData.welfare_comments || null,
        environmental_spill_kits: formData.environmental_spill_kits,
        environmental_waste_segregation: formData.environmental_waste_segregation,
        environmental_drainage: formData.environmental_drainage,
        environmental_comments: formData.environmental_comments || null,
        actions_required: formData.actions_required || null,
        overall_comments: formData.overall_comments || null,
        signature_image: formData.signature_image || null,
        status: submit ? 'submitted' : 'draft',
        submitted_at: submit ? new Date().toISOString() : null,
        todo_items: todoItems,
      } as Record<string, unknown>;

      let savedId = formData.id;

      if (formData.id) {
        const { error } = await supabase
          .from('site_inspection_reports')
          .update(payload as never)
          .eq('id', formData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('site_inspection_reports')
          .insert(payload as never)
          .select()
          .single();
        if (error) throw error;
        savedId = data.id;
        setFormData(prev => ({ ...prev, id: data.id }));
      }

      if (submit && savedId) {
        // Send email with PDF
        setSubmitting(true);
        const { error: emailError } = await supabase.functions.invoke('send-inspection-report', {
          body: { reportId: savedId }
        });

        if (emailError) {
          console.error('Email error:', emailError);
          toast.error("Report saved but failed to send email");
        } else {
          toast.success("Report submitted and sent to jamie@clewsrecycling.co.uk");
        }
        setSubmitting(false);
      } else {
        toast.success("Report saved as draft");
      }

      onSave?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureSave = (signatureData: string) => {
    setFormData(prev => ({ ...prev, signature_image: signatureData }));
    setShowSignaturePad(false);
    toast.success("Signature saved");
  };

  const isSubmitted = formData.status === 'submitted';
  
  const goToPart2 = () => {
    // Auto-generate todo items from inspection ratings
    const generated = generateTodoItems(formData);
    setTodoItems(prev => {
      // Preserve completion status from existing items
      return generated.map(gen => {
        const existing = prev.find(p => p.id === gen.id);
        return existing ? { ...gen, completed: existing.completed } : gen;
      });
    });
    setCurrentPart(2);
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => setCurrentPart(1)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            currentPart === 1 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-sm font-medium">1</span>
          <span className="font-medium">Inspection</span>
        </button>
        <div className="w-8 h-0.5 bg-border" />
        <button
          type="button"
          onClick={goToPart2}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            currentPart === 2 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <span className="w-6 h-6 rounded-full bg-background/20 flex items-center justify-center text-sm font-medium">2</span>
          <span className="font-medium">Action Items</span>
        </button>
      </div>
      
      {currentPart === 1 && (
        <>
      {/* Header Info */}
      <Card>
        <CardHeader>
          <CardTitle>Part 1: Inspection Checklist</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="report_date">Inspection Date</Label>
            <Input
              id="report_date"
              type="date"
              value={formData.report_date}
              onChange={(e) => updateField('report_date', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site_location">Site Location *</Label>
            <Input
              id="site_location"
              placeholder="Enter site location"
              value={formData.site_location}
              onChange={(e) => updateField('site_location', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inspector_name">Inspector Name *</Label>
            <Input
              id="inspector_name"
              placeholder="Enter inspector name"
              value={formData.inspector_name}
              onChange={(e) => updateField('inspector_name', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Housekeeping Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Housekeeping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingField
            label="General Cleanliness"
            value={formData.housekeeping_general_cleanliness}
            onChange={(v) => updateField('housekeeping_general_cleanliness', v)}
          />
          <RatingField
            label="Waste Disposal"
            value={formData.housekeeping_waste_disposal}
            onChange={(v) => updateField('housekeeping_waste_disposal', v)}
          />
          <RatingField
            label="Storage Areas"
            value={formData.housekeeping_storage_areas}
            onChange={(v) => updateField('housekeeping_storage_areas', v)}
          />
          <RatingField
            label="Walkways Clear"
            value={formData.housekeeping_walkways_clear}
            onChange={(v) => updateField('housekeeping_walkways_clear', v)}
          />
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              placeholder="Add any comments..."
              value={formData.housekeeping_comments}
              onChange={(e) => updateField('housekeeping_comments', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fire Safety Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Fire Safety</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingField
            label="Fire Extinguishers Accessible"
            value={formData.fire_extinguishers_accessible}
            onChange={(v) => updateField('fire_extinguishers_accessible', v)}
          />
          <RatingField
            label="Fire Exits Clear"
            value={formData.fire_exits_clear}
            onChange={(v) => updateField('fire_exits_clear', v)}
          />
          <RatingField
            label="Fire Signage Visible"
            value={formData.fire_signage_visible}
            onChange={(v) => updateField('fire_signage_visible', v)}
          />
          <RatingField
            label="Assembly Point Clear"
            value={formData.fire_assembly_point_clear}
            onChange={(v) => updateField('fire_assembly_point_clear', v)}
          />
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              placeholder="Add any comments..."
              value={formData.fire_safety_comments}
              onChange={(e) => updateField('fire_safety_comments', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* First Aid Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. First Aid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingField
            label="First Aid Kit Stocked"
            value={formData.first_aid_kit_stocked}
            onChange={(v) => updateField('first_aid_kit_stocked', v)}
          />
          <RatingField
            label="First Aid Signage"
            value={formData.first_aid_signage}
            onChange={(v) => updateField('first_aid_signage', v)}
          />
          <RatingField
            label="Trained Personnel Available"
            value={formData.first_aid_trained_personnel}
            onChange={(v) => updateField('first_aid_trained_personnel', v)}
          />
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              placeholder="Add any comments..."
              value={formData.first_aid_comments}
              onChange={(e) => updateField('first_aid_comments', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* PPE Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. Personal Protective Equipment (PPE)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingField
            label="PPE Available"
            value={formData.ppe_available}
            onChange={(v) => updateField('ppe_available', v)}
          />
          <RatingField
            label="PPE Condition"
            value={formData.ppe_condition}
            onChange={(v) => updateField('ppe_condition', v)}
          />
          <RatingField
            label="PPE Being Worn"
            value={formData.ppe_being_worn}
            onChange={(v) => updateField('ppe_being_worn', v)}
          />
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              placeholder="Add any comments..."
              value={formData.ppe_comments}
              onChange={(e) => updateField('ppe_comments', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Equipment Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">5. Equipment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingField
            label="Equipment Condition"
            value={formData.equipment_condition}
            onChange={(v) => updateField('equipment_condition', v)}
          />
          <RatingField
            label="Equipment Guarding"
            value={formData.equipment_guarding}
            onChange={(v) => updateField('equipment_guarding', v)}
          />
          <RatingField
            label="Maintenance Records"
            value={formData.equipment_maintenance_records}
            onChange={(v) => updateField('equipment_maintenance_records', v)}
          />
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              placeholder="Add any comments..."
              value={formData.equipment_comments}
              onChange={(e) => updateField('equipment_comments', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Electrical Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">6. Electrical Safety</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingField
            label="Electrical Equipment Condition"
            value={formData.electrical_equipment_condition}
            onChange={(v) => updateField('electrical_equipment_condition', v)}
          />
          <RatingField
            label="Cables Secure"
            value={formData.electrical_cables_secure}
            onChange={(v) => updateField('electrical_cables_secure', v)}
          />
          <RatingField
            label="PAT Testing Up to Date"
            value={formData.electrical_pat_testing}
            onChange={(v) => updateField('electrical_pat_testing', v)}
          />
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              placeholder="Add any comments..."
              value={formData.electrical_comments}
              onChange={(e) => updateField('electrical_comments', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Welfare Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">7. Welfare Facilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingField
            label="Toilets Clean"
            value={formData.welfare_toilets_clean}
            onChange={(v) => updateField('welfare_toilets_clean', v)}
          />
          <RatingField
            label="Drinking Water Available"
            value={formData.welfare_drinking_water}
            onChange={(v) => updateField('welfare_drinking_water', v)}
          />
          <RatingField
            label="Rest Areas Adequate"
            value={formData.welfare_rest_areas}
            onChange={(v) => updateField('welfare_rest_areas', v)}
          />
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              placeholder="Add any comments..."
              value={formData.welfare_comments}
              onChange={(e) => updateField('welfare_comments', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Environmental Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">8. Environmental</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingField
            label="Spill Kits Available"
            value={formData.environmental_spill_kits}
            onChange={(v) => updateField('environmental_spill_kits', v)}
          />
          <RatingField
            label="Waste Segregation"
            value={formData.environmental_waste_segregation}
            onChange={(v) => updateField('environmental_waste_segregation', v)}
          />
          <RatingField
            label="Drainage Clear"
            value={formData.environmental_drainage}
            onChange={(v) => updateField('environmental_drainage', v)}
          />
          <div className="space-y-2">
            <Label>Comments</Label>
            <Textarea
              placeholder="Add any comments..."
              value={formData.environmental_comments}
              onChange={(e) => updateField('environmental_comments', e.target.value)}
              disabled={isSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions & Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">9. Actions & Sign-off</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Actions Required</Label>
            <Textarea
              placeholder="List any actions required..."
              value={formData.actions_required}
              onChange={(e) => updateField('actions_required', e.target.value)}
              disabled={isSubmitted}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Overall Comments</Label>
            <Textarea
              placeholder="Add any overall comments..."
              value={formData.overall_comments}
              onChange={(e) => updateField('overall_comments', e.target.value)}
              disabled={isSubmitted}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Continue to Part 2 Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={goToPart2}
          className="gap-2"
        >
          Continue to Action Items
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      </>
      )}

      {currentPart === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Part 2: Action Items & Sign-off</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review and track action items generated from your inspection
              </p>
            </CardHeader>
          </Card>

          <InspectionTodoList
            formData={formData}
            todoItems={todoItems}
            onTodoChange={setTodoItems}
            isSubmitted={isSubmitted}
          />

          {/* Signature */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inspector Signature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {formData.signature_image ? (
                  <div className="border rounded-lg p-4 bg-white">
                    <img 
                      src={formData.signature_image} 
                      alt="Signature" 
                      className="max-h-24 mx-auto"
                    />
                    {!isSubmitted && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setShowSignaturePad(true)}
                      >
                        Change Signature
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowSignaturePad(true)}
                    disabled={isSubmitted}
                    className="w-full"
                  >
                    Add Signature
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Signature Pad Modal */}
          {showSignaturePad && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg">
                <SignaturePad
                  onSave={handleSignatureSave}
                  onCancel={() => setShowSignaturePad(false)}
                />
              </div>
            </div>
          )}

          {/* Navigation & Action Buttons */}
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentPart(1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Inspection
            </Button>
            
            {!isSubmitted && (
              <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4">
                <Button
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={saving || submitting}
                  className="flex-1"
                >
                  {saving && !submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  disabled={saving || submitting}
                  className="flex-1"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit & Email Report
                </Button>
              </div>
            )}

            {isSubmitted && (
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 dark:text-green-200 font-medium">
                  This report has been submitted
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
