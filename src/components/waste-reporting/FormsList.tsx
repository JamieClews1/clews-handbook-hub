import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Search, FileText, Link, Eye, Edit, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Form {
  id: string;
  form_date: string;
  facility_name: string;
  company_name: string;
  completed_by: string;
  status: string;
  share_token: string;
  average_recycling_rate: number;
  average_recovery_rate: number;
  created_at: string;
}

interface FormsListProps {
  onCreateNew: () => void;
  onEditForm: (formId: string) => void;
  onViewForm: (formId: string) => void;
}

export const FormsList = ({ onCreateNew, onEditForm, onViewForm }: FormsListProps) => {
  const { user } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteFormId, setDeleteFormId] = useState<string | null>(null);

  useEffect(() => {
    loadForms();
    checkAdminRole();
  }, [user]);

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

  const loadForms = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('facility_recycling_forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      console.error("Error loading forms:", error);
      toast.error("Failed to load forms");
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = (shareToken: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/waste-form/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard");
  };

  const handleDelete = async () => {
    if (!deleteFormId) return;
    
    try {
      const { error } = await supabase
        .from('facility_recycling_forms')
        .delete()
        .eq('id', deleteFormId);
      
      if (error) throw error;
      
      toast.success("Form deleted successfully");
      loadForms();
    } catch (error) {
      console.error("Error deleting form:", error);
      toast.error("Failed to delete form");
    } finally {
      setDeleteFormId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-muted">Draft</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-500">Submitted</Badge>;
      case 'reviewed':
        return <Badge className="bg-green-500">Reviewed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredForms = forms.filter(form =>
    form.facility_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.completed_by.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Form
        </Button>
      </div>

      {filteredForms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No forms yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first Facility Recycling Form to get started.
            </p>
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredForms.map((form) => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{form.facility_name}</h3>
                      {getStatusBadge(form.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>{form.company_name} • Completed by {form.completed_by}</p>
                      <p>Date: {format(new Date(form.form_date), 'dd MMM yyyy')}</p>
                      <div className="flex gap-4">
                        <span className="text-green-600">
                          Recycling: {Number(form.average_recycling_rate).toFixed(1)}%
                        </span>
                        <span className="text-amber-600">
                          Recovery: {Number(form.average_recovery_rate).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {form.status !== 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => copyShareLink(form.share_token, e)}
                      >
                        <Link className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewForm(form.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditForm(form.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteFormId(form.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteFormId} onOpenChange={() => setDeleteFormId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this form? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
