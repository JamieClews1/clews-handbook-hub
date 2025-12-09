import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle, AlertCircle, FileText, User, Clock, BookOpen, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  user_types: string[];
}

interface RAMS {
  id: string;
  title: string;
  reference_code: string;
  is_mandatory: boolean;
  user_types: string[];
  review_date: string;
}

interface ToolboxTalk {
  id: string;
  title: string;
  reference_code: string;
  is_mandatory: boolean;
  user_types: string[];
  is_published: boolean;
}

interface Signature {
  rams_id?: string;
  toolbox_talk_id?: string;
  signed_at: string;
}

interface HandbookSignature {
  signed_at: string;
  employee_name: string;
}

const userTypeLabels: Record<string, string> = {
  driver: "Driver",
  yard: "Yard",
  office: "Office",
  management: "Management",
};

const MyProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allRAMS, setAllRAMS] = useState<RAMS[]>([]);
  const [signedRAMS, setSignedRAMS] = useState<Signature[]>([]);
  const [allToolboxTalks, setAllToolboxTalks] = useState<ToolboxTalk[]>([]);
  const [signedToolboxTalks, setSignedToolboxTalks] = useState<Signature[]>([]);
  const [handbookSignature, setHandbookSignature] = useState<HandbookSignature | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [
        profileResult,
        ramsResult,
        ramsSignaturesResult,
        toolboxResult,
        toolboxSignaturesResult,
        handbookSignatureResult
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, user_types")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase
          .from("rams")
          .select("id, title, reference_code, is_mandatory, user_types, review_date")
          .order("reference_code"),
        supabase
          .from("rams_user_signatures")
          .select("rams_id, signed_at")
          .eq("user_id", user!.id),
        supabase
          .from("toolbox_talks")
          .select("id, title, reference_code, is_mandatory, user_types, is_published")
          .eq("is_published", true)
          .order("reference_code"),
        supabase
          .from("toolbox_talk_signatures")
          .select("toolbox_talk_id, signed_at")
          .eq("user_id", user!.id),
        supabase
          .from("handbook_signatures")
          .select("signed_at, employee_name")
          .eq("user_id", user!.id)
          .maybeSingle()
      ]);

      if (profileResult.error) throw profileResult.error;
      setProfile(profileResult.data);

      if (ramsResult.error) throw ramsResult.error;
      setAllRAMS(ramsResult.data || []);

      if (ramsSignaturesResult.error) throw ramsSignaturesResult.error;
      setSignedRAMS(ramsSignaturesResult.data || []);

      if (toolboxResult.error) throw toolboxResult.error;
      setAllToolboxTalks(toolboxResult.data || []);

      if (toolboxSignaturesResult.error) throw toolboxSignaturesResult.error;
      setSignedToolboxTalks(toolboxSignaturesResult.data || []);

      if (handbookSignatureResult.error && handbookSignatureResult.error.code !== 'PGRST116') {
        throw handbookSignatureResult.error;
      }
      setHandbookSignature(handbookSignatureResult.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const signedRAMSIds = new Set(signedRAMS.map(s => s.rams_id));
  const signedToolboxIds = new Set(signedToolboxTalks.map(s => s.toolbox_talk_id));
  
  // Filter RAMS relevant to user's types
  const relevantRAMS = allRAMS.filter(rams => {
    if (!profile.user_types || profile.user_types.length === 0) return false;
    return rams.user_types.some(type => 
      profile.user_types.includes(type.toLowerCase())
    );
  });

  // Filter Toolbox Talks relevant to user's types
  const relevantToolboxTalks = allToolboxTalks.filter(talk => {
    if (!profile.user_types || profile.user_types.length === 0) return false;
    return talk.user_types.some(type => 
      profile.user_types.includes(type.toLowerCase())
    );
  });

  const completedRAMS = relevantRAMS.filter(rams => signedRAMSIds.has(rams.id));
  const mandatoryPendingRAMS = relevantRAMS.filter(rams => 
    rams.is_mandatory && !signedRAMSIds.has(rams.id)
  );
  const optionalPendingRAMS = relevantRAMS.filter(rams => 
    !rams.is_mandatory && !signedRAMSIds.has(rams.id)
  );

  const completedToolboxTalks = relevantToolboxTalks.filter(talk => signedToolboxIds.has(talk.id));
  const mandatoryPendingToolbox = relevantToolboxTalks.filter(talk => 
    talk.is_mandatory && !signedToolboxIds.has(talk.id)
  );
  const optionalPendingToolbox = relevantToolboxTalks.filter(talk => 
    !talk.is_mandatory && !signedToolboxIds.has(talk.id)
  );

  const totalMandatoryPending = mandatoryPendingRAMS.length + mandatoryPendingToolbox.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-foreground">My Profile</h1>
              </div>
            </div>
            <Link to="/portal">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Portal
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Handbook Status Banner */}
          <Card className={`${handbookSignature ? 'border-primary bg-primary/5' : 'border-destructive bg-destructive/5'}`}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className={`h-6 w-6 ${handbookSignature ? 'text-primary' : 'text-destructive'}`} />
                  <div>
                    <p className="font-semibold">Employee Handbook</p>
                    {handbookSignature ? (
                      <p className="text-sm text-muted-foreground">
                        Signed on {new Date(handbookSignature.signed_at).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-sm text-destructive">Not yet signed - Please read and sign the handbook</p>
                    )}
                  </div>
                </div>
                <Link to="/handbook">
                  <Button variant={handbookSignature ? "outline" : "destructive"} size="sm">
                    {handbookSignature ? "View Handbook" : "Sign Handbook"}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{profile.full_name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile.email}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Assigned Roles</p>
                <div className="flex flex-wrap gap-2">
                  {profile.user_types && profile.user_types.length > 0 ? (
                    profile.user_types.map(type => (
                      <Badge key={type} variant="secondary">
                        {userTypeLabels[type] || type}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">No roles assigned yet</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overall Summary Cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{totalMandatoryPending}</p>
                    <p className="text-sm text-muted-foreground">Total Mandatory Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-warning">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-warning" />
                  <div>
                    <p className="text-2xl font-bold">{optionalPendingRAMS.length + optionalPendingToolbox.length}</p>
                    <p className="text-sm text-muted-foreground">Total Optional Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{completedRAMS.length + completedToolboxTalks.length}</p>
                    <p className="text-sm text-muted-foreground">Total Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RAMS Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                RAMS Status
              </CardTitle>
              <CardDescription>
                Risk Assessments and Method Statements relevant to your roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="pending" className="gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Pending ({mandatoryPendingRAMS.length + optionalPendingRAMS.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Completed ({completedRAMS.length})
                  </TabsTrigger>
                  <TabsTrigger value="all">
                    All ({relevantRAMS.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-3 mt-4">
                  {mandatoryPendingRAMS.length === 0 && optionalPendingRAMS.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      All caught up! No pending RAMS to complete.
                    </p>
                  ) : (
                    <>
                      {mandatoryPendingRAMS.map(rams => (
                        <DocumentItem 
                          key={rams.id} 
                          item={rams} 
                          status="mandatory"
                          type="rams"
                        />
                      ))}
                      {optionalPendingRAMS.map(rams => (
                        <DocumentItem 
                          key={rams.id} 
                          item={rams} 
                          status="pending"
                          type="rams"
                        />
                      ))}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-3 mt-4">
                  {completedRAMS.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No completed RAMS yet.
                    </p>
                  ) : (
                    completedRAMS.map(rams => {
                      const signature = signedRAMS.find(s => s.rams_id === rams.id);
                      return (
                        <DocumentItem 
                          key={rams.id} 
                          item={rams} 
                          status="completed"
                          type="rams"
                          signedAt={signature?.signed_at}
                        />
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="all" className="space-y-3 mt-4">
                  {relevantRAMS.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No RAMS assigned to your roles yet.
                    </p>
                  ) : (
                    relevantRAMS.map(rams => {
                      const isSigned = signedRAMSIds.has(rams.id);
                      const signature = signedRAMS.find(s => s.rams_id === rams.id);
                      return (
                        <DocumentItem 
                          key={rams.id} 
                          item={rams} 
                          status={isSigned ? "completed" : (rams.is_mandatory ? "mandatory" : "pending")}
                          type="rams"
                          signedAt={signature?.signed_at}
                        />
                      );
                    })
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Toolbox Talks Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Toolbox Talks Status
              </CardTitle>
              <CardDescription>
                Toolbox Talks relevant to your roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="pending" className="gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Pending ({mandatoryPendingToolbox.length + optionalPendingToolbox.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Completed ({completedToolboxTalks.length})
                  </TabsTrigger>
                  <TabsTrigger value="all">
                    All ({relevantToolboxTalks.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="space-y-3 mt-4">
                  {mandatoryPendingToolbox.length === 0 && optionalPendingToolbox.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      All caught up! No pending Toolbox Talks to complete.
                    </p>
                  ) : (
                    <>
                      {mandatoryPendingToolbox.map(talk => (
                        <DocumentItem 
                          key={talk.id} 
                          item={talk} 
                          status="mandatory"
                          type="toolbox"
                        />
                      ))}
                      {optionalPendingToolbox.map(talk => (
                        <DocumentItem 
                          key={talk.id} 
                          item={talk} 
                          status="pending"
                          type="toolbox"
                        />
                      ))}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-3 mt-4">
                  {completedToolboxTalks.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No completed Toolbox Talks yet.
                    </p>
                  ) : (
                    completedToolboxTalks.map(talk => {
                      const signature = signedToolboxTalks.find(s => s.toolbox_talk_id === talk.id);
                      return (
                        <DocumentItem 
                          key={talk.id} 
                          item={talk} 
                          status="completed"
                          type="toolbox"
                          signedAt={signature?.signed_at}
                        />
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="all" className="space-y-3 mt-4">
                  {relevantToolboxTalks.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No Toolbox Talks assigned to your roles yet.
                    </p>
                  ) : (
                    relevantToolboxTalks.map(talk => {
                      const isSigned = signedToolboxIds.has(talk.id);
                      const signature = signedToolboxTalks.find(s => s.toolbox_talk_id === talk.id);
                      return (
                        <DocumentItem 
                          key={talk.id} 
                          item={talk} 
                          status={isSigned ? "completed" : (talk.is_mandatory ? "mandatory" : "pending")}
                          type="toolbox"
                          signedAt={signature?.signed_at}
                        />
                      );
                    })
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

interface DocumentItemProps {
  item: RAMS | ToolboxTalk;
  status: "mandatory" | "pending" | "completed";
  type: "rams" | "toolbox";
  signedAt?: string;
}

const DocumentItem = ({ item, status, type, signedAt }: DocumentItemProps) => {
  const linkTo = type === "rams" ? "/rams" : "/toolbox-talks";
  
  return (
    <Link 
      to={linkTo}
      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70 ${
        status === "mandatory" ? "border-destructive/50 bg-destructive/5 hover:bg-destructive/10" :
        status === "completed" ? "border-primary/50 bg-primary/5 hover:bg-primary/10" :
        "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-3">
        {status === "completed" ? (
          <CheckCircle className="h-5 w-5 text-primary" />
        ) : status === "mandatory" ? (
          <AlertCircle className="h-5 w-5 text-destructive" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">{item.reference_code} - {item.title}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {item.is_mandatory && (
              <Badge variant="destructive" className="text-xs">Mandatory</Badge>
            )}
            {status === "completed" && signedAt && (
              <span>Signed {new Date(signedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
      <Button variant={status === "mandatory" ? "destructive" : "outline"} size="sm" asChild>
        <span>{status === "completed" ? "View" : "Sign"}</span>
      </Button>
    </Link>
  );
};

export default MyProfilePage;
