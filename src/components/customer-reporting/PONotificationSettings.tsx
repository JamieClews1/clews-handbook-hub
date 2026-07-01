import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Mail, BellRing } from "lucide-react";
import { toast } from "sonner";

interface Recipient {
  id: string;
  email: string;
  recipient_name: string | null;
  is_active: boolean;
}

export function PONotificationSettings() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const [{ data: recips }, { data: config }] = await Promise.all([
      supabase
        .from("po_notification_recipients")
        .select("*")
        .order("created_at"),
      supabase
        .from("po_notification_config")
        .select("enabled")
        .eq("id", true)
        .maybeSingle(),
    ]);
    setRecipients((recips as Recipient[]) ?? []);
    if (config) setEnabled(config.enabled);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleEnabled = async (value: boolean) => {
    setEnabled(value);
    const { error } = await supabase
      .from("po_notification_config")
      .update({ enabled: value, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) {
      toast.error("Failed to update setting");
      setEnabled(!value);
    } else {
      toast.success(value ? "PO notifications enabled" : "PO notifications disabled");
    }
  };

  const handleAdd = async () => {
    if (!newEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    setAdding(true);
    const { data, error } = await supabase
      .from("po_notification_recipients")
      .insert({ recipient_name: newName.trim() || null, email: newEmail.trim() })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add recipient");
    } else if (data) {
      setRecipients((prev) => [...prev, data as Recipient]);
      setNewName("");
      setNewEmail("");
      toast.success("Recipient added");
    }
    setAdding(false);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)));
    await supabase
      .from("po_notification_recipients")
      .update({ is_active: isActive })
      .eq("id", id);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("po_notification_recipients")
      .delete()
      .eq("id", id);
    if (!error) {
      setRecipients((prev) => prev.filter((r) => r.id !== id));
      toast.success("Recipient removed");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            PO Change Notifications
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            When a customer adds or updates a PO number in the Customer Portal, an email is sent to the
            recipients below with the job/ticket details and new PO number.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Master toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="text-sm font-medium">Send PO notification emails</div>
              <div className="text-xs text-muted-foreground">
                Turn off to stop all PO update notifications.
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} disabled={loading} />
          </div>

          {/* Add recipient */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Recipients
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Name (optional)</Label>
                <Input
                  placeholder="Orders team"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  placeholder="orders@clewsrecycling.co.uk"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleAdd} disabled={adding} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recipients configured. Notifications will default to orders@clewsrecycling.co.uk.
            </p>
          ) : (
            <div className="space-y-2">
              {recipients.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="min-w-0">
                    {r.recipient_name && (
                      <div className="text-sm font-medium truncate">{r.recipient_name}</div>
                    )}
                    <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(val) => handleToggle(r.id, val)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
