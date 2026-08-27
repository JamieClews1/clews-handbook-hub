import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Send, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildWtnDoc, downloadWtnPdf, printWtnPdf, wtnFileName } from "@/lib/route-one-wtn";

const PHOTO_LABELS: Record<string, string> = {
  before: "Before photos",
  after: "After photos",
  contamination: "Contamination photos",
  third_party_ticket: "Third party weighbridge ticket",
};

const prettify = (key: string) =>
  PHOTO_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface Props {
  job: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Print or email the signed waste transfer ticket with selected supporting evidence. */
export function TicketSendDialog({ job, open, onOpenChange }: Props) {
  const jobId = job?.id as string | undefined;
  const jobNumber = (job?.job_number || "").trim();

  const [includeWtn, setIncludeWtn] = useState(true);
  const [photoSel, setPhotoSel] = useState<Record<string, boolean>>({});
  const [docSel, setDocSel] = useState<Record<string, boolean>>({});
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("orders@clewsrecycling.co.uk");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: photos = [] } = useQuery({
    queryKey: ["ticket-send-photos", jobId],
    enabled: !!jobId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_job_photos")
        .select("id, photo_type, file_path, file_name")
        .eq("job_id", jobId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["ticket-send-docs", jobNumber],
    enabled: !!jobNumber && open,
    queryFn: async () => {
      const [podRes, wtnRes] = await Promise.all([
        supabase.from("pod_documents").select("id, file_name, storage_path").or(`job_number.eq.${jobNumber},file_name.ilike.%${jobNumber}%`),
        supabase.from("wtn_documents").select("id, file_name, storage_path").or(`job_number.eq.${jobNumber},file_name.ilike.%${jobNumber}%`),
      ]);
      const rows = [
        ...((podRes.data ?? []).map((d: any) => ({ ...d, bucket: "pods", origin: "POD" }))),
        ...((wtnRes.data ?? []).map((d: any) => ({ ...d, bucket: "wtn-documents", origin: "WTN" }))),
      ];
      const seen = new Set<string>();
      return rows.filter((r) => (seen.has(r.file_name) ? false : (seen.add(r.file_name), true)));
    },
  });

  const photoGroups = useMemo(() => {
    return photos.reduce<Record<string, any[]>>((acc, p) => {
      const key = p.photo_type || "photo";
      (acc[key] ||= []).push(p);
      return acc;
    }, {});
  }, [photos]);

  // Reset defaults each time a job is opened
  useEffect(() => {
    if (!open || !job) return;
    setIncludeWtn(true);
    setTo(job.site_contact_email || job.customer_email || "");
    setCc("orders@clewsrecycling.co.uk");
    setSubject(
      `Waste Transfer Note${job.job_number ? ` ${job.job_number}` : ""} — ${job.customer_name || "Clews Recycling"}${job.site_name ? ` (${job.site_name})` : ""}`,
    );
    setBody(
      `Hi,\n\nPlease find attached the waste transfer ticket${job.job_number ? ` for job ${job.job_number}` : ""}${
        job.site_name ? ` at ${job.site_name}` : ""
      }, along with the supporting documentation listed below.\n\nIf you have any questions, please reply to orders@clewsrecycling.co.uk.\n\nKind regards,\nClews Recycling Ltd`,
    );
  }, [open, job]);

  useEffect(() => {
    setPhotoSel(Object.fromEntries(Object.keys(photoGroups).map((k) => [k, true])));
  }, [photoGroups]);

  useEffect(() => {
    setDocSel(Object.fromEntries(docs.map((d: any) => [d.id, true])));
  }, [docs]);

  const selectedPhotos = photos.filter((p) => photoSel[p.photo_type || "photo"]);
  const selectedDocs = (docs as any[]).filter((d) => docSel[d.id]);
  const attachmentCount = (includeWtn ? 1 : 0) + selectedPhotos.length + selectedDocs.length;

  const handleSend = async () => {
    if (!job) return;
    if (!to.trim()) {
      toast.error("Add a recipient email address");
      return;
    }
    setSending(true);
    try {
      const attachments: { filename: string; url?: string; content?: string }[] = [];

      if (includeWtn) {
        const doc = await buildWtnDoc(job);
        const dataUri = doc.output("datauristring") as string;
        attachments.push({ filename: wtnFileName(job), content: dataUri.split(",")[1] });
      }

      for (const p of selectedPhotos) {
        const url = supabase.storage.from("route-one-photos").getPublicUrl(p.file_path).data.publicUrl;
        attachments.push({ filename: p.file_name || p.file_path.split("/").pop() || "photo.jpg", url });
      }

      for (const d of selectedDocs) {
        const { data } = await supabase.storage.from(d.bucket).createSignedUrl(d.storage_path, 600);
        if (data?.signedUrl) attachments.push({ filename: d.file_name, url: data.signedUrl });
      }

      const { data, error } = await supabase.functions.invoke("send-route-one-ticket", {
        body: {
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject,
          body,
          attachments,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Ticket sent to ${to.trim()}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send ticket");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Print / Send ticket</DialogTitle>
          <DialogDescription>
            Choose what to include with this ticket — the signed waste transfer note, driver photos and any
            weighbridge or POD paperwork.
          </DialogDescription>
        </DialogHeader>

        {job && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{job.customer_name}</p>
              <p className="text-xs text-muted-foreground">
                {[job.site_name, job.job_number ? `Job ${job.job_number}` : null].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Include</Label>

              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                <Checkbox checked={includeWtn} onCheckedChange={(v) => setIncludeWtn(!!v)} className="mt-0.5" />
                <span className="text-sm">
                  Signed Waste Transfer Note (PDF)
                  <span className="block text-xs text-muted-foreground">
                    {job.customer_signature || job.driver_signature
                      ? "Includes captured signatures"
                      : "No signatures captured yet"}
                  </span>
                </span>
              </label>

              {Object.entries(photoGroups).map(([type, items]) => (
                <label key={type} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <Checkbox
                    checked={!!photoSel[type]}
                    onCheckedChange={(v) => setPhotoSel((s) => ({ ...s, [type]: !!v }))}
                    className="mt-0.5"
                  />
                  <span className="text-sm flex-1">
                    {prettify(type)}
                    <span className="block text-xs text-muted-foreground">Driver app capture</span>
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </label>
              ))}

              {(docs as any[]).map((d) => (
                <label key={d.id} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <Checkbox
                    checked={!!docSel[d.id]}
                    onCheckedChange={(v) => setDocSel((s) => ({ ...s, [d.id]: !!v }))}
                    className="mt-0.5"
                  />
                  <span className="text-sm flex-1 break-all">
                    {d.file_name}
                    <span className="block text-xs text-muted-foreground">{d.origin === "POD" ? "Proof of delivery" : "Scanned WTN / PDA"}</span>
                  </span>
                </label>
              ))}

              {Object.keys(photoGroups).length === 0 && docs.length === 0 && (
                <p className="text-xs text-muted-foreground">No photos or scanned paperwork found for this job.</p>
              )}
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-to">Send to</Label>
                <Input id="ticket-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-cc">CC</Label>
                <Input id="ticket-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ticket-body">Message</Label>
              <Textarea id="ticket-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>

            <p className="text-xs text-muted-foreground">{attachmentCount} attachment{attachmentCount === 1 ? "" : "s"} will be sent.</p>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => printWtnPdf(job)}>
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Print ticket
              </Button>
              <Button variant="outline" onClick={() => downloadWtnPdf(job)}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> Download
              </Button>
              <Button onClick={handleSend} disabled={sending || attachmentCount === 0}>
                {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Send ticket
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
