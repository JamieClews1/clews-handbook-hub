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
import { ArrowLeft, CheckCircle, ChevronDown, Languages, Loader2, Pencil, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignaturePad } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { RichTextEditor } from "@/components/RichTextEditor";
import clewsLogo from "@/assets/clews-logo.png";
import FireSafetyPeopleCard from "@/components/fire-safety/FireSafetyPeopleCard";



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
  const [editLang, setEditLang] = useState("EN");
  const [editData, setEditData] = useState<Record<string, { title: string; content: string; acks: string }>>({});

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

  /** Build a standalone printable sheet for one or more languages. */
  const printInLanguages = (codes: string[]) => {
    if (!doc) return;
    const sections = codes
      .map((code) => {
        const sfx = code.toLowerCase();
        const t = code === "EN" ? doc.title : (doc as any)[`title_${sfx}`] || doc.title;
        const c = code === "EN" ? doc.content : (doc as any)[`content_${sfx}`] || doc.content;
        const baseAcks = asArray(doc.acknowledgements);
        const translatedAcks = code === "EN" ? baseAcks : asArray((doc as any)[`acknowledgements_${sfx}`]);
        const list = translatedAcks.length === baseAcks.length ? translatedAcks : baseAcks;
        const langLabel = LANGUAGES.find((l) => l.code === code)?.label || code;
        return `
          <section class="doc">
            <header class="hdr">
              <img src="${clewsLogo}" alt="Clews Recycling" />
              <div>
                <p class="kicker">${doc.category === "fire_safety" ? "Fire Safety" : "Site Induction"}</p>
                <h1>${t ?? ""}</h1>
              </div>
            </header>
            <div class="meta">
              <span><b>Reference:</b> ${doc.reference_code || "—"}</span>
              <span><b>Site:</b> ${doc.site || "All sites"}</span>
              <span><b>Version:</b> ${doc.version || "—"}</span>
              <span><b>Language:</b> ${langLabel}</span>
            </div>
            <div class="body">${sanitizeHtml(c || "")}</div>
            ${list.length ? `<div class="acks"><h3>Acknowledgements</h3><ul>${list
              .map((a) => `<li>${sanitizeHtml(a)}</li>`)
              .join("")}</ul></div>` : ""}
            <div class="sign">
              <div><span></span><label>Name</label></div>
              <div><span></span><label>Signature</label></div>
              <div><span></span><label>Date</label></div>
            </div>
            <footer>Clews Recycling Ltd · Unit 17 Waste Transfer Station · Health &amp; Safety controlled document</footer>
          </section>`;
      })
      .join("");

    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast({ title: "Pop-up blocked", description: "Allow pop-ups to print this document.", variant: "destructive" });
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${doc.title}</title>
      <style>
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; line-height: 1.45; margin: 0; }
        .doc { page-break-after: always; }
        .doc:last-child { page-break-after: auto; }
        .hdr { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #1f9d55; padding-bottom: 10px; }
        .hdr img { height: 42px; }
        .kicker { margin: 0; font-size: 8pt; letter-spacing: .18em; text-transform: uppercase; color: #555; }
        h1 { margin: 2px 0 0; font-size: 15pt; }
        .meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 9pt; padding: 8px 0; border-bottom: 1px solid #ddd; margin-bottom: 12px; }
        .body h1, .body h2 { font-size: 12pt; border-left: 3px solid #1f9d55; padding: 4px 8px; background: #f2faf5; margin: 16px 0 8px; }
        .body h3, .body h4 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .04em; color: #1f7a45; margin: 12px 0 6px; }
        .body ul, .body ol { padding-left: 18px; margin: 8px 0; }
        .body table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .body th, .body td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; font-size: 10pt; }
        .body th { background: #f1f1f1; }
        .acks { margin-top: 16px; border: 1px solid #ccc; padding: 10px 12px; page-break-inside: avoid; }
        .acks h3 { margin: 0 0 6px; font-size: 10.5pt; }
        .acks ul { margin: 0; padding-left: 18px; }
        .sign { display: flex; gap: 20px; margin-top: 22px; page-break-inside: avoid; }
        .sign div { flex: 1; }
        .sign span { display: block; height: 34px; border-bottom: 1px solid #333; }
        .sign label { font-size: 8.5pt; color: #555; }
        footer { margin-top: 18px; border-top: 1px solid #ddd; padding-top: 6px; font-size: 8pt; color: #666; }
      </style></head><body>${sections}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

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
    const data: Record<string, { title: string; content: string; acks: string }> = {
      EN: {
        title: doc.title,
        content: doc.content,
        acks: asArray(doc.acknowledgements).join("\n"),
      },
    };
    for (const code of ["PL", "UK", "RO"]) {
      const sfx = code.toLowerCase();
      data[code] = {
        title: (doc as any)[`title_${sfx}`] || "",
        content: (doc as any)[`content_${sfx}`] || "",
        acks: asArray((doc as any)[`acknowledgements_${sfx}`]).join("\n"),
      };
    }
    setEditData(data);
    setEditLang("EN");
    setEditOpen(true);
  };

  const updateEditField = (field: "title" | "content" | "acks", value: string) =>
    setEditData((prev) => ({ ...prev, [editLang]: { ...prev[editLang], [field]: value } }));

  const saveEdit = async () => {
    if (!doc) return;
    const update: Record<string, unknown> = {};
    for (const [code, d] of Object.entries(editData)) {
      const acks = d.acks.split("\n").map((l) => l.trim()).filter(Boolean);
      if (code === "EN") {
        update.title = d.title;
        update.content = d.content;
        update.acknowledgements = acks;
      } else {
        const sfx = code.toLowerCase();
        update[`title_${sfx}`] = d.title || null;
        update[`content_${sfx}`] = d.content || null;
        update[`acknowledgements_${sfx}`] = acks;
      }
    }
    const { error } = await supabase.from("hs_documents").update(update).eq("id", doc.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setEditOpen(false);
    toast({
      title: "Saved",
      description:
        editLang === "EN"
          ? "Re-run translation to update other languages."
          : "Translation updated. Note: re-running Translate will overwrite manual edits.",
    });
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Printer className="h-4 w-4" /> Print <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Print in language</DropdownMenuLabel>
              {LANGUAGES.map((l) => (
                <DropdownMenuItem key={l.code} onSelect={() => printInLanguages([l.code])}>
                  {l.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => printInLanguages(LANGUAGES.map((l) => l.code))}>
                All languages
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      <Card className="overflow-hidden border-primary/20 shadow-sm">
        {/* Branded document header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-5 text-primary-foreground">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-md bg-white/95 p-2">
                <img src={clewsLogo} alt="Clews Recycling" className="h-9 w-auto" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/80">
                  {doc.category === "fire_safety" ? "Fire Safety" : "Site Induction"}
                </p>
                <h1 className="text-lg font-bold leading-tight md:text-xl">{title}</h1>
              </div>
            </div>
            {signature && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" /> Signed {new Date(signature.signed_at).toLocaleDateString("en-GB")}
              </Badge>
            )}
          </div>
        </div>

        {/* Document meta strip */}
        <div className="grid grid-cols-2 gap-px border-b bg-border md:grid-cols-4">
          {[
            { label: "Reference", value: doc.reference_code || "—" },
            { label: "Site", value: doc.site || "All sites" },
            { label: "Version", value: doc.version || "—" },
            { label: "Language", value: LANGUAGES.find((l) => l.code === language)?.label || "English" },
          ].map((m) => (
            <div key={m.label} className="bg-card px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className="truncate text-sm font-medium">{m.value}</p>
            </div>
          ))}
        </div>

        <CardContent className="pt-6">
          <div
            className="hs-doc max-w-none text-sm leading-relaxed
              [&>h1]:mt-8 [&>h1]:mb-3 [&>h1]:border-l-4 [&>h1]:border-primary [&>h1]:bg-primary/5 [&>h1]:px-3 [&>h1]:py-2 [&>h1]:text-base [&>h1]:font-bold [&>h1]:tracking-tight [&>h1]:first:mt-0
              [&>h2]:mt-8 [&>h2]:mb-3 [&>h2]:border-l-4 [&>h2]:border-primary [&>h2]:bg-primary/5 [&>h2]:px-3 [&>h2]:py-2 [&>h2]:text-base [&>h2]:font-bold [&>h2]:tracking-tight [&>h2]:first:mt-0
              [&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:text-primary
              [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-primary

              [&_p]:my-3
              [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ul]:marker:text-primary
              [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6 [&_ol]:marker:text-primary
              [&_strong]:font-semibold [&_strong]:text-foreground
              [&_a]:text-primary [&_a]:underline
              [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-md [&_table]:border
              [&_th]:border [&_th]:bg-muted/60 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold
              [&_td]:border [&_td]:px-3 [&_td]:py-2"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content || "") }}
          />
        </CardContent>

        <div className="border-t bg-muted/30 px-6 py-3 text-xs text-muted-foreground">
          Clews Recycling Ltd · Unit 17 Waste Transfer Station · Health &amp; Safety controlled document
        </div>
      </Card>

      <FireSafetyPeopleCard />




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
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((l) => (
                  <Button
                    key={l.code}
                    type="button"
                    size="sm"
                    variant={editLang === l.code ? "default" : "outline"}
                    onClick={() => setEditLang(l.code)}
                  >
                    {l.label}
                  </Button>
                ))}
              </div>
              {editLang !== "EN" && (
                <p className="text-xs text-muted-foreground">
                  Editing the {LANGUAGES.find((l) => l.code === editLang)?.label} translation. Re-running Translate will
                  overwrite these manual edits.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={editData[editLang]?.title ?? ""}
                onChange={(e) => updateEditField("title", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <p className="text-xs text-muted-foreground">
                Use Heading 1 for section titles and Heading 2 for sub-headings so the document keeps its branded layout.
              </p>
              <RichTextEditor
                key={editLang}
                content={editData[editLang]?.content ?? ""}
                onChange={(v) => updateEditField("content", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Acknowledgement statements (one per line)</Label>
              <Textarea
                rows={6}
                value={editData[editLang]?.acks ?? ""}
                onChange={(e) => updateEditField("acks", e.target.value)}
              />
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
