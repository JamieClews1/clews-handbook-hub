import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle, AlertCircle, FileText, User, Clock } from "lucide-react";
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

interface RAMSSignature {
  rams_id: string;
  signed_at: string;
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
  const [signedRAMS, setSignedRAMS] = useState<RAMSSignature[]>([]);
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
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, user_types")
        .eq("id", user!.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch all RAMS
      const { data: ramsData, error: ramsError } = await supabase
        .from("rams")
        .select("id, title, reference_code, is_mandatory, user_types, review_date")
        .order("reference_code");

      if (ramsError) throw ramsError;
      setAllRAMS(ramsData || []);

      // Fetch user's signed RAMS
      const { data: signaturesData, error: signaturesError } = await supabase
        .from("rams_user_signatures")
        .select("rams_id, signed_at")
        .eq("user_id", user!.id);

      if (signaturesError) throw signaturesError;
      setSignedRAMS(signaturesData || []);
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
  
  // Filter RAMS relevant to user's types
  const relevantRAMS = allRAMS.filter(rams => {
    if (!profile.user_types || profile.user_types.length === 0) return false;
    return rams.user_types.some(type => 
      profile.user_types.includes(type.toLowerCase())
    );
  });

  const completedRAMS = relevantRAMS.filter(rams => signedRAMSIds.has(rams.id));
  const mandatoryPending = relevantRAMS.filter(rams => 
    rams.is_mandatory && !signedRAMSIds.has(rams.id)
  );
  const optionalPending = relevantRAMS.filter(rams => 
    !rams.is_mandatory && !signedRAMSIds.has(rams.id)
  );

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

          {/* Summary Cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold">{mandatoryPending.length}</p>
                    <p className="text-sm text-muted-foreground">Mandatory Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-warning">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-warning" />
                  <div>
                    <p className="text-2xl font-bold">{optionalPending.length}</p>
                    <p className="text-sm text-muted-foreground">Optional Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{completedRAMS.length}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RAMS Tabs */}
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
                    Pending ({mandatoryPending.length + optionalPending.length})
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
                  {mandatoryPending.length === 0 && optionalPending.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      All caught up! No pending RAMS to complete.
                    </p>
                  ) : (
                    <>
                      {mandatoryPending.map(rams => (
                        <RAMSItem 
                          key={rams.id} 
                          rams={rams} 
                          status="mandatory" 
                        />
                      ))}
                      {optionalPending.map(rams => (
                        <RAMSItem 
                          key={rams.id} 
                          rams={rams} 
                          status="pending" 
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
                        <RAMSItem 
                          key={rams.id} 
                          rams={rams} 
                          status="completed"
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
                        <RAMSItem 
                          key={rams.id} 
                          rams={rams} 
                          status={isSigned ? "completed" : (rams.is_mandatory ? "mandatory" : "pending")}
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

interface RAMSItemProps {
  rams: RAMS;
  status: "mandatory" | "pending" | "completed";
  signedAt?: string;
}

const RAMSItem = ({ rams, status, signedAt }: RAMSItemProps) => {
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${
      status === "mandatory" ? "border-destructive/50 bg-destructive/5" :
      status === "completed" ? "border-primary/50 bg-primary/5" :
      "border-border bg-muted/30"
    }`}>
      <div className="flex items-center gap-3">
        {status === "completed" ? (
          <CheckCircle className="h-5 w-5 text-primary" />
        ) : status === "mandatory" ? (
          <AlertCircle className="h-5 w-5 text-destructive" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">{rams.reference_code} - {rams.title}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {rams.is_mandatory && (
              <Badge variant="destructive" className="text-xs">Mandatory</Badge>
            )}
            {status === "completed" && signedAt && (
              <span>Signed {new Date(signedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
      <Link to="/rams">
        <Button variant={status === "mandatory" ? "destructive" : "outline"} size="sm">
          {status === "completed" ? "View" : "Sign"}
        </Button>
      </Link>
    </div>
  );
};

export default MyProfilePage;
