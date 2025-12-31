import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, FileText, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface QuestionnaireTemplate {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  templates: QuestionnaireTemplate[];
  onRefresh: () => void;
  onEdit: (id: string) => void;
  onCreate: () => void;
}

export function QuestionnaireTemplatesList({ templates, onRefresh, onEdit, onCreate }: Props) {
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the template "${name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('questionnaire_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Template deleted");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete template");
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('questionnaire_templates')
        .update({ is_active: !currentState })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Template ${!currentState ? 'activated' : 'deactivated'}`);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update template");
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      // First, unset all defaults
      await supabase
        .from('questionnaire_templates')
        .update({ is_default: false })
        .eq('is_default', true);

      // Set new default
      const { error } = await supabase
        .from('questionnaire_templates')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
      toast.success("Default template updated");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to set default template");
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Questionnaire Templates</CardTitle>
            <p className="text-sm text-muted-foreground">Manage customizable questionnaire templates</p>
          </div>
        </div>
        <Button size="sm" onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first questionnaire template</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Template Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{template.name}</span>
                        {template.is_default && (
                          <Badge variant="secondary" className="ml-2">Default</Badge>
                        )}
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(template.id, template.is_active)}
                        className={template.is_active ? "text-green-600" : "text-muted-foreground"}
                      >
                        {template.is_active ? (
                          <><CheckCircle2 className="h-4 w-4 mr-1" /> Active</>
                        ) : (
                          <><XCircle className="h-4 w-4 mr-1" /> Inactive</>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(template.updated_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!template.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAsDefault(template.id)}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(template.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template.id, template.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
