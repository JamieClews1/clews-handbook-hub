import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_PDA_UPLOAD_SETTINGS,
  fetchPdaUploadSettings,
  savePdaUploadSettings,
  type PdaUploadSettings,
} from "@/components/wtn/pda-upload-settings";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Copy, FolderCog } from "lucide-react";

export type PodFolder = {
  id: string;
  label: string | null;
  path: string;
  is_default: boolean;
};

export const DEFAULT_POD_FOLDER = String.raw`\\sbs2011\Midsoft\SkipTrak\pdf`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onSaved?: () => void;
  /** Show the PDA upload rules (file name filter / replace existing). */
  showUploadRules?: boolean;
  title?: string;
}

export const PodsSettingsDialog = ({
  open,
  onOpenChange,
  canManage,
  onSaved,
  showUploadRules = false,
  title,
}: Props) => {
  const { toast } = useToast();
  const [folders, setFolders] = useState<PodFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPath, setNewPath] = useState("");
  const [rules, setRules] = useState<PdaUploadSettings>(DEFAULT_PDA_UPLOAD_SETTINGS);

  useEffect(() => {
    if (open && showUploadRules) void fetchPdaUploadSettings().then(setRules);
  }, [open, showUploadRules]);

  const updateRule = async (patch: Partial<PdaUploadSettings>) => {
    if (!canManage) return;
    const next = { ...rules, ...patch };
    setRules(next);
    try {
      await savePdaUploadSettings(patch);
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Could not save setting", description: e?.message, variant: "destructive" });
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pod_source_folders")
        .select("id, label, path, is_default")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setFolders((data ?? []) as PodFolder[]);
    } catch (e: any) {
      toast({ title: "Could not load POD settings", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const setDefault = async (id: string) => {
    if (!canManage) return;
    try {
      const { error: clearErr } = await supabase
        .from("pod_source_folders")
        .update({ is_default: false })
        .neq("id", id);
      if (clearErr) throw clearErr;
      const { error } = await supabase.from("pod_source_folders").update({ is_default: true }).eq("id", id);
      if (error) throw error;
      await load();
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Could not set default", description: e?.message, variant: "destructive" });
    }
  };

  const addFolder = async () => {
    if (!canManage || !newPath.trim()) return;
    try {
      const { error } = await supabase.from("pod_source_folders").insert({
        label: newLabel.trim() || null,
        path: newPath.trim(),
        is_default: folders.length === 0,
      });
      if (error) throw error;
      setNewLabel("");
      setNewPath("");
      await load();
      onSaved?.();
      toast({ title: "Folder added" });
    } catch (e: any) {
      toast({ title: "Could not add folder", description: e?.message, variant: "destructive" });
    }
  };

  const removeFolder = async (id: string) => {
    if (!canManage) return;
    try {
      const { error } = await supabase.from("pod_source_folders").delete().eq("id", id);
      if (error) throw error;
      await load();
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Could not remove folder", description: e?.message, variant: "destructive" });
    }
  };

  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast({ title: "Copied", description: path });
    } catch {
      /* clipboard unavailable */
    }
  };

  const defaultId = folders.find((f) => f.is_default)?.id ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderCog className="h-5 w-5" /> {title ?? "POD Settings"}
          </DialogTitle>
          <DialogDescription>
            Saved drive locations where POD PDFs are stored. The default is offered first when uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showUploadRules && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <Label>Upload rules</Label>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Only upload files starting with "JOB"</p>
                  <p className="text-xs text-muted-foreground">Any other file names are skipped during upload.</p>
                </div>
                <Switch
                  checked={rules.require_job_prefix}
                  disabled={!canManage}
                  onCheckedChange={(v) => void updateRule({ require_job_prefix: v })}
                />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Replace existing files with the same name</p>
                  <p className="text-xs text-muted-foreground">
                    Re-uploading a file removes the previous version instead of creating a duplicate.
                  </p>
                </div>
                <Switch
                  checked={rules.replace_existing}
                  disabled={!canManage}
                  onCheckedChange={(v) => void updateRule({ replace_existing: v })}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Drive locations</Label>
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && folders.length === 0 && (
              <p className="text-sm text-muted-foreground">No locations saved yet.</p>
            )}
            <RadioGroup value={defaultId} onValueChange={(v) => void setDefault(v)}>
              {folders.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <RadioGroupItem value={f.id} id={`pod-folder-${f.id}`} disabled={!canManage} />
                  <label htmlFor={`pod-folder-${f.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-medium">{f.label || "Drive location"}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{f.path}</span>
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => void copy(f.path)} aria-label="Copy path">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void removeFolder(f.id)}
                      aria-label="Remove location"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>

          {canManage && (
            <div className="space-y-2 rounded-md border border-dashed border-border p-3">
              <Label>Add a location</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Name (e.g. SkipTrak PDFs)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="sm:max-w-[220px]"
                />
                <Input
                  placeholder={DEFAULT_POD_FOLDER}
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  className="font-mono"
                />
                <Button onClick={() => void addFolder()} disabled={!newPath.trim()} className="gap-2 shrink-0">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
