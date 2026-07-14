import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Loader2, Search, Mail, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerRow {
  id: string;
  customer_name: string;
  is_container_load_customer: boolean;
}

interface EmailSettings {
  id?: string;
  cc_email: string;
  reply_to_email: string;
  default_subject: string;
  default_body: string;
  signature: string;
}

const EMPTY_EMAIL: EmailSettings = {
  cc_email: "orders@clewsrecycling.co.uk",
  reply_to_email: "orders@clewsrecycling.co.uk",
  default_subject: "Container load {{reference}} - {{container_number}}",
  default_body: "",
  signature: "Clews Recycling Ltd",
};

export const ContainerLoadSettingsDialog = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(EMPTY_EMAIL);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [{ data: custData }, { data: emailData }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, customer_name, is_container_load_customer")
          .order("customer_name"),
        supabase
          .from("container_load_email_settings")
          .select("*")
          .limit(1)
          .maybeSingle(),
      ]);
      const list = (custData || []) as CustomerRow[];
      setRows(list);
      setSelected(new Set(list.filter((c) => c.is_container_load_customer).map((c) => c.id)));
      if (emailData) setEmailSettings(emailData as EmailSettings);
      setLoading(false);
    })();
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.customer_name.toLowerCase().includes(q));
  }, [rows, search]);

  const handleSaveCustomers = async () => {
    setSaving(true);
    try {
      const enable = rows.filter((r) => selected.has(r.id) && !r.is_container_load_customer).map((r) => r.id);
      const disable = rows.filter((r) => !selected.has(r.id) && r.is_container_load_customer).map((r) => r.id);
      if (enable.length)
        await supabase.from("customers").update({ is_container_load_customer: true }).in("id", enable);
      if (disable.length)
        await supabase.from("customers").update({ is_container_load_customer: false }).in("id", disable);
      toast({ title: "Customers saved", description: `${selected.size} enabled.` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    setSaving(true);
    try {
      const payload = {
        cc_email: emailSettings.cc_email,
        reply_to_email: emailSettings.reply_to_email,
        default_subject: emailSettings.default_subject,
        default_body: emailSettings.default_body,
        signature: emailSettings.signature,
        updated_at: new Date().toISOString(),
      };
      const { error } = emailSettings.id
        ? await supabase.from("container_load_email_settings").update(payload).eq("id", emailSettings.id)
        : await supabase.from("container_load_email_settings").insert(payload);
      if (error) throw error;
      toast({ title: "Email settings saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Container load settings</DialogTitle>
          <DialogDescription>
            Manage which customers do container loads and configure the send-to-supplier email.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="customers">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="customers" className="gap-2">
                <Users className="h-4 w-4" /> Customers
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" /> Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers…"
                />
              </div>
              <div className="max-h-[45vh] overflow-y-auto border rounded-md divide-y">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No customers.</p>
                ) : (
                  filtered.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40"
                    >
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                      <span className="text-sm">{c.customer_name}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{selected.size} selected</p>
                <Button onClick={handleSaveCustomers} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save customers
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="email" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                These defaults populate the send dialog. Use{" "}
                <code className="text-[11px] bg-muted px-1 rounded">
                  {"{{reference}} {{container_number}} {{seal_number}} {{material}} {{bale_count}} {{total_weight_t}} {{destination_facility}} {{destination_country}} {{export_date}} {{customer_name}}"}
                </code>{" "}
                as placeholders.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>CC (default)</Label>
                  <Input
                    value={emailSettings.cc_email}
                    onChange={(e) => setEmailSettings((s) => ({ ...s, cc_email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reply-to</Label>
                  <Input
                    value={emailSettings.reply_to_email}
                    onChange={(e) => setEmailSettings((s) => ({ ...s, reply_to_email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Default subject</Label>
                <Input
                  value={emailSettings.default_subject}
                  onChange={(e) => setEmailSettings((s) => ({ ...s, default_subject: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default message body</Label>
                <Textarea
                  rows={10}
                  value={emailSettings.default_body}
                  onChange={(e) => setEmailSettings((s) => ({ ...s, default_body: e.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveEmail} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save email settings
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
