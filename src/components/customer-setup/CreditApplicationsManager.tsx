import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/SignaturePad";
import { toast } from "sonner";
import { Plus, Copy, Eye, Check, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";

type CreditApplication = {
  id: string;
  share_token: string;
  status: string;
  business_name: string | null;
  contact_name: string | null;
  invoice_email: string | null;
  credit_requested: number | null;
  submitted_at: string | null;
  approved: boolean | null;
  approved_by_name: string | null;
  approved_by_signature: string | null;
  approved_at: string | null;
  created_at: string;
  account_number: string | null;
  credit_limit_set: number | null;
  // All other fields
  holding_company: string | null;
  registered_office: string | null;
  registered_office_postcode: string | null;
  invoice_address: string | null;
  invoice_address_postcode: string | null;
  date_of_incorporation: string | null;
  nature_of_business: string | null;
  company_telephone: string | null;
  mobile_number: string | null;
  vat_number: string | null;
  eori_number: string | null;
  contact_position: string | null;
  trade_references: any;
  applicant_signature: string | null;
  applicant_print_name: string | null;
  applicant_signed_date: string | null;
};

export function CreditApplicationsManager() {
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewApp, setViewApp] = useState<CreditApplication | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    approved_by_name: "",
    approved_by_signature: "",
    account_number: "",
    credit_limit_set: "",
    approved: true,
  });
  const [showApprovalSig, setShowApprovalSig] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("credit_account_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load applications");
    } else {
      setApplications((data ?? []) as CreditApplication[]);
    }
    setLoading(false);
  };

  useEffect(() => { loadApplications(); }, []);

  const createApplication = async () => {
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("credit_account_applications").insert({
      created_by: userData.user?.id,
      status: "pending",
    });
    if (error) {
      toast.error("Failed to create application");
    } else {
      toast.success("Application created — copy the link to send to the customer");
      await loadApplications();
    }
    setCreating(false);
  };

  const copyLink = (shareToken: string) => {
    const url = `${window.location.origin}/credit-application/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>;
      case "submitted": return <Badge variant="outline" className="text-blue-600 border-blue-300">Submitted</Badge>;
      case "approved": return <Badge variant="outline" className="text-green-600 border-green-300">Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const openApproval = (app: CreditApplication) => {
    setViewApp(app);
    setApprovalForm({
      approved_by_name: "",
      approved_by_signature: "",
      account_number: app.account_number || "",
      credit_limit_set: app.credit_limit_set?.toString() || app.credit_requested?.toString() || "",
      approved: true,
    });
    setApproveOpen(true);
  };

  const submitApproval = async () => {
    if (!viewApp) return;
    if (!approvalForm.approved_by_name.trim()) { toast.error("Approver name is required"); return; }
    if (!approvalForm.approved_by_signature) { toast.error("Approver signature is required"); return; }

    setSaving(true);
    const { error } = await supabase
      .from("credit_account_applications")
      .update({
        status: approvalForm.approved ? "approved" : "rejected",
        approved: approvalForm.approved,
        approved_by_name: approvalForm.approved_by_name.trim(),
        approved_by_signature: approvalForm.approved_by_signature,
        approved_at: new Date().toISOString(),
        account_number: approvalForm.account_number.trim() || null,
        credit_limit_set: approvalForm.credit_limit_set ? parseFloat(approvalForm.credit_limit_set) : null,
      })
      .eq("id", viewApp.id);

    setSaving(false);
    if (error) { toast.error("Failed to save approval"); return; }
    toast.success(approvalForm.approved ? "Application approved" : "Application rejected");
    setApproveOpen(false);
    setViewApp(null);
    await loadApplications();
  };

  const deleteApplication = async (id: string) => {
    if (!confirm("Delete this application?")) return;
    const { error } = await supabase.from("credit_account_applications").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Deleted");
    await loadApplications();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Credit Account Applications</h3>
          <p className="text-sm text-muted-foreground">Create and send credit application forms to new customers</p>
        </div>
        <Button onClick={createApplication} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" />{creating ? "Creating..." : "New Application"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No credit applications yet. Click "New Application" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">{app.business_name || "—"}</TableCell>
                  <TableCell>{app.contact_name || "—"}</TableCell>
                  <TableCell>{app.credit_requested ? `£${app.credit_requested.toLocaleString()}` : "—"}</TableCell>
                  <TableCell>{statusBadge(app.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(app.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyLink(app.share_token)} title="Copy link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setViewApp(app)} title="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {app.status === "submitted" && (
                        <Button variant="ghost" size="icon" onClick={() => openApproval(app)} title="Review & Approve">
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {(app.status === "pending") && (
                        <Button variant="ghost" size="icon" onClick={() => deleteApplication(app.id)} title="Delete">
                          <X className="h-4 w-4 text-destructive" />
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

      {/* View Application Dialog */}
      <Dialog open={!!viewApp && !approveOpen} onOpenChange={(open) => { if (!open) setViewApp(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Credit Application Details</DialogTitle>
            <DialogDescription>{viewApp?.business_name || "Pending submission"}</DialogDescription>
          </DialogHeader>
          {viewApp && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                {statusBadge(viewApp.status)}
                {viewApp.submitted_at && <span className="text-muted-foreground">Submitted {format(new Date(viewApp.submitted_at), "dd MMM yyyy HH:mm")}</span>}
              </div>

              {viewApp.status === "pending" && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Share link:</span>
                  <code className="text-xs flex-1 truncate">{`${window.location.origin}/credit-application/${viewApp.share_token}`}</code>
                  <Button variant="outline" size="sm" onClick={() => copyLink(viewApp.share_token)}>
                    <Copy className="h-3 w-3 mr-1" />Copy
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Business Name" value={viewApp.business_name} />
                <Field label="Holding Company" value={viewApp.holding_company} />
                <Field label="Registered Office" value={viewApp.registered_office} />
                <Field label="Post Code" value={viewApp.registered_office_postcode} />
                <Field label="Invoice Address" value={viewApp.invoice_address} />
                <Field label="Post Code" value={viewApp.invoice_address_postcode} />
                <Field label="Date of Incorporation" value={viewApp.date_of_incorporation} />
                <Field label="Nature of Business" value={viewApp.nature_of_business} />
                <Field label="Telephone" value={viewApp.company_telephone} />
                <Field label="Mobile" value={viewApp.mobile_number} />
                <Field label="VAT Number" value={viewApp.vat_number} />
                <Field label="EORI Number" value={viewApp.eori_number} />
                <Field label="Contact" value={viewApp.contact_name} />
                <Field label="Position" value={viewApp.contact_position} />
                <Field label="Invoice Email" value={viewApp.invoice_email} />
                <Field label="Credit Requested" value={viewApp.credit_requested ? `£${viewApp.credit_requested.toLocaleString()}` : null} />
              </div>

              {viewApp.trade_references && Array.isArray(viewApp.trade_references) && viewApp.trade_references.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Trade References</h4>
                  {(viewApp.trade_references as any[]).map((ref: any, i: number) => (
                    <div key={i} className="grid grid-cols-3 gap-2 text-xs border-b py-1">
                      <span>{ref.name}</span>
                      <span>{ref.address}</span>
                      <span>{ref.telephone}</span>
                    </div>
                  ))}
                </div>
              )}

              {viewApp.applicant_signature && (
                <div>
                  <h4 className="font-semibold mb-1">Applicant Signature</h4>
                  <div className="border rounded p-2 bg-white inline-block">
                    <img src={viewApp.applicant_signature} alt="Applicant signature" className="h-16" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{viewApp.applicant_print_name} — {viewApp.applicant_signed_date}</p>
                </div>
              )}

              {viewApp.approved_by_signature && (
                <div>
                  <h4 className="font-semibold mb-1">Approval</h4>
                  <div className="border rounded p-2 bg-white inline-block">
                    <img src={viewApp.approved_by_signature} alt="Approval signature" className="h-16" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {viewApp.approved_by_name} — {viewApp.approved_at ? format(new Date(viewApp.approved_at), "dd MMM yyyy") : ""}
                  </p>
                  {viewApp.account_number && <p className="text-xs">Account: {viewApp.account_number}</p>}
                  {viewApp.credit_limit_set != null && <p className="text-xs">Credit Limit: £{viewApp.credit_limit_set.toLocaleString()}</p>}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {viewApp?.status === "submitted" && (
              <Button onClick={() => openApproval(viewApp)}>Review & Approve</Button>
            )}
            <Button variant="outline" onClick={() => setViewApp(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve / Reject Application</DialogTitle>
            <DialogDescription>{viewApp?.business_name} — Credit requested: £{viewApp?.credit_requested?.toLocaleString() ?? "N/A"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={approvalForm.approved ? "default" : "outline"}
                onClick={() => setApprovalForm((p) => ({ ...p, approved: true }))}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-1" />Approve
              </Button>
              <Button
                variant={!approvalForm.approved ? "destructive" : "outline"}
                onClick={() => setApprovalForm((p) => ({ ...p, approved: false }))}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-1" />Reject
              </Button>
            </div>

            {approvalForm.approved && (
              <>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input value={approvalForm.account_number} onChange={(e) => setApprovalForm((p) => ({ ...p, account_number: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Credit Limit (£)</Label>
                  <Input type="number" value={approvalForm.credit_limit_set} onChange={(e) => setApprovalForm((p) => ({ ...p, credit_limit_set: e.target.value }))} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Approved By (Name) *</Label>
              <Input value={approvalForm.approved_by_name} onChange={(e) => setApprovalForm((p) => ({ ...p, approved_by_name: e.target.value }))} />
            </div>

            {approvalForm.approved_by_signature ? (
              <div className="space-y-2">
                <Label>Signature</Label>
                <div className="border rounded p-2 bg-white">
                  <img src={approvalForm.approved_by_signature} alt="Signature" className="h-16 mx-auto" />
                </div>
                <Button variant="outline" size="sm" onClick={() => setApprovalForm((p) => ({ ...p, approved_by_signature: "" }))}>Re-sign</Button>
              </div>
            ) : showApprovalSig ? (
              <SignaturePad
                onSave={(sig) => { setApprovalForm((p) => ({ ...p, approved_by_signature: sig })); setShowApprovalSig(false); }}
                onCancel={() => setShowApprovalSig(false)}
              />
            ) : (
              <Button variant="outline" onClick={() => setShowApprovalSig(true)}>Add Signature *</Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submitApproval} disabled={saving}>
              {saving ? "Saving..." : approvalForm.approved ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
