import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Save, AlertTriangle, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, subYears, isAfter } from "date-fns";

interface RiddorIncident {
  id: string;
  incident_date: string;
  title: string;
  description: string | null;
  notes: string | null;
  reported_by: string | null;
  status: string | null;
}

interface RiddorIncidentsProps {
  isAdmin: boolean;
}

export function RiddorIncidents({ isAdmin }: RiddorIncidentsProps) {
  const [incidents, setIncidents] = useState<RiddorIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<RiddorIncident>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    const threeYearsAgo = format(subYears(new Date(), 3), 'yyyy-MM-dd');
    
    try {
      const { data, error } = await supabase
        .from('riddor_incidents')
        .select('*')
        .gte('incident_date', threeYearsAgo)
        .order('incident_date', { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (error: any) {
      console.error('Error fetching incidents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.incident_date) {
      toast.error("Title and date are required");
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('riddor_incidents')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        toast.success("Incident updated successfully");
      } else {
        const { error } = await supabase
          .from('riddor_incidents')
          .insert(formData as any);

        if (error) throw error;
        toast.success("Incident recorded successfully");
      }

      setEditingId(null);
      setIsAdding(false);
      setFormData({});
      fetchIncidents();
    } catch (error: any) {
      toast.error(error.message || "Failed to save incident");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('riddor_incidents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Incident deleted");
      fetchIncidents();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete incident");
    }
  };

  const startEdit = (incident: RiddorIncident) => {
    setEditingId(incident.id);
    setFormData(incident);
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ incident_date: format(new Date(), 'yyyy-MM-dd'), status: 'recorded' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({});
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          RIDDOR Incidents (Last 3 Years)
        </CardTitle>
        {isAdmin && !isAdding && !editingId && (
          <Button variant="outline" size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Record Incident
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {(isAdding || editingId) && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Incident Date *</Label>
                  <Input
                    type="date"
                    value={formData.incident_date || ''}
                    onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reported By</Label>
                  <Input
                    value={formData.reported_by || ''}
                    onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
                    placeholder="Name of reporter"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Incident Title *</Label>
                <Input
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description of the incident"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of what happened..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Follow-up actions, investigation findings, etc."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {incidents.length === 0 && !isAdding ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No RIDDOR incidents recorded in the last 3 years</p>
            <p className="text-xs mt-1">This is a positive compliance indicator</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <Collapsible key={incident.id} open={expandedIds.has(incident.id)}>
                <Card className="border-border/50">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(incident.incident_date), 'dd MMM yyyy')}
                        </div>
                        <p className="font-medium">{incident.title}</p>
                        <Badge variant="outline" className="text-xs">
                          {incident.status || 'recorded'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit(incident)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(incident.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleExpand(incident.id)}
                          >
                            {expandedIds.has(incident.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                    <CollapsibleContent className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      {incident.reported_by && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Reported By</Label>
                          <p className="text-sm">{incident.reported_by}</p>
                        </div>
                      )}
                      {incident.description && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
                        </div>
                      )}
                      {incident.notes && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Notes</Label>
                          <p className="text-sm whitespace-pre-wrap">{incident.notes}</p>
                        </div>
                      )}
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}

        <div className="pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            RIDDOR: Reporting of Injuries, Diseases and Dangerous Occurrences Regulations. 
            Records shown are from the last 3 years only.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
