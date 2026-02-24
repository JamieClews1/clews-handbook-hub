import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Send, X } from "lucide-react";

interface Props {
  query: any;
  onClose: () => void;
  onSent: () => void;
}

const ContaminationEmailPreview = ({ query, onClose, onSent }: Props) => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(query.recipient_email || "");

  const chargeAmount = query.charge_amount != null ? `£${Number(query.charge_amount).toFixed(2)}` : "TBC";
  const contaminationType = query.contamination_type || "contamination";

  const defaultBody = `Dear Customer,

We are writing to inform you of a contamination issue identified in a recent skip load collected from your site.

Job Reference: ${query.job_number}
Customer Order Number: ${query.order_number || "N/A"}
Site Address: ${query.site || "N/A"}
Container Type: ${query.container_type || "N/A"}
Waste Description: ${query.waste_description || "N/A"}

Type of Contamination: ${contaminationType}
Contamination Charge: ${chargeAmount}

Contamination photos are attached to this email for your reference.

In order for us to proceed, please provide a Purchase Order to the value of ${chargeAmount} to:
orders@clewsrecycling.co.uk

If you have any questions regarding this charge, please do not hesitate to contact us.

Kind regards,
Clews Recycling`;

  const [subject, setSubject] = useState(
    `Contamination Charge — Job #${query.job_number} — ${query.site || query.customer}`
  );
  const [body, setBody] = useState(defaultBody);

  const handleSend = async () => {
    if (!recipientEmail) {
      toast({ title: "Missing recipient email", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-contamination-email", {
        body: {
          to: recipientEmail,
          subject,
          body,
          photos: query.photos || [],
          queryId: query.id,
        },
      });
      if (error) throw error;

      // Log email sent
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .maybeSingle();

      await supabase.from("contamination_activity_log").insert({
        query_id: query.id,
        user_id: user?.id,
        user_name: profile?.full_name || user?.email || "Unknown",
        action_type: "email_sent",
        new_value: recipientEmail,
        notes: `Subject: ${subject}`,
      });

      await supabase
        .from("contamination_queries")
        .update({ email_sent_at: new Date().toISOString(), recipient_email: recipientEmail })
        .eq("id", query.id);

      toast({ title: "Email Sent Successfully" });
      onSent();
    } catch (err: any) {
      toast({ title: "Send Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Email Preview</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>To</Label>
          <Input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="customer@example.com"
          />
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} className="font-mono text-sm" />
        </div>
        {(query.photos || []).length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">{query.photos.length} photo(s) will be attached</Label>
            <div className="flex gap-2 mt-1">
              {query.photos.slice(0, 4).map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="h-12 w-12 rounded object-cover border border-border" />
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            <Send className="h-4 w-4" />
            {sending ? "Sending..." : "Send Email"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContaminationEmailPreview;
