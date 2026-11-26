import { PageHeading } from "@/components/PageHeading";
import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle, AlertTriangle, ClipboardSignature, Pencil, Plus, Link2 } from "lucide-react";
import { ToolboxTalkShareDialog } from "@/components/ToolboxTalkShareDialog";
import { ToolboxTalkCoverage } from "@/components/ToolboxTalkCoverage";
import type { CoverageProfile, CoverageSignature } from "@/lib/toolbox-talk-coverage";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolboxTalkBuilder } from "@/components/ToolboxTalkBuilder";
import { manageHref, readManageView } from "@/lib/hs-manage-view";
import { AUDIENCE_LABELS, sortTalks, talkAppliesTo, talkPreview, type TalkSort } from "@/lib/toolbox-talk-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ToolboxTalk {
  id: string;
  reference_code: string;
  title: string;
  content: string;
  user_types: string[];
  assigned_users: string[] | null;
  is_mandatory: boolean;
  created_date: string;
}

const ToolboxTalksPage = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [toolboxTalks, setToolboxTalks] = useState<ToolboxTalk[]>([]);
  const [signedTalkIds, setSignedTalkIds] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [myTypes, setMyTypes] = useState<string[]>([]);
  const [sort, setSort] = useState<TalkSort>("newest");
  const [show, setShow] = useState<"mine" | "all" | "to-sign" | "signed">("all");
  const [shareTalk, setShareTalk] = useState<ToolboxTalk | null>(null);
  const [coverageProfiles, setCoverageProfiles] = useState<CoverageProfile[]>([]);
  const [coverageSignatures, setCoverageSignatures] = useState<CoverageSignature[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch user profile to get user_types
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_types")
          .eq("id", user.id)
          .single();

        const types = profile?.user_types || [];
        setMyTypes(types);

        // Fetch published toolbox talks
        const { data: talks } = await supabase
          .from("toolbox_talks")
          .select("*")
          .eq("is_published", true);

        // Admins can see every published talk (to check new ones); everyone else
        // sees talks for their user type or assigned to them by name.
        const all = (talks || []) as ToolboxTalk[];
        setToolboxTalks(isAdmin ? all : all.filter(talk => talkAppliesTo(talk, user.id, types)));

        // Fetch user's signatures
        const { data: signatures } = await supabase
          .from("toolbox_talk_signatures")
          .select("toolbox_talk_id")
          .eq("user_id", user.id);

        setSignedTalkIds(new Set(signatures?.map(s => s.toolbox_talk_id) || []));

        // Managers also see how much of the signing each audience group still
        // owes. Reading every profile and sign-off needs staff-wide access, so
        // this is only fetched for admins - everyone else keeps their own view.
        if (isAdmin) {
          const [{ data: staff }, { data: allSignatures }] = await Promise.all([
            supabase
              .from("profiles")
              .select("id, user_types, is_archived, left_at")
              .not("is_archived", "is", true)
              .is("left_at", null),
            supabase.from("toolbox_talk_signatures").select("user_id, toolbox_talk_id"),
          ]);
          setCoverageProfiles(staff || []);
          setCoverageSignatures(allSignatures || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [user, isAdmin]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isMine = (t: ToolboxTalk) => talkAppliesTo(t, user.id, myTypes);
  const pendingMandatory = toolboxTalks.filter(
    t => isMine(t) && t.is_mandatory && !signedTalkIds.has(t.id)
  ).length;
  const filtered = toolboxTalks.filter(t => {
    if (show === "mine") return isMine(t);
    if (show === "to-sign") return isMine(t) && !signedTalkIds.has(t.id);
    if (show === "signed") return signedTalkIds.has(t.id);
    return true;
  });
  const visibleTalks = sortTalks(filtered, sort, signedTalkIds);
  const showOptions: { value: typeof show; label: string }[] = [
    { value: "all", label: "All talks" },
    ...(isAdmin ? [{ value: "mine" as const, label: "Assigned to me" }] : []),
    { value: "to-sign", label: "To sign" },
    { value: "signed", label: "Signed" },
  ];

  const { manage, editId, startNew } = readManageView(searchParams, isAdmin);
  const setView = (v: string) => setSearchParams(v === "manage" ? { view: "manage" } : {});

  return (
    <div className="min-h-screen bg-background">
      <section className="container mx-auto px-4 pt-6">
        <div>
          <PageHeading title="Toolbox Talks" description="Safety briefings and signatures" actions={isAdmin ? (
            <>
              <Button asChild variant="outline"><Link to="/mass-sign-off"><ClipboardSignature className="h-4 w-4 mr-2" />Mass Sign-Off</Link></Button>
              <Button asChild><Link to={manageHref("/toolbox-talks", { startNew: true })}><Plus className="h-4 w-4 mr-2" />New Toolbox Talk</Link></Button>
            </>
          ) : undefined} />
          {isAdmin && (
            <Tabs value={manage ? "manage" : "documents"} onValueChange={setView} className="mt-4">
              <TabsList>
                <TabsTrigger value="documents">My talks</TabsTrigger>
                <TabsTrigger value="manage">Manage</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {!manage && pendingMandatory > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-full">
              <AlertTriangle className="h-5 w-5" />
              <span>{pendingMandatory} mandatory talk{pendingMandatory > 1 ? "s" : ""} pending signature</span>
            </div>
          )}
        </div>
      </section>

      {manage ? (
        <main className="container max-w-screen-2xl mx-auto px-4 py-6">
          <ToolboxTalkBuilder initialEditId={editId} startNew={startNew} onInitialApplied={() => setSearchParams({ view: "manage" }, { replace: true })} />
        </main>
      ) : (
      <main className="container max-w-screen-2xl mx-auto px-4 py-6">
        {isAdmin && (
          <div className="mb-4">
            <ToolboxTalkCoverage
              talks={toolboxTalks}
              profiles={coverageProfiles}
              signatures={coverageSignatures}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            {showOptions.map(o => (
              <Button key={o.value} size="sm" variant={show === o.value ? "default" : "outline"} onClick={() => setShow(o.value)}>
                {o.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort</span>
            <Select value={sort} onValueChange={(v) => setSort(v as TalkSort)}>
              <SelectTrigger className="w-[190px]" aria-label="Sort talks"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="to-sign">Needs signing first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {visibleTalks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {toolboxTalks.length === 0 ? "No Toolbox Talks are currently assigned to your user type." : "No talks match this view."}
              </p>
              {isAdmin && toolboxTalks.length === 0 && <Button variant="outline" className="mt-4" onClick={() => setView("manage")}>Manage Toolbox Talks</Button>}
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleTalks.map(talk => {
              const isSigned = signedTalkIds.has(talk.id);
              const mine = isMine(talk);
              return (
                <li key={talk.id}>
                  <Card
                    className={`cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70 border-l-4 ${isSigned ? "border-l-success" : mine && talk.is_mandatory ? "border-l-destructive" : "border-l-border"}`}
                    onClick={() => navigate(`/toolbox-talks/${talk.id}`)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded tabular-nums">
                            {talk.reference_code}
                          </span>
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {new Date(talk.created_date).toLocaleDateString("en-GB")}
                          </span>
                          {talk.is_mandatory && <Badge variant="destructive">Mandatory</Badge>}
                          {isSigned && (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                              <CheckCircle className="h-3 w-3 mr-1" />Signed
                            </Badge>
                          )}
                          {isAdmin && !mine && <Badge variant="secondary">Not assigned to you</Badge>}
                        </div>
                        <h3 className="text-lg font-semibold leading-snug">{talk.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{talkPreview(talk.content)}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(talk.user_types || []).map(ut => (
                            <Badge key={ut} variant="outline" className="font-normal">{AUDIENCE_LABELS[ut] ?? ut}</Badge>
                          ))}
                          {(talk.assigned_users?.length ?? 0) > 0 && (
                            <Badge variant="outline" className="font-normal">+{talk.assigned_users!.length} named</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {isAdmin && (
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(manageHref("/toolbox-talks", { editId: talk.id })); }}>
                            <Pencil className="h-4 w-4 mr-1" />Edit
                          </Button>
                        )}
                        {isAdmin && (
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setShareTalk(talk); }}>
                            <Link2 className="h-4 w-4 mr-1" />Share
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={isSigned || !mine ? "outline" : "default"}
                          onClick={(e) => { e.stopPropagation(); navigate(`/toolbox-talks/${talk.id}`); }}
                        >
                          {isSigned || !mine ? "View" : "View & Sign"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      )}
      {isAdmin && <ToolboxTalkShareDialog talk={shareTalk} onOpenChange={(open) => !open && setShareTalk(null)} />}
    </div>
  );
};

export default ToolboxTalksPage;
