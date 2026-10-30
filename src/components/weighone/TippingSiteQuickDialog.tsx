import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VerifiedTippingSite } from "@/hooks/useVerifiedTippingSites";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing Duty of Care tipping site to edit; omit to add a new one. */
  site?: VerifiedTippingSite | null;
  initialName?: string;
  onSaved: (siteName: string) => void;
}

/** Adds or edits a Duty of Care tipping site without leaving the open ticket. */
export function TippingSiteQuickDialog({ open, onOpenChange, site, initialName, onSaved }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ site_name: "", operator_name: "", address: "", postcode: "", registration_number: "" });

  useEffect(() => {
    if (!open) return;
    setF({
      site_name: site?.site_name ?? initialName ?? "",
      operator_name: site?.operator_name ?? "",
      address: site?.address ?? "",
      postcode: site?.postcode ?? "",
      registration_number: site?.registration_number ?? "",
    });
  }, [open, site, initialName]);

  const save = async () => {
    const name = f.site_name.trim();
    if (!name) return;
    setSaving(true);
    const payload = {
      site_name: name,
      operator_name: f.operator_name.trim() || null,
      address: f.address.trim() || null,
      postcode: f.postcode.trim().toUpperCase() || null,
      registration_number: f.registration_number.trim().toUpperCase() || null,
    };
    let error;
    if (site) {
      ({ error } = await supabase.from("verified_tipping_sites").update(payload).eq("id", site.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("verified_tipping_sites").insert({
        ...payload, register: "waste-operations", site_class: "tipping_site", status: "Manual", created_by: user?.id ?? null,
      }));
    }
    setSaving(false);
    if (error) { toast({ title: "Could not save site", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["verified-tipping-sites"] });
    qc.invalidateQueries({ queryKey: ["tipping-sites"] });
    toast({ title: site ? "Tipping site updated" : "Tipping site added", description: "Saved to Duty of Care tipping sites." });
    onSaved(name);
    onOpenChange(false);
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{site ? "Edit tipping site" : "New tipping site"}</DialogTitle>
          <DialogDescription>Saved to Duty of Care tipping sites. Your ticket stays open.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Site name</Label><Input value={f.site_name} onChange={set("site_name")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Operator / company</Label><Input value={f.operator_name} onChange={set("operator_name")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={f.address} onChange={set("address")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Postcode</Label><Input value={f.postcode} onChange={set("postcode")} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Permit number</Label><Input className="font-mono" value={f.registration_number} onChange={set("registration_number")} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !f.site_name.trim()}>{saving ? "Saving..." : "Save site"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
