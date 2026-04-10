import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import clewsLogo from "@/assets/clews-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignaturePad } from "@/components/SignaturePad";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle } from "lucide-react";

type TradeRef = { name: string; address: string; telephone: string };

const CreditApplicationPage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const [form, setForm] = useState({
    business_name: "",
    holding_company: "",
    registered_office: "",
    registered_office_postcode: "",
    invoice_address: "",
    invoice_address_postcode: "",
    date_of_incorporation: "",
    nature_of_business: "",
    company_telephone: "",
    mobile_number: "",
    vat_number: "",
    eori_number: "",
    contact_name: "",
    contact_position: "",
    invoice_email: "",
    credit_requested: "",
    applicant_print_name: "",
    applicant_signature: "",
  });

  const [tradeRefs, setTradeRefs] = useState<TradeRef[]>([
    { name: "", address: "", telephone: "" },
    { name: "", address: "", telephone: "" },
  ]);

  useEffect(() => {
    const load = async () => {
      if (!shareToken) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("credit_account_applications")
        .select("*")
        .eq("share_token", shareToken)
        .maybeSingle();

      if (error || !data) { setNotFound(true); setLoading(false); return; }
      if (data.status === "submitted" || data.status === "approved") {
        setSubmitted(true);
      }
      setApplicationId(data.id);

      // Pre-fill if there's existing data
      setForm({
        business_name: data.business_name || "",
        holding_company: data.holding_company || "",
        registered_office: data.registered_office || "",
        registered_office_postcode: data.registered_office_postcode || "",
        invoice_address: data.invoice_address || "",
        invoice_address_postcode: data.invoice_address_postcode || "",
        date_of_incorporation: data.date_of_incorporation || "",
        nature_of_business: data.nature_of_business || "",
        company_telephone: data.company_telephone || "",
        mobile_number: data.mobile_number || "",
        vat_number: data.vat_number || "",
        eori_number: data.eori_number || "",
        contact_name: data.contact_name || "",
        contact_position: data.contact_position || "",
        invoice_email: data.invoice_email || "",
        credit_requested: data.credit_requested?.toString() || "",
        applicant_print_name: data.applicant_print_name || "",
        applicant_signature: data.applicant_signature || "",
      });

      if (data.trade_references && Array.isArray(data.trade_references) && (data.trade_references as TradeRef[]).length > 0) {
        setTradeRefs(data.trade_references as TradeRef[]);
      }

      setLoading(false);
    };
    load();
  }, [shareToken]);

  const updateField = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const updateRef = (idx: number, field: keyof TradeRef, value: string) => {
    setTradeRefs((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRef = () => setTradeRefs((prev) => [...prev, { name: "", address: "", telephone: "" }]);
  const removeRef = (idx: number) => setTradeRefs((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!applicationId) return;
    if (!form.business_name.trim()) { toast.error("Business name is required"); return; }
    if (!form.contact_name.trim()) { toast.error("Contact name is required"); return; }
    if (!form.applicant_signature) { toast.error("Please provide your signature"); return; }
    if (!form.applicant_print_name.trim()) { toast.error("Please print your name"); return; }

    setSubmitting(true);
    const { error } = await supabase
      .from("credit_account_applications")
      .update({
        ...form,
        credit_requested: form.credit_requested ? parseFloat(form.credit_requested) : null,
        trade_references: tradeRefs.filter((r) => r.name.trim()),
        applicant_signed_date: new Date().toISOString().split("T")[0],
        submitted_at: new Date().toISOString(),
        status: "submitted",
      })
      .eq("id", applicationId);

    setSubmitting(false);
    if (error) { toast.error("Failed to submit application"); return; }
    setSubmitted(true);
    toast.success("Application submitted successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Application not found or link is invalid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {submitted ? (
          <Card>
            <CardContent className="pt-8 text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">Application Submitted</h2>
              <p className="text-muted-foreground">Thank you. Your credit account application has been received and is being reviewed.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Application For Credit Facilities</h1>
              <p className="text-muted-foreground mt-1">Please complete all fields and sign below</p>
            </div>

            {/* Applicant Section */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Applicant Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Business Name *</Label>
                  <Input value={form.business_name} onChange={(e) => updateField("business_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ultimate Holding Company</Label>
                  <Input value={form.holding_company} onChange={(e) => updateField("holding_company", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Registered Office</Label>
                    <Textarea rows={2} value={form.registered_office} onChange={(e) => updateField("registered_office", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Post Code</Label>
                    <Input value={form.registered_office_postcode} onChange={(e) => updateField("registered_office_postcode", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Invoice Address</Label>
                    <Textarea rows={2} value={form.invoice_address} onChange={(e) => updateField("invoice_address", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Post Code</Label>
                    <Input value={form.invoice_address_postcode} onChange={(e) => updateField("invoice_address_postcode", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date of Incorporation</Label>
                    <Input value={form.date_of_incorporation} onChange={(e) => updateField("date_of_incorporation", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nature of Business</Label>
                    <Input value={form.nature_of_business} onChange={(e) => updateField("nature_of_business", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Company Telephone No.</Label>
                    <Input value={form.company_telephone} onChange={(e) => updateField("company_telephone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Mobile No.</Label>
                    <Input value={form.mobile_number} onChange={(e) => updateField("mobile_number", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>VAT Number</Label>
                    <Input value={form.vat_number} onChange={(e) => updateField("vat_number", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>EORI Number</Label>
                    <Input value={form.eori_number} onChange={(e) => updateField("eori_number", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Name of Contact *</Label>
                    <Input value={form.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Input value={form.contact_position} onChange={(e) => updateField("contact_position", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email for Invoices</Label>
                  <Input type="email" value={form.invoice_email} onChange={(e) => updateField("invoice_email", e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Trade References */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Trade References</CardTitle>
                  <Button variant="outline" size="sm" onClick={addRef}><Plus className="h-4 w-4 mr-1" />Add</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {tradeRefs.map((ref, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-3 relative">
                    {tradeRefs.length > 1 && (
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeRef(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input value={ref.name} onChange={(e) => updateRef(idx, "name", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Address</Label>
                        <Input value={ref.address} onChange={(e) => updateRef(idx, "address", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Telephone No.</Label>
                        <Input value={ref.telephone} onChange={(e) => updateRef(idx, "telephone", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Credit & Signature */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Credit & Declaration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Credit Required (£)</Label>
                  <Input type="number" value={form.credit_requested} onChange={(e) => updateField("credit_requested", e.target.value)} placeholder="0.00" />
                </div>

                <p className="text-sm text-muted-foreground">
                  We wish to apply for a 30-day credit account and authorise you to contact the above named. We agree to abide to the credit limit set for us pending the success of this application.
                </p>

                <div className="space-y-2">
                  <Label>Print Name *</Label>
                  <Input value={form.applicant_print_name} onChange={(e) => updateField("applicant_print_name", e.target.value)} />
                </div>

                {form.applicant_signature ? (
                  <div className="space-y-2">
                    <Label>Signature</Label>
                    <div className="border rounded-lg p-2 bg-white">
                      <img src={form.applicant_signature} alt="Signature" className="h-20 mx-auto" />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => updateField("applicant_signature", "")}>Re-sign</Button>
                  </div>
                ) : showSigPad ? (
                  <SignaturePad
                    onSave={(sig) => { updateField("applicant_signature", sig); setShowSigPad(false); }}
                    onCancel={() => setShowSigPad(false)}
                  />
                ) : (
                  <Button variant="outline" onClick={() => setShowSigPad(true)}>Add Signature *</Button>
                )}

                <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Application"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="border-t border-border/50 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} WasteOne. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default CreditApplicationPage;
