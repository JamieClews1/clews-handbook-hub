import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContainerLoadSendHistory } from "./ContainerLoadSendHistory";
import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Loader2, Search, Mail, Users, Contact, Plus, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerRow {
  id: string;
  customer_name: string;
  is_container_load_customer: boolean;
}

interface ContactRow {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  role: string | null;
  is_default: boolean;
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
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [{ data: custData }, { data: emailData }, { data: contactData }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, customer_name, is_container_load_customer")
          .order("customer_name"),
        supabase
          .from("container_load_email_settings")
          .select("*")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("container_load_contacts")
          .select("*")
          .order("is_default", { ascending: false })
          .order("name"),
      ]);
      setContacts((contactData || []) as ContactRow[]);
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

  const addContact = async () => {
    const { data, error } = await supabase
      .from("container_load_contacts")
      .insert({ name: "New contact", email: "" })
      .select("*")
      .single();
    if (error) {
      toast({ title: "Could not add contact", description: error.message, variant: "destructive" });
      return;
    }
    setContacts((prev) => [...prev, data as ContactRow]);
  };

  const patchContact = (id: string, patch: Partial<ContactRow>) =>
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const saveContact = async (c: ContactRow) => {
    const { error } = await supabase
      .from("container_load_contacts")
      .update({
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        role: c.role,
        is_default: c.is_default,
      })
      .eq("id", c.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from("container_load_contacts").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleDefault = async (c: ContactRow) => {
    const next = !c.is_default;
    patchContact(c.id, { is_default: next });
    await supabase.from("container_load_contacts").update({ is_default: next }).eq("id", c.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="customers" className="gap-2">
                <Users className="h-4 w-4" /> Customers
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-2">
                <Contact className="h-4 w-4" /> Contacts
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" /> Email
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" /> History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Every container load email that has been sent, who received it and what was attached.
              </p>
              <ContainerLoadSendHistory />
            </TabsContent>

            <TabsContent value="contacts" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Suppliers and hauliers you send container loads to. Starred contacts appear first
                  when sending.
                </p>
                <Button size="sm" variant="outline" className="gap-2" onClick={addContact}>
                  <Plus className="h-4 w-4" /> Add contact
                </Button>
              </div>
              <div className="max-h-[45vh] overflow-y-auto space-y-3 pr-1">
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No contacts yet.
                  </p>
                ) : (
                  contacts.map((c) => (
                    <div key={c.id} className="rounded-lg border p-3 space-y-2">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={c.name}
                            onChange={(e) => patchContact(c.id, { name: e.target.value })}
                            onBlur={() => saveContact({ ...c })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Company</Label>
                          <Input
                            value={c.company ?? ""}
                            onChange={(e) => patchContact(c.id, { company: e.target.value })}
                            onBlur={() => saveContact({ ...c })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input
                            type="email"
                            value={c.email}
                            onChange={(e) => patchContact(c.id, { email: e.target.value })}
                            onBlur={() => saveContact({ ...c })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Phone</Label>
                          <Input
                            value={c.phone ?? ""}
                            onChange={(e) => patchContact(c.id, { phone: e.target.value })}
                            onBlur={() => saveContact({ ...c })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Account number</Label>
                          <Input
                            value={c.account_number ?? ""}
                            onChange={(e) => patchContact(c.id, { account_number: e.target.value })}
                            onBlur={() => saveContact({ ...c })}
                            placeholder="e.g. DH0577"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Role / notes</Label>
                          <Input
                            value={c.role ?? ""}
                            onChange={(e) => patchContact(c.id, { role: e.target.value })}
                            onBlur={() => saveContact({ ...c })}
                            placeholder="e.g. Supplier, Shipping agent"
                          />
                        </div>

                      </div>
                      <div className="flex items-center justify-between">
                        <Button
                          size="sm"
                          variant={c.is_default ? "secondary" : "ghost"}
                          className="gap-2"
                          onClick={() => toggleDefault(c)}
                        >
                          <Star
                            className={`h-4 w-4 ${c.is_default ? "fill-current text-amber-500" : ""}`}
                          />
                          {c.is_default ? "Default recipient" : "Make default"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive gap-2"
                          onClick={() => deleteContact(c.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

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
