import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Languages, Loader2 } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { sanitizeHtml } from "@/lib/sanitize-html";
import clewsLogo from "@/assets/clews-logo.png";

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "PL", label: "Polski" },
  { code: "UK", label: "Українська" },
  { code: "RO", label: "Română" },
];

interface PublicDoc {
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

const asArray = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-hs-document`;

const PublicInductionPage = () => {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<PublicDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("EN");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [inductedBy, setInductedBy] = useState("");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${FUNCTION_URL}?token=${encodeURIComponent(token || "")}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "This link is not available");
        setDoc(data.document as PublicDoc);
      } catch (e) {
        setError(e instanceof Error ? e.message : "This link is not available");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token]);

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

  const handleSign = async (signatureData: string) => {
    if (!doc) return;
    setSaving(true);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name,
          date_of_birth: dob || null,
          job_title: jobTitle || null,
          inducted_by: inductedBy || null,
          language,
          acknowledgements: acks,
          signature_image: signatureData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your signature");
      setSigned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your signature");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center text-muted-foreground">
            {error || "This link is not available."}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="space-y-3 py-10 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-xl font-bold">Thank you, {name}</h1>
            <p className="text-sm text-muted-foreground">
              Your signature for “{doc.title}” has been recorded. You can close this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-white p-1.5 shadow-sm ring-1 ring-border">
            <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {doc.category === "fire_safety" ? "Fire Safety" : "Site Induction"}
          </p>
        </div>
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
        </div>
      </div>

      <Card className="overflow-hidden border-primary/20 shadow-sm">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-5 text-primary-foreground">
          <h1 className="text-lg font-bold leading-tight md:text-xl">{title}</h1>
        </div>
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
              [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border
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

      {doc.requires_signature && (
        <Card>
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

            {!name.trim() ? (
              <p className="text-sm text-muted-foreground">Enter your name to continue.</p>
            ) : !allChecked ? (
              <p className="text-sm text-muted-foreground">
                Tick every statement above to unlock the signature box.
              </p>
            ) : saving ? (
              <p className="text-sm text-muted-foreground">Saving…</p>
            ) : (
              <SignaturePad onSave={handleSign} onCancel={() => setChecked({})} />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PublicInductionPage;
