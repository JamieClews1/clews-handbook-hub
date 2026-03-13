import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Mail, Save, Eye, EyeOff, Info } from "lucide-react";
import { CompactRichTextEditor } from "@/components/CompactRichTextEditor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  description: string | null;
  subject_template: string;
  body_html: string;
  sender_name: string;
  sender_email: string;
  available_variables: string[];
}

export const EmailTemplateSettings = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, Partial<EmailTemplate>>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("template_name");

      if (error) throw error;
      setTemplates((data || []) as EmailTemplate[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getEditedValue = (templateId: string, field: keyof EmailTemplate) => {
    return editedTemplates[templateId]?.[field];
  };

  const handleFieldChange = (templateId: string, field: keyof EmailTemplate, value: string) => {
    setEditedTemplates((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [field]: value,
      },
    }));
  };

  const getCurrentValue = (template: EmailTemplate, field: keyof EmailTemplate) => {
    const edited = getEditedValue(template.id, field);
    return edited !== undefined ? edited : template[field];
  };

  const hasChanges = (templateId: string) => {
    return !!editedTemplates[templateId] && Object.keys(editedTemplates[templateId]).length > 0;
  };

  const handleSave = async (template: EmailTemplate) => {
    const changes = editedTemplates[template.id];
    if (!changes) return;

    setSavingId(template.id);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          subject_template: (changes.subject_template ?? template.subject_template) as string,
          body_html: (changes.body_html ?? template.body_html) as string,
          sender_name: (changes.sender_name ?? template.sender_name) as string,
          sender_email: (changes.sender_email ?? template.sender_email) as string,
        })
        .eq("id", template.id);

      if (error) throw error;

      toast({
        title: "Template saved",
        description: `"${template.template_name}" has been updated.`,
      });

      // Clear edits and refresh
      setEditedTemplates((prev) => {
        const next = { ...prev };
        delete next[template.id];
        return next;
      });
      await fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Error saving template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const renderPreview = (template: EmailTemplate) => {
    const html = getCurrentValue(template, "body_html") as string;
    // Replace variables with sample values for preview
    const previewHtml = html
      .replace(/\{\{body\}\}/g, "This is a sample email body content showing how your message will appear to recipients.")
      .replace(/\{\{subject\}\}/g, "Sample Subject Line")
      .replace(/\{\{customerName\}\}/g, "Acme Corporation");

    return previewHtml;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            Loading email templates...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No email templates configured yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Templates
          </CardTitle>
          <CardDescription>
            Customise the automated emails sent by the system. Use variables like <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{variable}}"}</code> to insert dynamic content.
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="single" collapsible className="space-y-4">
        {templates.map((template) => (
          <AccordionItem key={template.id} value={template.id} className="border rounded-lg bg-card">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <div className="font-medium">{template.template_name}</div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground font-normal mt-0.5">
                      {template.description}
                    </p>
                  )}
                </div>
                {hasChanges(template.id) && (
                  <Badge variant="outline" className="ml-2 text-warning border-warning">
                    Unsaved
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-5">
                {/* Available variables */}
                {template.available_variables.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" />
                            Variables:
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>These placeholders are replaced with real data when the email is sent</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {template.available_variables.map((v) => (
                      <Badge key={v} variant="secondary" className="font-mono text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Sender details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sender Name</Label>
                    <Input
                      value={getCurrentValue(template, "sender_name") as string}
                      onChange={(e) => handleFieldChange(template.id, "sender_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sender Email</Label>
                    <Input
                      value={getCurrentValue(template, "sender_email") as string}
                      onChange={(e) => handleFieldChange(template.id, "sender_email", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Must use the verified domain: noreply.clewsrecycling.co.uk
                    </p>
                  </div>
                </div>

                {/* HTML Body */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Email HTML Body</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewId(previewId === template.id ? null : template.id)}
                      className="gap-1.5 text-xs"
                    >
                      {previewId === template.id ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Hide Preview
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={getCurrentValue(template, "body_html") as string}
                    onChange={(e) => handleFieldChange(template.id, "body_html", e.target.value)}
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>

                {/* Preview */}
                {previewId === template.id && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Email Preview</Label>
                    <div
                      className="border rounded-lg p-4 bg-white"
                      dangerouslySetInnerHTML={{ __html: renderPreview(template) }}
                    />
                  </div>
                )}

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => handleSave(template)}
                    disabled={!hasChanges(template.id) || savingId === template.id}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {savingId === template.id ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
