import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailRecipient {
  id: string;
  email: string;
  recipient_name: string;
  is_active: boolean;
}

export default function StockReportSettings() {
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchRecipients = async () => {
    const { data } = await supabase
      .from("stock_report_email_settings")
      .select("*")
      .order("created_at");
    setRecipients((data as EmailRecipient[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecipients();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setAdding(true);
    const { error } = await supabase
      .from("stock_report_email_settings")
      .insert({ recipient_name: newName.trim(), email: newEmail.trim() });
    if (error) {
      toast.error("Failed to add recipient");
    } else {
      toast.success("Recipient added");
      setNewName("");
      setNewEmail("");
      fetchRecipients();
    }
    setAdding(false);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase
      .from("stock_report_email_settings")
      .update({ is_active: isActive })
      .eq("id", id);
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r))
    );
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("stock_report_email_settings")
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
            <Mail className="h-4 w-4" />
            Email Notifications
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            These people will receive an email each time a stock report is saved.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="John Smith"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={adding} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {/* List */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recipients configured yet.</p>
          ) : (
            <div className="space-y-2">
              {recipients.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.recipient_name}</div>
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
