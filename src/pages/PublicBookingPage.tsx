import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Truck } from "lucide-react";
import w1Logo from "@/assets/w1-logo.png";

const TIME_SLOTS = ["AM (8:00-12:00)", "PM (12:00-17:00)", "All Day"];
const CONTAINER_TYPES = ["4yd Skip", "6yd Skip", "8yd Skip", "12yd Skip", "14yd Skip", "16yd Skip", "20yd RORO", "30yd RORO", "40yd RORO", "FEL 660L", "FEL 1100L", "Cage"];

const PublicBookingPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    company_name: "",
    site_address: "",
    collection_date: "",
    collection_time_slot: "",
    container_type: "",
    waste_type: "",
    quantity: 1,
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    special_instructions: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.contact_name || !form.contact_email || !form.contact_phone) {
      setError("Please fill in all required contact fields.");
      return;
    }

    setSubmitting(true);

    const { error: insertError } = await supabase.from("bookings").insert({
      collection_date: form.collection_date || null,
      collection_time_slot: form.collection_time_slot || null,
      container_type: form.container_type || null,
      waste_type: form.waste_type || null,
      quantity: form.quantity,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      special_instructions: [
        form.company_name ? `Company: ${form.company_name}` : "",
        form.site_address ? `Site: ${form.site_address}` : "",
        form.special_instructions || "",
      ].filter(Boolean).join("\n"),
      source: "public",
      status: "pending" as const,
    } as any);

    setSubmitting(false);

    if (insertError) {
      setError("Something went wrong. Please try again or call us directly.");
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Request Submitted!</h2>
            <p className="text-muted-foreground">
              Thank you for your booking request. Our team will review it and get back to you shortly to confirm your collection.
            </p>
            <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ company_name: "", site_address: "", collection_date: "", collection_time_slot: "", container_type: "", waste_type: "", quantity: 1, contact_name: "", contact_email: "", contact_phone: "", special_instructions: "" }); }}>
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={w1Logo} alt="WasteOne" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Book a Collection</h1>
              <p className="text-xs text-muted-foreground">Skip & Container Services</p>
            </div>
          </div>
          <Truck className="h-6 w-6 text-muted-foreground" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Request a Collection</CardTitle>
            <CardDescription>
              Fill in the details below and our team will confirm your booking. Fields marked * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contact Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Your Name *</Label>
                    <Input required value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" required value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input required value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Collection Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Collection Details</h3>
                <div className="space-y-2">
                  <Label>Site Address</Label>
                  <Textarea value={form.site_address} onChange={e => setForm({ ...form, site_address: e.target.value })} rows={2} placeholder="Full address including postcode" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preferred Collection Date</Label>
                    <Input type="date" value={form.collection_date} onChange={e => setForm({ ...form, collection_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Time Slot</Label>
                    <Select value={form.collection_time_slot} onValueChange={v => setForm({ ...form, collection_time_slot: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Container Type</Label>
                    <Select value={form.container_type} onValueChange={v => setForm({ ...form, container_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {CONTAINER_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Waste Type</Label>
                    <Input value={form.waste_type} onChange={e => setForm({ ...form, waste_type: e.target.value })} placeholder="e.g. General Waste, Timber" />
                  </div>
                </div>
              </div>

              {/* Special Instructions */}
              <div className="space-y-2">
                <Label>Special Instructions</Label>
                <Textarea value={form.special_instructions} onChange={e => setForm({ ...form, special_instructions: e.target.value })} rows={3} placeholder="Access requirements, specific location on site, etc." />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Booking Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PublicBookingPage;
