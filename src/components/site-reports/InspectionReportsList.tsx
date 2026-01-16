import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Loader2, Calendar, MapPin, User } from "lucide-react";
import { format } from "date-fns";

interface Report {
  id: string;
  report_date: string;
  site_location: string;
  inspector_name: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
}

interface InspectionReportsListProps {
  onNewReport: () => void;
  onViewReport: (reportId: string) => void;
}

export default function InspectionReportsList({ onNewReport, onViewReport }: InspectionReportsListProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('site_inspection_reports')
      .select('id, report_date, site_location, inspector_name, status, created_at, submitted_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading reports:', error);
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'submitted') {
      return <Badge className="bg-green-600 hover:bg-green-700">Submitted</Badge>;
    }
    return <Badge variant="secondary">Draft</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with New Report Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Previous Reports</h2>
          <p className="text-sm text-muted-foreground">{reports.length} report{reports.length !== 1 ? 's' : ''} found</p>
        </div>
        <Button onClick={onNewReport} className="gap-2">
          <Plus className="h-4 w-4" />
          New Inspection
        </Button>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No reports yet</h3>
            <p className="text-muted-foreground mb-4">Create your first monthly site inspection report</p>
            <Button onClick={onNewReport} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card 
              key={report.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => onViewReport(report.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(report.status)}
                      <span className="text-sm text-muted-foreground">
                        {report.submitted_at 
                          ? `Submitted ${format(new Date(report.submitted_at), 'dd MMM yyyy')}`
                          : `Created ${format(new Date(report.created_at), 'dd MMM yyyy')}`
                        }
                      </span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">{report.site_location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>{format(new Date(report.report_date), 'dd MMM yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{report.inspector_name}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="flex-shrink-0">
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
