import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  Settings,
  Loader2,
  Search,
  Mail,
  Building2,
  Plus,
  Trash2,
  Star,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompanyRow {
  id: string;
  customer_name: string;
  customer_code: string;
  is_container_load_customer: boolean;
}

interface ContactRow {
  id: string;
  name: string;
  company: string | null;
  customer_id: string | null;
  email: string;
  phone: string | null;
  role: string | null;
  is_default: boolean;
  account_number: string | null;
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
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState("");
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(EMPTY_EMAIL);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyCode, setNewCompanyCode] = useState("");
  const [addingCompany, setAddingCompany] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const [{ data: custData }, { data: emailData }, { data: contactData }] = await Promise.all([
        supabase
          .from("customers")
          .select("id, customer_name, customer_code, is_container_load_customer")
          .eq("is_container_load_customer", true)
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
      setCompanies((custData || []) as CompanyRow[]);
      setContacts((contactData || []) as ContactRow[]);
      if (emailData) setEmailSettings(emailData as EmailSettings);
      setLoading(false);
    })();
  }, [open]);

  const contactsFor = (company: CompanyRow) =>
    contacts.filter(
      (c) =>
        c.customer_id === company.id ||
        (!c.customer_id &&
          (c.company || "").trim().toLowerCase() ===
            company.customer_name.trim().toLowerCase()),
    );

  const unassigned = useMemo(
    () =>
      contacts.filter(
        (c) =>
          !c.customer_id &&
          !companies.some(
            (co) =>
              co.customer_name.trim().toLowerCase() === (c.company || "").trim().toLowerCase(),
          ),
      ),
    [contacts, companies],
  );

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.customer_name.toLowerCase().includes(q) ||
        (c.customer_code || "").toLowerCase().includes(q),
    );
  }, [companies, search]);

  const addCompany = async () => {
    const name = newCompanyName.trim();
    if (!name) return;
    setAddingCompany(true);
    try {
      const code =
        newCompanyCode.trim() ||
        name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() + "01";
      const { data, error } = await supabase
        .from("customers")
        .insert({ customer_name: name, customer_code: code, is_container_load_customer: true })
        .select("id, customer_name, customer_code, is_container_load_customer")
        .single();
      if (error) throw error;
      setCompanies((prev) =>
        [...prev, data as CompanyRow].sort((a, b) => a.customer_name.localeCompare(b.customer_name)),
      );
      setNewCompanyName("");
      setNewCompanyCode("");
      toast({ title: "Company added", description: name });
    } catch (e: any) {
      toast({ title: "Could not add company", description: e.message, variant: "destructive" });
    } finally {
      setAddingCompany(false);
    }
  };

  const saveCompany = async (c: CompanyRow) => {
    const { error } = await supabase
      .from("customers")
      .update({ customer_name: c.customer_name, customer_code: c.customer_code })
      .eq("id", c.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  const patchCompany = (id: string, patch: Partial<CompanyRow>) =>
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const removeCompany = async (c: CompanyRow) => {
    const { error } = await supabase
      .from("customers")
      .update({ is_container_load_customer: false })
      .eq("id", c.id);
    if (error) {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
      return;
    }
    setCompanies((prev) => prev.filter((x) => x.id !== c.id));
    toast({ title: "Company removed from container loads" });
  };

  const addContact = async (company?: CompanyRow) => {
    const { data, error } = await supabase
      .from("container_load_contacts")
      .insert({
        name: "New contact",
        email: "",
        company: company?.customer_name ?? null,
        customer_id: company?.id ?? null,
      })
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
        customer_id: c.customer_id,
        email: c.email,
        phone: c.phone,
        role: c.role,
        is_default: c.is_default,
        account_number: c.account_number,
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

  const renderContact = (c: ContactRow) => (
    <div key={c.id} className="rounded-lg border p-3 space-y-2 bg-card">
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Contact name</Label>
          <Input
            value={c.name}
            onChange={(e) => patchContact(c.id, { name: e.target.value })}
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
        <div className="space-y-1 sm:col-span-2">
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
          <Star className={`h-4 w-4 ${c.is_default ? "fill-current text-amber-500" : ""}`} />
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
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Container load settings</DialogTitle>
          <DialogDescription>
            Manage the companies you ship containers to, their contacts and the send email.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="company">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="company" className="gap-2">
                <Building2 className="h-4 w-4" /> Company
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" /> Email
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" /> History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Click a company to open its profile and contacts. These companies are the only ones
                offered when creating a container load.
              </p>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search companies…"
                />
              </div>

              <div className="max-h-[45vh] overflow-y-auto pr-1">
                {filteredCompanies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No companies.</p>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {filteredCompanies.map((company) => {
                      const list = contactsFor(company);
                      return (
                        <AccordionItem
                          key={company.id}
                          value={company.id}
                          className="border rounded-lg px-3"
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{company.customer_name}</span>
                              {company.customer_code && (
                                <Badge variant="outline" className="text-[10px]">
                                  {company.customer_code}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px]">
                                {list.length} contact{list.length === 1 ? "" : "s"}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pb-4">
                            <div className="grid sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Company name</Label>
                                <Input
                                  value={company.customer_name}
                                  onChange={(e) =>
                                    patchCompany(company.id, { customer_name: e.target.value })
                                  }
                                  onBlur={() => saveCompany(company)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Company code</Label>
                                <Input
                                  value={company.customer_code ?? ""}
                                  onChange={(e) =>
                                    patchCompany(company.id, { customer_code: e.target.value })
                                  }
                                  onBlur={() => saveCompany(company)}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <p className="text-xs font-medium">Contacts</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={() => addContact(company)}
                              >
                                <Plus className="h-4 w-4" /> Add contact
                              </Button>
                            </div>

                            {list.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-3">
                                No contacts for this company yet.
                              </p>
                            ) : (
                              <div className="space-y-3">{list.map(renderContact)}</div>
                            )}

                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive gap-2"
                                onClick={() => removeCompany(company)}
                              >
                                <Trash2 className="h-4 w-4" /> Remove company
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add new company
                </p>
                <div className="grid sm:grid-cols-[1fr_160px_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Company name</Label>
                    <Input
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="e.g. Nevis Resources Limited"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Code (optional)</Label>
                    <Input
                      value={newCompanyCode}
                      onChange={(e) => setNewCompanyCode(e.target.value)}
                      placeholder="e.g. NEV01"
                    />
                  </div>
                  <Button
                    onClick={addCompany}
                    disabled={addingCompany || !newCompanyName.trim()}
                    className="gap-2"
                  >
                    {addingCompany ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Add
                  </Button>
                </div>
              </div>

              {unassigned.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Contacts not linked to a company
                  </p>
                  <div className="space-y-3">{unassigned.map(renderContact)}</div>
                </div>
              )}
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

            <TabsContent value="history" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Every container load email that has been sent, who received it and what was attached.
              </p>
              <ContainerLoadSendHistory />
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
