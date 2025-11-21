import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface HRContact {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  office_hours: string | null;
  office_address: string | null;
}

export const HRContactSettings = () => {
  const { toast } = useToast();
  const [hrContact, setHrContact] = useState<HRContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    office_hours: "",
    office_address: "",
  });

  useEffect(() => {
    fetchHRContact();
  }, []);

  const fetchHRContact = async () => {
    try {
      const { data, error } = await supabase
        .from("hr_contact_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setHrContact(data);
        setFormData({
          contact_name: data.contact_name,
          contact_email: data.contact_email,
          contact_phone: data.contact_phone || "",
          office_hours: data.office_hours || "",
          office_address: data.office_address || "",
        });
      }
    } catch (error) {
      console.error("Error fetching HR contact:", error);
      toast({
        title: "Error",
        description: "Failed to load HR contact information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (hrContact) {
        // Update existing
        const { error } = await supabase
          .from("hr_contact_settings")
          .update({
            contact_name: formData.contact_name,
            contact_email: formData.contact_email,
            contact_phone: formData.contact_phone || null,
            office_hours: formData.office_hours || null,
            office_address: formData.office_address || null,
          })
          .eq("id", hrContact.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("hr_contact_settings")
          .insert({
            contact_name: formData.contact_name,
            contact_email: formData.contact_email,
            contact_phone: formData.contact_phone || null,
            office_hours: formData.office_hours || null,
            office_address: formData.office_address || null,
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "HR contact information updated successfully",
      });

      await fetchHRContact();
    } catch (error: any) {
      console.error("Error saving HR contact:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save HR contact information",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading HR contact information...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>HR Contact Information</CardTitle>
        <CardDescription>
          Manage the HR contact details displayed to employees
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Name *</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              placeholder="e.g., HR Department"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email *</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              placeholder="hr@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">Contact Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              placeholder="+44 (0) 123 456 7890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="office_hours">Office Hours</Label>
            <Input
              id="office_hours"
              value={formData.office_hours}
              onChange={(e) => setFormData({ ...formData, office_hours: e.target.value })}
              placeholder="Monday - Friday: 9:00 AM - 5:00 PM"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="office_address">Office Address</Label>
            <Textarea
              id="office_address"
              value={formData.office_address}
              onChange={(e) => setFormData({ ...formData, office_address: e.target.value })}
              placeholder="Company address"
              rows={3}
            />
          </div>

          <Button type="submit" disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save HR Contact Information"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
