import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, Plus, Trash2, GripVertical, Save, Loader2, 
  ChevronDown, ChevronUp, Settings2, Copy 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface QuestionnaireField {
  id?: string;
  section_id?: string;
  field_key: string;
  label: string;
  field_type: string;
  placeholder?: string;
  is_required: boolean;
  options?: string[];
  display_order: number;
  helper_text?: string;
}

interface QuestionnaireSection {
  id?: string;
  template_id?: string;
  title: string;
  description?: string;
  display_order: number;
  fields: QuestionnaireField[];
  isExpanded?: boolean;
}

interface QuestionnaireTemplate {
  id?: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  sections: QuestionnaireSection[];
}

interface Props {
  templateId?: string;
  onBack: () => void;
  onSaved: () => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'select', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
];

export function QuestionnaireTemplateBuilder({ templateId, onBack, onSaved }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [template, setTemplate] = useState<QuestionnaireTemplate>({
    name: '',
    description: '',
    is_active: true,
    is_default: false,
    sections: []
  });

  useEffect(() => {
    if (templateId) {
      loadTemplate();
    } else {
      setIsLoading(false);
    }
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      // Load template
      const { data: templateData, error: templateError } = await supabase
        .from('questionnaire_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('questionnaire_sections')
        .select('*')
        .eq('template_id', templateId)
        .order('display_order');

      if (sectionsError) throw sectionsError;

      // Load fields for all sections
      const sectionIds = sectionsData?.map(s => s.id) || [];
      let fieldsData: any[] = [];
      
      if (sectionIds.length > 0) {
        const { data, error: fieldsError } = await supabase
          .from('questionnaire_fields')
          .select('*')
          .in('section_id', sectionIds)
          .order('display_order');

        if (fieldsError) throw fieldsError;
        fieldsData = data || [];
      }

      // Combine data
      const sections: QuestionnaireSection[] = (sectionsData || []).map(section => ({
        ...section,
        isExpanded: true,
        fields: fieldsData
          .filter(f => f.section_id === section.id)
          .map(f => ({ ...f, options: f.options || [] }))
      }));

      setTemplate({
        ...templateData,
        sections
      });
    } catch (error: any) {
      toast.error("Failed to load template");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const addSection = () => {
    const newSection: QuestionnaireSection = {
      title: `Section ${template.sections.length + 1}`,
      description: '',
      display_order: template.sections.length,
      fields: [],
      isExpanded: true
    };
    setTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  const updateSection = (index: number, updates: Partial<QuestionnaireSection>) => {
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections.map((s, i) => i === index ? { ...s, ...updates } : s)
    }));
  };

  const removeSection = (index: number) => {
    if (!confirm("Are you sure you want to delete this section and all its fields?")) return;
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index).map((s, i) => ({ ...s, display_order: i }))
    }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= template.sections.length) return;

    setTemplate(prev => {
      const sections = [...prev.sections];
      [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
      return {
        ...prev,
        sections: sections.map((s, i) => ({ ...s, display_order: i }))
      };
    });
  };

  const addField = (sectionIndex: number) => {
    const section = template.sections[sectionIndex];
    const newField: QuestionnaireField = {
      field_key: `field_${Date.now()}`,
      label: 'New Field',
      field_type: 'text',
      is_required: false,
      display_order: section.fields.length,
      options: []
    };

    updateSection(sectionIndex, {
      fields: [...section.fields, newField]
    });
  };

  const updateField = (sectionIndex: number, fieldIndex: number, updates: Partial<QuestionnaireField>) => {
    const section = template.sections[sectionIndex];
    const updatedFields = section.fields.map((f, i) => 
      i === fieldIndex ? { ...f, ...updates } : f
    );
    updateSection(sectionIndex, { fields: updatedFields });
  };

  const removeField = (sectionIndex: number, fieldIndex: number) => {
    const section = template.sections[sectionIndex];
    const updatedFields = section.fields
      .filter((_, i) => i !== fieldIndex)
      .map((f, i) => ({ ...f, display_order: i }));
    updateSection(sectionIndex, { fields: updatedFields });
  };

  const moveField = (sectionIndex: number, fieldIndex: number, direction: 'up' | 'down') => {
    const section = template.sections[sectionIndex];
    const newIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
    if (newIndex < 0 || newIndex >= section.fields.length) return;

    const fields = [...section.fields];
    [fields[fieldIndex], fields[newIndex]] = [fields[newIndex], fields[fieldIndex]];
    updateSection(sectionIndex, {
      fields: fields.map((f, i) => ({ ...f, display_order: i }))
    });
  };

  const duplicateField = (sectionIndex: number, fieldIndex: number) => {
    const section = template.sections[sectionIndex];
    const fieldToCopy = section.fields[fieldIndex];
    const newField: QuestionnaireField = {
      ...fieldToCopy,
      id: undefined,
      field_key: `${fieldToCopy.field_key}_copy_${Date.now()}`,
      label: `${fieldToCopy.label} (Copy)`,
      display_order: section.fields.length
    };
    updateSection(sectionIndex, {
      fields: [...section.fields, newField]
    });
  };

  const handleSave = async () => {
    if (!template.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    setIsSaving(true);
    try {
      let savedTemplateId = template.id;

      // Save or update template
      if (template.id) {
        const { error } = await supabase
          .from('questionnaire_templates')
          .update({
            name: template.name,
            description: template.description,
            is_active: template.is_active,
            is_default: template.is_default
          })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('questionnaire_templates')
          .insert({
            name: template.name,
            description: template.description,
            is_active: template.is_active,
            is_default: template.is_default
          })
          .select()
          .single();
        if (error) throw error;
        savedTemplateId = data.id;
      }

      // Delete existing sections and fields (cascade will handle fields)
      if (template.id) {
        await supabase
          .from('questionnaire_sections')
          .delete()
          .eq('template_id', template.id);
      }

      // Insert sections and fields
      for (const section of template.sections) {
        const { data: sectionData, error: sectionError } = await supabase
          .from('questionnaire_sections')
          .insert({
            template_id: savedTemplateId,
            title: section.title,
            description: section.description,
            display_order: section.display_order
          })
          .select()
          .single();

        if (sectionError) throw sectionError;

        // Insert fields for this section
        if (section.fields.length > 0) {
          const fieldsToInsert = section.fields.map(field => ({
            section_id: sectionData.id,
            field_key: field.field_key,
            label: field.label,
            field_type: field.field_type,
            placeholder: field.placeholder || null,
            is_required: field.is_required,
            options: field.options?.length ? field.options : null,
            display_order: field.display_order,
            helper_text: field.helper_text || null
          }));

          const { error: fieldsError } = await supabase
            .from('questionnaire_fields')
            .insert(fieldsToInsert);

          if (fieldsError) throw fieldsError;
        }
      }

      toast.success("Template saved successfully");
      onSaved();
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {templateId ? 'Edit Template' : 'New Template'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Customize the questionnaire structure
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Template
        </Button>
      </div>

      {/* Template Settings */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Template Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={template.name}
                onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Partner Onboarding Questionnaire"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={template.description || ''}
                onChange={(e) => setTemplate(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this template"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <Switch
                checked={template.is_active}
                onCheckedChange={(checked) => setTemplate(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={template.is_default}
                onCheckedChange={(checked) => setTemplate(prev => ({ ...prev, is_default: checked }))}
              />
              <Label>Default Template</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Sections</h3>
          <Button variant="outline" size="sm" onClick={addSection} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </div>

        {template.sections.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No sections yet</p>
              <Button variant="outline" onClick={addSection} className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Section
              </Button>
            </CardContent>
          </Card>
        ) : (
          template.sections.map((section, sectionIndex) => (
            <Card key={sectionIndex} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    <div className="flex-1 space-y-2">
                      <Input
                        value={section.title}
                        onChange={(e) => updateSection(sectionIndex, { title: e.target.value })}
                        className="font-semibold"
                        placeholder="Section Title"
                      />
                      <Input
                        value={section.description || ''}
                        onChange={(e) => updateSection(sectionIndex, { description: e.target.value })}
                        placeholder="Section description (optional)"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">{section.fields.length} fields</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveSection(sectionIndex, 'up')}
                      disabled={sectionIndex === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveSection(sectionIndex, 'down')}
                      disabled={sectionIndex === template.sections.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateSection(sectionIndex, { isExpanded: !section.isExpanded })}
                    >
                      {section.isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSection(sectionIndex)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {section.isExpanded && (
                <CardContent className="pt-0 space-y-3">
                  <Separator />
                  
                  {section.fields.map((field, fieldIndex) => (
                    <div
                      key={fieldIndex}
                      className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                          <Badge variant="outline" className="text-xs">
                            {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                          </Badge>
                          {field.is_required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveField(sectionIndex, fieldIndex, 'up')}
                            disabled={fieldIndex === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveField(sectionIndex, fieldIndex, 'down')}
                            disabled={fieldIndex === section.fields.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => duplicateField(sectionIndex, fieldIndex)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeField(sectionIndex, fieldIndex)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Label *</Label>
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(sectionIndex, fieldIndex, { label: e.target.value })}
                            placeholder="Field label"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Field Key</Label>
                          <Input
                            value={field.field_key}
                            onChange={(e) => updateField(sectionIndex, fieldIndex, { field_key: e.target.value.replace(/\s/g, '_').toLowerCase() })}
                            placeholder="field_key"
                            className="h-9 font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Field Type</Label>
                          <Select
                            value={field.field_type}
                            onValueChange={(value) => updateField(sectionIndex, fieldIndex, { field_type: value })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border z-[100]">
                              {FIELD_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Placeholder</Label>
                          <Input
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(sectionIndex, fieldIndex, { placeholder: e.target.value })}
                            placeholder="Placeholder text"
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={field.is_required}
                            onCheckedChange={(checked) => updateField(sectionIndex, fieldIndex, { is_required: !!checked })}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>

                      {field.field_type === 'select' && (
                        <div className="space-y-1">
                          <Label className="text-xs">Options (one per line)</Label>
                          <Textarea
                            value={(field.options || []).join('\n')}
                            onChange={(e) => updateField(sectionIndex, fieldIndex, { 
                              options: e.target.value.split('\n').filter(Boolean) 
                            })}
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                            rows={3}
                            className="text-sm"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs">Helper Text</Label>
                        <Input
                          value={field.helper_text || ''}
                          onChange={(e) => updateField(sectionIndex, fieldIndex, { helper_text: e.target.value })}
                          placeholder="Additional instructions for this field"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addField(sectionIndex)}
                    className="w-full gap-2 border-dashed"
                  >
                    <Plus className="h-4 w-4" />
                    Add Field
                  </Button>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
