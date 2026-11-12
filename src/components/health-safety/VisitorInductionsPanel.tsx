import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Copy, Download, Plus, QrCode, Search, Truck, Building2 } from "lucide-react";
import { CompanyAccountPicker, type CompanyAccount } from "./CompanyAccountPicker";
import { downloadCsv } from "@/lib/csv-download";
import {
  VISITOR_INDUCTION_CATEGORY,
  inductionValidUntil,
  isInductionCurrent,
  visitReasonLabel,
} from "@/lib/visitor-induction";

interface VisitorDoc {
  id: string;
  title: string;
  reference_code: string | null;
  version: string | null;
  is_published: boolean;
}

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  view_count: number;
  customer_id: string | null;
}

interface VisitorSignature {
  id: string;
  document_id: string;
  employee_name: string | null;
  company_name: string | null;
  customer_id: string | null;
  phone: string | null;
  vehicle_registration: string | null;
  visit_reason: string | null;
  inducted_by: string | null;
  language: string;
  signed_at: string;
}

const linkUrl = (token: string) => `${window.location.origin}/induction/${token}`;
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { dateStyle: "medium" });
const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function VisitorInductionsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<VisitorDoc[]>([]);
  const [sigs, setSigs] = useState<VisitorSignature[]>([]);
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | "current" | "expired" | "unlinked">("all");

  const [shareDoc, setShareDoc] = useState<VisitorDoc | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newCompany, setNewCompany] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<ShareLink | null>(null);
  const [sigView, setSigView] = useState<{ row: VisitorSignature; image: string | null } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: d } = await supabase
      .from("hs_documents")
      .select("id, title, reference_code, version, is_published")
      .eq("category", VISITOR_INDUCTION_CATEGORY)
      .order("reference_code");
    const visitorDocs = (d as VisitorDoc[]) || [];
    setDocs(visitorDocs);
    const ids = visitorDocs.map((x) => x.id);
    const [{ data: s }, { data: c }] = await Promise.all([
      ids.length
        ? supabase
            .from("hs_document_guest_signatures")
            .select("id, document_id, employee_name, company_name, customer_id, phone, vehicle_registration, visit_reason, inducted_by, language, signed_at")
            .in("document_id", ids)
            .order("signed_at", { ascending: false })
            .limit(2000)
        : Promise.resolve({ data: [] }),
      supabase.from("customers").select("id, customer_name").order("customer_name").range(0, 9999),
    ]);
    setSigs((s as VisitorSignature[]) || []);
    setAccounts(((c as CompanyAccount[]) || []).filter((a) => a.customer_name));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.customer_name || ""])), [accounts]);

  const loadLinks = async (docId: string) => {
    const { data } = await supabase
      .from("hs_document_share_links")
      .select("id, token, label, is_active, view_count, customer_id")
      .eq("document_id", docId)
      .order("created_at", { ascending: true });
    setLinks((data as ShareLink[]) || []);
  };

  const openShare = (doc: VisitorDoc) => {
    setShareDoc(doc);
    setNewLabel("");
    setNewCompany(null);
    loadLinks(doc.id);
  };

  const createLink = async () => {
    if (!shareDoc) return;
    const label = newLabel.trim() || (newCompany ? accountName.get(newCompany) : null) || null;
    const { error } = await supabase
      .from("hs_document_share_links")
      .insert({ document_id: shareDoc.id, label, customer_id: newCompany, created_by: user?.id });
    if (error) {
      toast({ title: "Could not create link", description: error.message, variant: "destructive" });
      return;
    }
    setNewLabel("");
    setNewCompany(null);
    loadLinks(shareDoc.id);
  };

  const toggleLink = async (id: string, active: boolean) => {
    await supabase.from("hs_document_share_links").update({ is_active: active }).eq("id", id);
    if (shareDoc) loadLinks(shareDoc.id);
  };

  const copy = (token: string) => {
    navigator.clipboard.writeText(linkUrl(token));
    toast({ title: "Link copied" });
  };

  const downloadQr = (link: ShareLink) => {
    const canvas = document.getElementById(`qr-${link.id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `Unit17-induction-QR-${(link.label || "site").replace(/[^a-z0-9]+/gi, "-")}.png`;
    a.click();
  };

  const linkCompany = async (row: VisitorSignature, customerId: string | null) => {
    const { error } = await supabase
      .from("hs_document_guest_signatures")
      .update({ customer_id: customerId })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Could not link company", description: error.message, variant: "destructive" });
      return;
    }
    setSigs((prev) => prev.map((s) => (s.id === row.id ? { ...s, customer_id: customerId } : s)));
  };

  const openSignature = async (row: VisitorSignature) => {
    setSigView({ row, image: null });
    const { data } = await supabase
      .from("hs_document_guest_signatures")
      .select("signature_image")
      .eq("id", row.id)
      .maybeSingle();
    setSigView({ row, image: (data?.signature_image as string) || null });
  };

  const companyLabel = (s: VisitorSignature) => (s.customer_id ? accountName.get(s.customer_id) : null) || s.company_name || "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sigs.filter((s) => {
      if (companyFilter && s.customer_id !== companyFilter) return false;
      if (status === "current" && !isInductionCurrent(s.signed_at)) return false;
      if (status === "expired" && isInductionCurrent(s.signed_at)) return false;
      if (status === "unlinked" && s.customer_id) return false;
      if (!q) return true;
      return [s.employee_name, s.company_name, companyLabel(s), s.vehicle_registration, s.phone]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigs, search, companyFilter, status, accountName]);

  const currentCount = sigs.filter((s) => isInductionCurrent(s.signed_at)).length;
  const companyCount = new Set(sigs.map((s) => s.customer_id || (s.company_name || "").toLowerCase().trim()).filter(Boolean)).size;
  const unlinkedCount = sigs.filter((s) => !s.customer_id).length;
  const linkedAccounts = accounts.filter((a) => sigs.some((s) => s.customer_id === a.id));

  const exportCsv = () => {
    const header = ["Signed", "Name", "Company", "Linked account", "Reason", "Vehicle", "Mobile", "Clews contact", "Language", "Valid until", "Status"];
    const rows = filtered.map((s) => [
      fmtDateTime(s.signed_at),
      s.employee_name,
      s.company_name,
      s.customer_id ? accountName.get(s.customer_id) : "",
      visitReasonLabel(s.visit_reason),
      s.vehicle_registration,
      s.phone,
      s.inducted_by,
      s.language,
      fmtDate(inductionValidUntil(s.signed_at)),
      isInductionCurrent(s.signed_at) ? "Current" : "Expired",
    ]);
    downloadCsv([header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n"), `visitor-inductions-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="h-5 w-5 text-primary" /> Visitors, contractors &amp; hauliers
          </h2>
          <p className="text-sm text-muted-foreground">
            Third parties read and sign on their phone from a link or QR code. Each signature is linked to their company and lasts 12 months.
          </p>
        </div>
      </div>

      {docs.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No visitor induction set up yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {docs.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg leading-snug">{doc.title}</CardTitle>
                  {!doc.is_published && <Badge variant="secondary">Draft</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[doc.reference_code, doc.version && `Version ${doc.version}`].filter(Boolean).join(" • ")}
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link to={`/health-safety/documents/${doc.id}`}>
                    View / edit <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="sm" className="gap-2" onClick={() => openShare(doc)}>
                  <QrCode className="h-4 w-4" /> Links &amp; QR codes
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" /> Visitor induction register
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{currentCount} current</Badge>
              <Badge variant="secondary">{companyCount} companies</Badge>
              {unlinkedCount > 0 && (
                <Badge variant="outline" className="border-warning text-foreground">
                  {unlinkedCount} not linked to an account
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search name, company or registration" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <CompanyAccountPicker
              accounts={linkedAccounts}
              value={companyFilter}
              onChange={setCompanyFilter}
              allowClear
              placeholder="All companies"
              className="w-[220px]"
            />
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All signatures</SelectItem>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="unlinked">Not linked to account</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {sigs.length === 0 ? "No one has signed yet. Share a link or QR code to get started." : "No signatures match these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Signed</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Valid until</TableHead>
                    <TableHead className="text-right">Signature</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const current = isInductionCurrent(s.signed_at);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">{fmtDateTime(s.signed_at)}</TableCell>
                        <TableCell className="font-medium">{s.employee_name || "—"}</TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="space-y-1">
                            {s.company_name && (!s.customer_id || accountName.get(s.customer_id) !== s.company_name) && (
                              <p className="text-xs text-muted-foreground">Typed: {s.company_name}</p>
                            )}
                            <CompanyAccountPicker
                              accounts={accounts}
                              value={s.customer_id}
                              onChange={(id) => linkCompany(s, id)}
                              allowClear
                              size="sm"
                              placeholder="Link to account"
                              className={s.customer_id ? "w-full" : "w-full border-dashed text-muted-foreground"}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{visitReasonLabel(s.visit_reason)}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{s.vehicle_registration || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{s.phone || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={current ? "secondary" : "destructive"} className="tabular-nums">
                            {current ? fmtDate(inductionValidUntil(s.signed_at)) : "Expired"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openSignature(s)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!shareDoc} onOpenChange={(o) => !o && setShareDoc(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Links &amp; QR codes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Use the general link at the weighbridge — people type their company name. Create a company link to send to a haulier or contractor:
            everyone who signs from it is linked to that company automatically.
          </p>
          <div className="space-y-2 rounded-md border p-3">
            <CompanyAccountPicker
              accounts={accounts}
              value={newCompany}
              onChange={setNewCompany}
              allowClear
              placeholder="Company (optional)"
              className="w-full"
            />
            <div className="flex gap-2">
              <Input placeholder="Label (optional)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <Button onClick={createLink} className="shrink-0 gap-2">
                <Plus className="h-4 w-4" /> New link
              </Button>
            </div>
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">No links yet.</p>
            ) : (
              links.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.label || "Share link"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.customer_id ? `Linked to ${accountName.get(l.customer_id) || "company"}` : "Any company"} · {l.view_count} view
                      {l.view_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setQrLink(l)} title="Show QR code" aria-label="Show QR code">
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => copy(l.token)} title="Copy link" aria-label="Copy link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Switch checked={l.is_active} onCheckedChange={(v) => toggleLink(l.id, v)} aria-label="Link active" />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrLink} onOpenChange={(o) => !o && setQrLink(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrLink?.label || "Site induction"}</DialogTitle>
          </DialogHeader>
          {qrLink && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg border bg-card p-4">
                <QRCodeCanvas id={`qr-${qrLink.id}`} value={linkUrl(qrLink.token)} size={240} marginSize={2} />
              </div>
              <p className="text-center text-sm text-muted-foreground">Scan to read and sign the Unit 17 safety induction</p>
              {!qrLink.is_active && <Badge variant="destructive">This link is switched off</Badge>}
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={() => copy(qrLink.token)}>
                  <Copy className="h-4 w-4" /> Copy link
                </Button>
                <Button className="gap-2" onClick={() => downloadQr(qrLink)}>
                  <Download className="h-4 w-4" /> Download QR
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!sigView} onOpenChange={(o) => !o && setSigView(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{sigView?.row.employee_name || "Signature"}</DialogTitle>
          </DialogHeader>
          {sigView && (
            <div className="space-y-3 text-sm">
              {sigView.image ? (
                <img src={sigView.image} alt={`Signature of ${sigView.row.employee_name || "visitor"}`} className="h-28 w-full rounded border bg-card object-contain p-2" />
              ) : (
                <p className="text-muted-foreground">Loading signature…</p>
              )}
              <p>
                <span className="text-muted-foreground">Company:</span> {companyLabel(sigView.row)}
              </p>
              <p>
                <span className="text-muted-foreground">Signed:</span> {fmtDateTime(sigView.row.signed_at)} · {sigView.row.language}
              </p>
              {sigView.row.inducted_by && (
                <p>
                  <span className="text-muted-foreground">Clews contact:</span> {sigView.row.inducted_by}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
