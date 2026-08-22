import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, Languages, Loader2, Pencil, Printer } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import { sanitizeHtml } from "@/lib/sanitize-html";

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "PL", label: "Polski" },
  { code: "UK", label: "Українська" },
  { code: "RO", label: "Română" },
];

interface HSDoc {
  id: string;
  category: string;
  reference_code: string | null;
  title: string;
  title_pl: string | null;
  title_uk: string | null;
  title_ro: string | null;
  content: string;
  content_pl: string | null;
  content_uk: string | null;
  content_ro: string | null;
  acknowledgements: unknown;
  acknowledgements_pl: unknown;
  acknowledgements_uk: unknown;
  acknowledgements_ro: unknown;
  site: string | null;
  version: string | null;
  requires_signature: boolean;
}

interface SignatureRow {
  id: string;
  signature_image: string;
  employee_name: string | null;
  job_title: string | null;
  inducted_by: string | null;
  signed_at: string;
  language: string;
}

const asArray = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

const HSDocumentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const { toast } = useToast();

  const [doc, setDoc] = useState<HSDoc | null>(null);
  const [signature, setSignature] = useState<SignatureRow | null>(null);
  const [language, setLanguage] = useState("EN");
  const [loadingData, setLoadingData] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [inductedBy, setInductedBy] = useState("");
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAcks, setEditAcks] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const load = async () => {
    if (!user || !id) return;
    setLoadingData(true);
    const [{ data: d }, { data: sig }, { data: profile }] = await Promise.all([
      supabase.from("hs_documents").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("hs_document_signatures")
        .select("id, signature_image, employee_name, job_title, inducted_by, signed_at, language")
        .eq("document_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);
    setDoc(d as unknown as HSDoc);
    setSignature(sig as SignatureRow | null);
    setName((sig?.employee_name as string) || profile?.full_name || "");
    setJobTitle((sig?.job_title as string) || "");
    setLoadingData(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const suffix = language.toLowerCase() as "pl" | "uk" | "ro";
  const title = language === "EN" ? doc?.title : (doc as any)?.[`title_${suffix}`] || doc?.title;
  const content = language === "EN" ? doc?.content : (doc as any)?.[`content_${suffix}`] || doc?.content;
  const acks = useMemo(() => {
    if (!doc) return [];
    const base = asArray(doc.acknowledgements);
    if (language === "EN") return base;
    const translated = asArray((doc as any)[`acknowledgements_${suffix}`]);
    return translated.length === base.length ? translated : base;
  }, [doc, language, suffix]);

  const allChecked = acks.length > 0 && acks.every((_, i) => checked[i]);

  const handleTranslate = async () => {
    if (!doc) return;
    setTranslating(true);
    const { error } = await supabase.functions.invoke("translate-hs-document", {
      body: { document_id: doc.id },
    });
    setTranslating(false);
    if (error) {
      toast({ title: "Translation failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Translated", description: "Polish, Ukrainian and Romanian versions updated." });
    load();
  };

  const handleSign = async (signatureData: string) => {
    if (!doc || !user) return;
    setSaving(true);
    const { error } = await supabase.from("hs_document_signatures").insert({
      document_id: doc.id,
      user_id: user.id,
      signature_image: signatureData,
      employee_name: name || null,
      date_of_birth: dob || null,
      job_title: jobTitle || null,
      inducted_by: inductedBy || null,
      site: doc.site,
      language,
      acknowledgements: acks,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save signature.", variant: "destructive" });
      return;
    }
    toast({ title: "Signed", description: "Saved to your profile." });
    load();
  };

  const openEdit = () => {
    if (!doc) return;
    setEditTitle(doc.title);
    setEditContent(doc.content);
    setEditAcks(asArray(doc.acknowledgements).join("\n"));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!doc) return;
    const { error } = await supabase
      .from("hs_documents")
      .update({
        title: editTitle,
        content: editContent,
        acknowledgements: editAcks.split("\n").map((l) => l.trim()).filter(Boolean),
      })
      .eq("id", doc.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setEditOpen(false);
    toast({ title: "Saved", description: "Re-run translation to update other languages." });
    load();
  };

  if (loading || loadingData) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }
  if (!doc) {
    return <div className="p-6 text-muted-foreground">Document not found.</div>;
  }

  const backTo = doc.category === "fire_safety" ? "/fire-safety" : "/site-inductions";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={openEdit}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleTranslate} disabled={translating}>
                {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                Translate
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="text-xl">{title}</CardTitle>
            {signature && (
              <Badge className="gap-1">
                <CheckCircle className="h-3 w-3" /> Signed {new Date(signature.signed_at).toLocaleDateString("en-GB")}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {doc.reference_code && <span>{doc.reference_code}</span>}
            {doc.site && <span>• {doc.site}</span>}
            {doc.version && <span>• Version {doc.version}</span>}
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content || "") }}
          />
        </CardContent>
      </Card>

      {doc.requires_signature && !signature && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-lg">Confirm and sign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date of birth</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Job title</Label>
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Inducted by</Label>
                <Input value={inductedBy} onChange={(e) => setInductedBy(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              {acks.map((a, i) => (
                <label key={i} className="flex items-start gap-3 text-sm">
                  <Checkbox
                    checked={!!checked[i]}
                    onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [i]: !!v }))}
                    className="mt-0.5"
                  />
                  <span>{a}</span>
                </label>
              ))}
            </div>

            {!allChecked ? (
              <p className="text-sm text-muted-foreground">
                Tick every statement above to unlock the signature box.
              </p>
            ) : saving ? (
              <p className="text-sm text-muted-foreground">Saving…</p>
            ) : (
              <SignaturePad onSave={handleSign} onCancel={() => setChecked({})} />
            )}
          </CardContent>
        </Card>
      )}

      {signature && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <img
              src={signature.signature_image}
              alt="Your signature"
              className="h-24 rounded border bg-white p-2"
            />
            <p className="text-sm text-muted-foreground">
              {signature.employee_name} {signature.job_title ? `• ${signature.job_title}` : ""} • signed{" "}
              {new Date(signature.signed_at).toLocaleString("en-GB")}
              {signature.inducted_by ? ` • inducted by ${signature.inducted_by}` : ""}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Content (HTML)</Label>
              <Textarea rows={14} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Acknowledgement statements (one per line)</Label>
              <Textarea rows={6} value={editAcks} onChange={(e) => setEditAcks(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HSDocumentDetailPage;
