import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

export interface CRMTemplate {
  id: string;
  name: string;
  category: string | null;
  subject: string | null;
  body: string | null;
}

const empty = { name: "", category: "", subject: "", body: "" };

export function useCRMTemplates() {
  const [templates, setTemplates] = useState<CRMTemplate[]>([]);
  const load = async () => {
    const { data } = await supabase
      .from("crm_email_templates")
      .select("id, name, category, subject, body")
      .order("name");
    setTemplates((data as CRMTemplate[]) ?? []);
  };
  useEffect(() => {
    load();
  }, []);
  return { templates, reload: load };
}

export function CRMTemplates({ onChange }: { onChange?: () => void }) {
  const { toast } = useToast();
  const { templates, reload } = useCRMTemplates();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CRMTemplate | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (t: CRMTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      category: t.category ?? "",
      subject: t.subject ?? "",
      body: t.body ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast({ title: "Name and body are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      subject: form.subject.trim() || null,
      body: form.body,
    };
    const { error } = editing
      ? await supabase.from("crm_email_templates").update(payload).eq("id", editing.id)
      : await supabase.from("crm_email_templates").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Template updated" : "Template created" });
    setOpen(false);
    await reload();
    onChange?.();
  };

  const handleDelete = async (t: CRMTemplate) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    const { error } = await supabase.from("crm_email_templates").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template deleted" });
    await reload();
    onChange?.();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Canned Responses
          </h2>
          <p className="text-sm text-muted-foreground">
            Reusable replies staff can insert into CRM conversations.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center text-muted-foreground p-8">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No templates yet. Create your first canned response.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  {t.subject && (
                    <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {t.category && (
                <Badge variant="secondary" className="text-[10px]">
                  {t.category}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                {t.body}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
            <DialogDescription>
              Plain text is inserted into the reply composer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Booking confirmation"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="min-h-[160px]"
                placeholder="Hi {{name}},&#10;&#10;Thanks for getting in touch…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
