import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle, Phone, Mail } from "lucide-react";
import { z } from "zod";

const contactSchema = z.object({
  subject: z.string().min(1, "Please select a subject"),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000, "Message too long"),
  urgency: z.enum(["low", "normal", "high"]),
});

interface CustomerPortalContactFormProps {
  customerId: string;
  customerName: string;
}

export function CustomerPortalContactForm({ customerId, customerName }: CustomerPortalContactFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    urgency: "normal" as "low" | "normal" | "high",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("customer-portal-contact", {
        body: {
          customerId,
          customerName,
          userEmail: user?.email,
          subject: formData.subject,
          message: formData.message,
          urgency: formData.urgency,
        },
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Message Sent",
        description: "Your request has been sent to our customer service team.",
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Message Sent Successfully</h3>
          <p className="text-muted-foreground mt-1">
            Our customer service team will respond to your enquiry as soon as possible.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSubmitted(false);
            setFormData({ subject: "", message: "", urgency: "normal" });
          }}
        >
          Send Another Message
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Select
            value={formData.subject}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, subject: value }))}
          >
            <SelectTrigger id="subject" className={errors.subject ? "border-destructive" : ""}>
              <SelectValue placeholder="Select a subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General Enquiry</SelectItem>
              <SelectItem value="billing">Billing & Invoices</SelectItem>
              <SelectItem value="collection">Collection Schedule</SelectItem>
              <SelectItem value="rebate">Rebate Query</SelectItem>
              <SelectItem value="report">Report Issue</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="urgency">Urgency</Label>
          <Select
            value={formData.urgency}
            onValueChange={(value: "low" | "normal" | "high") => setFormData((prev) => ({ ...prev, urgency: value }))}
          >
            <SelectTrigger id="urgency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low - Not urgent</SelectItem>
              <SelectItem value="normal">Normal - Standard response time</SelectItem>
              <SelectItem value="high">High - Urgent attention required</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message *</Label>
          <Textarea
            id="message"
            placeholder="Please describe your enquiry or request in detail..."
            rows={6}
            value={formData.message}
            onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
            className={errors.message ? "border-destructive" : ""}
          />
          {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
          <p className="text-xs text-muted-foreground text-right">
            {formData.message.length}/2000
          </p>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </>
          )}
        </Button>
      </form>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-3">Other Ways to Contact Us</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>01onal 123 456 789</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>customerservice@clewsrecycling.co.uk</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
