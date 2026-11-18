import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Link2, Plus, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toolboxTalkShareUrl } from "@/lib/toolbox-talk-share";
import { publicBaseUrl } from "@/lib/public-url";

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  view_count: number;
  created_at: string;
}

interface Props {
  talk: { id: string; title: string; reference_code: string } | null;
  onOpenChange: (open: boolean) => void;
}

/** Admin-only: create, copy and switch off public read-and-sign links for one Toolbox Talk. */
export function ToolboxTalkShareDialog({ talk, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [signCount, setSignCount] = useState<Record<string, number>>({});

  const load = async (talkId: string) => {
    const [{ data }, { data: sigs }] = await Promise.all([
      supabase
        .from("toolbox_talk_share_links")
        .select("id, token, label, is_active, view_count, created_at")
        .eq("toolbox_talk_id", talkId)
        .order("created_at", { ascending: false }),
      supabase.from("toolbox_talk_guest_signatures").select("share_link_id").eq("toolbox_talk_id", talkId),
    ]);
    setLinks(data || []);
    const counts: Record<string, number> = {};
    for (const s of sigs || []) if (s.share_link_id) counts[s.share_link_id] = (counts[s.share_link_id] || 0) + 1;
    setSignCount(counts);
  };

  useEffect(() => {
    if (talk) {
      setLabel("");
      setQrFor(null);
      load(talk.id);
    }
  }, [talk?.id]);

  const create = async () => {
    if (!talk) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("toolbox_talk_share_links")
      .insert({ toolbox_talk_id: talk.id, label: label.trim() || null, created_by: user?.id })
      .select("token")
      .single();
    setBusy(false);
    if (error || !data) {
      toast({ title: "Could not create link", variant: "destructive" });
      return;
    }
    setLabel("");
    await load(talk.id);
    copy(data.token);
  };

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("toolbox_talk_share_links").update({ is_active: active }).eq("id", id);
    if (error) toast({ title: "Could not update link", variant: "destructive" });
    if (talk) load(talk.id);
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(toolboxTalkShareUrl(publicBaseUrl(), token));
      toast({ title: "Link copied", description: "Paste it into a text, WhatsApp or email." });
    } catch {
      toast({ title: "Couldn't copy automatically", description: toolboxTalkShareUrl(publicBaseUrl(), token) });
    }
  };

  return (
    <Dialog open={!!talk} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Share {talk?.reference_code}
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can read “{talk?.title}” and sign it with their name, without logging in. Handy for
            agency drivers, contractors or anyone without a portal account. Switch a link off to stop it working.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Label (optional, e.g. Agency drivers)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
          />
          <Button onClick={create} disabled={busy} className="shrink-0 gap-1">
            <Plus className="h-4 w-4" /> New link
          </Button>
        </div>

        <ul className="space-y-2">
          {links.length === 0 ? (
            <li className="text-sm text-muted-foreground">No links yet.</li>
          ) : (
            links.map((l) => (
              <li key={l.id} className="rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.label || "Share link"}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {l.view_count} view{l.view_count === 1 ? "" : "s"} · {signCount[l.id] || 0} signed
                      {!l.is_active && " · switched off"}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => copy(l.token)} title="Copy link" aria-label="Copy link" disabled={!l.is_active}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={qrFor === l.id ? "secondary" : "ghost"}
                    onClick={() => setQrFor(qrFor === l.id ? null : l.id)}
                    title="Show QR code"
                    aria-label="Show QR code"
                    disabled={!l.is_active}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Switch checked={l.is_active} onCheckedChange={(v) => toggle(l.id, v)} aria-label="Link on or off" />
                </div>
                {qrFor === l.id && l.is_active && (
                  <div className="mt-3 flex flex-col items-center gap-2">
                    <div className="rounded-md bg-card p-3 ring-1 ring-border">
                      <QRCodeSVG value={toolboxTalkShareUrl(publicBaseUrl(), l.token)} size={180} />
                    </div>
                    <p className="text-sm text-muted-foreground">Scan with a phone camera to open and sign.</p>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
