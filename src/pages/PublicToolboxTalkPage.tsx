import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const DECLARATION: Record<string, string> = {
  EN: "I have read, understood and will follow the guidelines in this Toolbox Talk.",
  PL: "Przeczytałem/am, zrozumiałem/am i będę przestrzegać wytycznych zawartych w tym szkoleniu (Toolbox Talk).",
  UK: "Я прочитав(ла), зрозумів(ла) і буду дотримуватися вказівок цього інструктажу (Toolbox Talk).",
  RO: "Am citit, am înțeles și voi respecta instrucțiunile din acest Toolbox Talk.",
};

interface PublicTalk {
  id: string;
  reference_code: string;
  title: string;
  title_pl: string | null;
  title_uk: string | null;
  title_ro: string | null;
  content: string;
  content_pl: string | null;
  content_uk: string | null;
  content_ro: string | null;
  is_mandatory: boolean;
  created_date: string;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-toolbox-talk`;

const PublicToolboxTalkPage = () => {
  const { token } = useParams<{ token: string }>();
  const [talk, setTalk] = useState<PublicTalk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("EN");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<Date | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${FUNCTION_URL}?token=${encodeURIComponent(token || "")}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "This link is not available");
        setTalk(data.talk as PublicTalk);
      } catch (e) {
        setError(e instanceof Error ? e.message : "This link is not available");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token]);

  useEffect(() => {
    if (talk) document.title = `${talk.reference_code} ${talk.title} | Clews Recycling`;
  }, [talk]);

  const suffix = language.toLowerCase() as "pl" | "uk" | "ro";
  const title = language === "EN" ? talk?.title : talk?.[`title_${suffix}`] || talk?.title;
  const content = language === "EN" ? talk?.content : talk?.[`content_${suffix}`] || talk?.content;
  const translationMissing = language !== "EN" && !!talk && !talk[`content_${suffix}`];

  const handleSign = async (signatureData: string) => {
    setSaving(true);
    setSignError(null);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          company_name: company.trim() || null,
          job_title: jobTitle.trim() || null,
          language,
          signature_image: signatureData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your signature");
      setSignedAt(new Date());
    } catch (e) {
      setSignError(e instanceof Error ? e.message : "Could not save your signature");
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

  if (error || !talk) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center text-muted-foreground">{error || "This link is not available."}</CardContent>
        </Card>
      </div>
    );
  }

  if (signedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="space-y-3 py-10 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-xl font-bold">Thank you, {name.trim()}</h1>
            <p className="text-muted-foreground">
              Your signature for {talk.reference_code} “{talk.title}” has been recorded on{" "}
              {signedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.
            </p>
            <p className="text-sm text-muted-foreground">You can close this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-card p-1.5 shadow-sm ring-1 ring-border">
            <img src={clewsLogo} alt="Clews Recycling" className="h-8 w-auto" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Toolbox Talk</p>
        </div>
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-10 w-[150px]" aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b bg-primary px-6 py-5 text-primary-foreground">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-sm opacity-90">
            <span className="font-semibold tabular-nums">{talk.reference_code}</span>
            <span>·</span>
            <span className="tabular-nums">{new Date(talk.created_date).toLocaleDateString("en-GB")}</span>
            {talk.is_mandatory && <Badge variant="secondary">Mandatory</Badge>}
          </div>
          <h1 className="text-xl font-bold leading-tight md:text-2xl">{title}</h1>
        </div>
        <CardContent className="pt-6">
          {translationMissing && (
            <p className="mb-4 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              This talk isn't translated yet, so it's shown in English.
            </p>
          )}
          <div className="rich-content text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content || "") }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Confirm and sign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tbt-name">Full name *</Label>
              <Input id="tbt-name" autoComplete="name" className="h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tbt-company">Company (if not Clews)</Label>
              <Input id="tbt-company" autoComplete="organization" className="h-11 text-base" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tbt-job">Job title</Label>
              <Input id="tbt-job" className="h-11 text-base" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
            <span>{DECLARATION[language] || DECLARATION.EN}</span>
          </label>

          {!name.trim() ? (
            <p className="text-muted-foreground">Enter your full name to continue.</p>
          ) : !agreed ? (
            <p className="text-muted-foreground">Tick the statement above to unlock the signature box.</p>
          ) : saving ? (
            <p className="text-muted-foreground">Saving…</p>
          ) : (
            <SignaturePad onSave={handleSign} onCancel={() => setAgreed(false)} />
          )}
          {signError && <p className="text-destructive">{signError} Your details are kept — please try again.</p>}
        </CardContent>
      </Card>

      <p className="pb-6 text-center text-sm text-muted-foreground">Clews Recycling Ltd · Health &amp; Safety Toolbox Talk</p>
    </div>
  );
};

export default PublicToolboxTalkPage;
