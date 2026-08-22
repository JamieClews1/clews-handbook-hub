import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, ClipboardCheck, Flame, AlertTriangle, ArrowRight, Users } from "lucide-react";

export interface HSDocument {
  id: string;
  category: string;
  reference_code: string | null;
  title: string;
  content: string;
  site: string | null;
  version: string | null;
  requires_signature: boolean;
  is_published: boolean;
  updated_at: string;
}

interface Props {
  category: "site_induction" | "fire_safety";
  heading: string;
  description: string;
  hideHeader?: boolean;
}


interface StaffRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

const HSDocumentsPage = ({ category, heading, description, hideHeader }: Props) => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [docs, setDocs] = useState<HSDocument[]>([]);
  const [signedIds, setSignedIds] = useState<Set<string>>(new Set());
  const [mySignedAt, setMySignedAt] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [allSigs, setAllSigs] = useState<{ document_id: string; user_id: string; signed_at: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoadingData(true);
      const [{ data: documents }, { data: sigs }] = await Promise.all([
        supabase
          .from("hs_documents")
          .select("*")
          .eq("category", category)
          .eq("is_published", true)
          .order("reference_code"),
        supabase
          .from("hs_document_signatures")
          .select("document_id, signed_at")
          .eq("user_id", user.id),
      ]);
      setDocs((documents as HSDocument[]) || []);
      setSignedIds(new Set((sigs || []).map((s) => s.document_id)));
      setMySignedAt(
        Object.fromEntries((sigs || []).map((s) => [s.document_id, s.signed_at as string]))
      );
      setLoadingData(false);
    };
    run();
  }, [user, category]);

  useEffect(() => {
    const run = async () => {
      if (!user || !isAdmin) return;
      const [{ data: profiles }, { data: portal }, { data: sigs }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("full_name"),
        supabase.from("customer_portal_memberships").select("user_id"),
        supabase.from("hs_document_signatures").select("document_id, user_id, signed_at"),
      ]);
      const portalIds = new Set((portal || []).map((p) => p.user_id));
      setStaff(((profiles as StaffRow[]) || []).filter((p) => !portalIds.has(p.id)));
      setAllSigs((sigs as { document_id: string; user_id: string; signed_at: string }[]) || []);
    };
    run();
  }, [user, isAdmin]);

  const Icon = category === "fire_safety" ? Flame : ClipboardCheck;
  const outstanding = docs.filter((d) => d.requires_signature && !signedIds.has(d.id)).length;


  return (
    <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>

      {outstanding > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm">
              You have <strong>{outstanding}</strong> document{outstanding > 1 ? "s" : ""} awaiting your signature.
            </p>
          </CardContent>
        </Card>
      )}

      {loadingData ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No documents published yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {docs.map((doc) => {
            const signed = signedIds.has(doc.id);
            return (
              <Card key={doc.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg leading-snug">{doc.title}</CardTitle>
                    {doc.requires_signature &&
                      (signed ? (
                        <Badge className="gap-1 shrink-0">
                          <CheckCircle className="h-3 w-3" /> Signed
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="shrink-0">
                          Signature required
                        </Badge>
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                    {doc.reference_code && <span>{doc.reference_code}</span>}
                    {doc.site && <span>• {doc.site}</span>}
                    {doc.version && <span>• Version {doc.version}</span>}
                  </div>
                  {signed && mySignedAt[doc.id] && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      You signed on {formatDate(mySignedAt[doc.id])}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild size="sm" className="gap-2">
                    <Link to={`/health-safety/documents/${doc.id}`}>
                      {signed ? "View" : "Read & sign"} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

      )}

      {isAdmin && docs.some((d) => d.requires_signature) && staff.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" /> Signature tracker
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Who has signed each document, and who is still outstanding.
            </p>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {docs
                .filter((d) => d.requires_signature)
                .map((doc) => {
                  const byUser = new Map(
                    allSigs.filter((s) => s.document_id === doc.id).map((s) => [s.user_id, s.signed_at])
                  );
                  const signedStaff = staff.filter((s) => byUser.has(s.id));
                  const pendingStaff = staff.filter((s) => !byUser.has(s.id));
                  return (
                    <AccordionItem key={doc.id} value={doc.id}>
                      <AccordionTrigger>
                        <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-3 text-left">
                          <span className="text-sm font-medium">{doc.title}</span>
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary">{signedStaff.length} signed</Badge>
                            {pendingStaff.length > 0 && (
                              <Badge variant="destructive">{pendingStaff.length} outstanding</Badge>
                            )}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                              Yet to sign ({pendingStaff.length})
                            </p>
                            {pendingStaff.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Everyone has signed.</p>
                            ) : (
                              <ul className="space-y-1">
                                {pendingStaff.map((s) => (
                                  <li
                                    key={s.id}
                                    className="rounded border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm"
                                  >
                                    {s.full_name || s.email || "Unnamed user"}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Signed ({signedStaff.length})
                            </p>
                            {signedStaff.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No signatures yet.</p>
                            ) : (
                              <ul className="space-y-1">
                                {signedStaff.map((s) => (
                                  <li
                                    key={s.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-1.5 text-sm"
                                  >
                                    <span>{s.full_name || s.email || "Unnamed user"}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(byUser.get(s.id)!)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>

  );
};

export default HSDocumentsPage;
