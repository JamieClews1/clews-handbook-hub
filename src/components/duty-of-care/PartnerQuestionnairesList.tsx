import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Copy, Eye, Trash2, Send, Building2, CheckCircle2, Clock, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PartnerQuestionnaire {
  id: string;
  share_token: string;
  company_name: string;
  status: string;
  created_at: string;
  submitted_at?: string;
  partner_ranking?: string;
}

interface Props {
  questionnaires: PartnerQuestionnaire[];
  isAdmin: boolean;
  onRefresh: () => void;
  onView: (id: string) => void;
}

export function PartnerQuestionnairesList({ questionnaires, isAdmin, onRefresh, onView }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const filtered = questionnaires.filter(q => 
    q.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newCompanyName.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('partner_questionnaires')
        .insert({
          company_name: newCompanyName.trim(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Questionnaire created");
      setIsCreateOpen(false);
      setNewCompanyName("");
      onRefresh();

      // Copy share link
      const url = `${window.location.origin}/partner-questionnaire/${data.share_token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to create questionnaire");
    } finally {
      setIsCreating(false);
    }
  };

  const copyShareLink = async (shareToken: string) => {
    const url = `${window.location.origin}/partner-questionnaire/${shareToken}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this questionnaire?")) return;

    try {
      const { error } = await supabase
        .from('partner_questionnaires')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Questionnaire deleted");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete questionnaire");
    }
  };

  const getStatusBadge = (status: string, ranking?: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-muted text-muted-foreground"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'submitted':
        return <Badge variant="default" className="bg-blue-500"><Send className="h-3 w-3 mr-1" />Submitted</Badge>;
      case 'reviewed':
        return (
          <div className="flex items-center gap-2">
            <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />Reviewed</Badge>
            {ranking && <Badge variant="outline">{ranking}</Badge>}
          </div>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <FileQuestion className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Partner Questionnaires</CardTitle>
            <p className="text-sm text-muted-foreground">Onboarding compliance forms for partners</p>
          </div>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Questionnaire
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Partner Questionnaire</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Partner Company Name *</Label>
                  <Input
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <Button onClick={handleCreate} disabled={isCreating} className="w-full gap-2">
                  <Send className="h-4 w-4" />
                  {isCreating ? "Creating..." : "Create & Copy Share Link"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No questionnaires found</p>
            {isAdmin && (
              <p className="text-sm text-muted-foreground mt-1">Create a new questionnaire to send to partners</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onView(q.id)}>
                    <TableCell className="font-medium">{q.company_name}</TableCell>
                    <TableCell>{getStatusBadge(q.status, q.partner_ranking)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(q.created_at), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {q.submitted_at ? format(new Date(q.submitted_at), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyShareLink(q.share_token)}
                          title="Copy share link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(q.id)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(q.id)}
                            className="text-destructive hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
