import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AlertTriangle, Eye, CheckCircle, Clock, XCircle, QrCode, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { publicUrl } from "@/lib/public-url";


interface NearMissReport {
  id: string;
  created_at: string;
  report_date: string;
  location: string;
  description: string;
  what_happened: string;
  potential_consequences: string | null;
  suggested_actions: string | null;
  reporter_name: string | null;
  reporter_department: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending Review", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
  reviewed: { label: "Reviewed", color: "bg-blue-100 text-blue-800", icon: <Eye className="h-3 w-3" /> },
  actioned: { label: "Action Taken", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  dismissed: { label: "Dismissed", color: "bg-gray-100 text-gray-800", icon: <XCircle className="h-3 w-3" /> },
};

const NearMissReportsList = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [reports, setReports] = useState<NearMissReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<NearMissReport | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  
  const [updateForm, setUpdateForm] = useState({
    status: "",
    review_notes: "",
  });

  const reportUrl = `${window.location.origin}/nearmissreport`;

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from("near_miss_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error("Error fetching near miss reports:", error);
      toast({
        title: "Error",
        description: "Failed to load near miss reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleViewReport = (report: NearMissReport) => {
    setSelectedReport(report);
    setUpdateForm({
      status: report.status,
      review_notes: report.review_notes || "",
    });
  };

  const handleUpdateStatus = async () => {
    if (!selectedReport || !user) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("near_miss_reports")
        .update({
          status: updateForm.status,
          review_notes: updateForm.review_notes || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedReport.id);

      if (error) throw error;

      toast({
        title: "Report Updated",
        description: "The near miss report has been updated successfully.",
      });

      setSelectedReport(null);
      fetchReports();
    } catch (error) {
      console.error("Error updating report:", error);
      toast({
        title: "Error",
        description: "Failed to update the report",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reportUrl);
    toast({
      title: "Copied!",
      description: "Report URL copied to clipboard",
    });
  };

  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header with QR Code Access */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Near Miss Reports
          </h2>
          <p className="text-muted-foreground">
            {reports.length} total reports • {pendingCount} pending review
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowQRDialog(true)} className="gap-2">
          <QrCode className="h-4 w-4" />
          Get Report Link
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = reports.filter(r => r.status === status).length;
          return (
            <Card key={status}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  {config.icon}
                  <span className="text-sm text-muted-foreground">{config.label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Reports</CardTitle>
          <CardDescription>Click on a report to view details and update status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No near miss reports yet. Share the report link with your team to start collecting reports.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewReport(report)}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(report.report_date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{report.location}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{report.description}</TableCell>
                    <TableCell>{report.reporter_name || "Anonymous"}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[report.status]?.color || "bg-gray-100"}>
                        {statusConfig[report.status]?.label || report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View/Edit Report Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Near Miss Report Details</DialogTitle>
            <DialogDescription>
              Submitted on {selectedReport && format(new Date(selectedReport.created_at), "dd MMM yyyy 'at' HH:mm")}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6">
              {/* Report Details */}
              <div className="grid gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Date of Incident</Label>
                    <p className="font-medium">{format(new Date(selectedReport.report_date), "dd MMMM yyyy")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Location</Label>
                    <p className="font-medium">{selectedReport.location}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground text-sm">Brief Description</Label>
                  <p className="font-medium">{selectedReport.description}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground text-sm">What Happened</Label>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedReport.what_happened}</p>
                </div>

                {selectedReport.potential_consequences && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Potential Consequences</Label>
                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedReport.potential_consequences}</p>
                  </div>
                )}

                {selectedReport.suggested_actions && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Suggested Actions</Label>
                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedReport.suggested_actions}</p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Reporter Name</Label>
                    <p className="font-medium">{selectedReport.reporter_name || "Anonymous"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Department</Label>
                    <p className="font-medium">{selectedReport.reporter_department || "Not specified"}</p>
                  </div>
                </div>
              </div>

              {/* Update Status Section */}
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold">Update Status</h4>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={updateForm.status} onValueChange={(v) => setUpdateForm({ ...updateForm, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending Review</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="actioned">Action Taken</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Review Notes</Label>
                  <Textarea
                    placeholder="Add notes about the review or actions taken..."
                    value={updateForm.review_notes}
                    onChange={(e) => setUpdateForm({ ...updateForm, review_notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button onClick={handleUpdateStatus} disabled={isUpdating} className="w-full">
                  {isUpdating ? "Updating..." : "Update Report"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code / Link Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Near Miss Report Link</DialogTitle>
            <DialogDescription>
              Share this link or create a QR code for easy access to the near miss report form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={reportUrl} readOnly className="flex-1" />
              <Button variant="outline" size="icon" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Generate a QR code using any free QR code generator with this URL:
              </p>
              <code className="text-xs bg-background p-2 rounded block break-all">{reportUrl}</code>
            </div>

            <Button className="w-full" onClick={() => window.open(reportUrl, "_blank")}>
              Open Report Form
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Need to add Input import
import { Input } from "@/components/ui/input";

export default NearMissReportsList;
