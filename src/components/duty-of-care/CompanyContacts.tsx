import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Contact {
  id: string;
  full_name: string;
  contact_type: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

const CONTACT_TYPES = [
  { value: "sales", label: "Sales Contact" },
  { value: "finance", label: "Finance Contact" },
  { value: "transport", label: "Transport Contact" },
  { value: "operations", label: "Operations Contact" },
  { value: "hr", label: "HR Contact" },
  { value: "other", label: "Other" },
];

interface CompanyContactsProps {
  isAdmin: boolean;
}

export function CompanyContacts({ isAdmin }: CompanyContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<Contact>>({});

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('company_contacts')
        .select('*')
        .order('contact_type');

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.contact_type) {
      toast.error("Name and contact type are required");
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('company_contacts')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        toast.success("Contact updated successfully");
      } else {
        const { error } = await supabase
          .from('company_contacts')
          .insert(formData as any);

        if (error) throw error;
        toast.success("Contact added successfully");
      }

      setEditingId(null);
      setIsAdding(false);
      setFormData({});
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || "Failed to save contact");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('company_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Contact deleted");
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete contact");
    }
  };

  const startEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormData(contact);
    setIsAdding(false);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData({ contact_type: "sales" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({});
  };

  const getContactTypeLabel = (value: string) => {
    return CONTACT_TYPES.find(t => t.value === value)?.label || value;
  };

  const getContactTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      sales: "bg-blue-100 text-blue-800",
      finance: "bg-green-100 text-green-800",
      transport: "bg-orange-100 text-orange-800",
      operations: "bg-purple-100 text-purple-800",
      hr: "bg-pink-100 text-pink-800",
      other: "bg-gray-100 text-gray-800",
    };
    return colors[type] || colors.other;
  };

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Company Contacts
        </h4>
        {isAdmin && !isAdding && !editingId && (
          <Button variant="outline" size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        )}
      </div>

      {(isAdding || editingId) && (
        <Card className="border-primary/20 bg-muted/30">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Type *</Label>
                <Select
                  value={formData.contact_type || ''}
                  onValueChange={(value) => setFormData({ ...formData, contact_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+44..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {contacts.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No contacts added yet
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact) => (
            <Card key={contact.id} className="border-border/50">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{contact.full_name}</p>
                    <Badge variant="secondary" className={getContactTypeBadgeColor(contact.contact_type)}>
                      {getContactTypeLabel(contact.contact_type)}
                    </Badge>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(contact)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(contact.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {contact.email && <p>{contact.email}</p>}
                  {contact.phone && <p>{contact.phone}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
