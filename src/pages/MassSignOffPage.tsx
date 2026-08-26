import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle, ClipboardList, Users, MessageSquare, ClipboardCheck } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  user_types: string[] | null;
}

interface Document {
  id: string;
  title: string;
  reference_code?: string;
  user_types: string[];
}

interface SignatureRecord {
  user_id: string;
  document_id: string;
}

const USER_TYPE_LABELS: Record<string, string> = {
  driver: "DRIVERS",
  yard: "YARD",
  office: "OFFICE",
  management: "MANAGEMENT"
};

type TabKey = "rams" | "toolbox" | "induction";

const ALL_USER_TYPES = ["driver", "yard", "office", "management"];

const MassSignOffPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("rams");
  const [rams, setRams] = useState<Document[]>([]);
  const [toolboxTalks, setToolboxTalks] = useState<Document[]>([]);
  const [inductions, setInductions] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [existingSignatures, setExistingSignatures] = useState<SignatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const [signingUser, setSigningUser] = useState<UserProfile | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isManagement, setIsManagement] = useState(false);

  useEffect(() => {
    const checkManagement = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", user.id)
        .single();

      if (profile?.user_types?.includes("management")) {
        setIsManagement(true);
      } else {
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        
        setIsManagement(!!adminRole);
      }
    };

    checkManagement();
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const { data: ramsData } = await supabase
        .from("rams")
        .select("id, title, reference_code, user_types")
        .order("title");

      if (ramsData) {
        setRams(ramsData);
      }

      const { data: toolboxData } = await supabase
        .from("toolbox_talks")
        .select("id, title, user_types")
        .order("title");

      if (toolboxData) {
        setToolboxTalks(toolboxData);
      }

      const { data: inductionData } = await supabase
        .from("hs_documents")
        .select("id, title, reference_code")
        .eq("category", "site_induction")
        .eq("is_published", true)
        .eq("requires_signature", true)
        .order("reference_code");

      if (inductionData) {
        setInductions(
          inductionData.map((d) => ({
            id: d.id,
            title: d.title,
            reference_code: d.reference_code ?? undefined,
            user_types: ALL_USER_TYPES,
          }))
        );
      }

      const { data: usersData } = await supabase
        .from("profiles")
        .select("id, email, full_name, user_types")
        .order("full_name");

      if (usersData) {
        setUsers(usersData);
      }

      setLoading(false);
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  // Handle URL params for pre-selection (only once after data loads)
  useEffect(() => {
    if (hasInitialized || loading) return;
    
    const typeParam = searchParams.get('type');
    const idParam = searchParams.get('id');
    
    if (typeParam && idParam) {
      if (typeParam === 'toolbox' && toolboxTalks.some(t => t.id === idParam)) {
        setActiveTab('toolbox');
        setSelectedDocId(idParam);
      } else if (typeParam === 'rams' && rams.some(r => r.id === idParam)) {
        setActiveTab('rams');
        setSelectedDocId(idParam);
      } else if (typeParam === 'induction' && inductions.some(i => i.id === idParam)) {
        setActiveTab('induction');
        setSelectedDocId(idParam);
      }
    }
    setHasInitialized(true);
  }, [loading, hasInitialized, searchParams, rams, toolboxTalks, inductions]);

  useEffect(() => {
    if (hasInitialized) {
      setSelectedDocId("");
      setExistingSignatures([]);
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchSignatures = async () => {
      if (!selectedDocId) {
        setExistingSignatures([]);
        return;
      }

      if (activeTab === "rams") {
        const { data } = await supabase
          .from("rams_user_signatures")
          .select("user_id, rams_id")
          .eq("rams_id", selectedDocId);

        if (data) {
          setExistingSignatures(data.map(d => ({ user_id: d.user_id, document_id: d.rams_id })));
        }
      } else if (activeTab === "induction") {
        const { data } = await supabase
          .from("hs_document_signatures")
          .select("user_id, document_id")
          .eq("document_id", selectedDocId);

        if (data) {
          setExistingSignatures(data.map(d => ({ user_id: d.user_id, document_id: d.document_id })));
        }
      } else {
        const { data } = await supabase
          .from("toolbox_talk_signatures")
          .select("user_id, toolbox_talk_id")
          .eq("toolbox_talk_id", selectedDocId);

        if (data) {
          setExistingSignatures(data.map(d => ({ user_id: d.user_id, document_id: d.toolbox_talk_id })));
        }
      }
    };

    fetchSignatures();
  }, [selectedDocId, activeTab]);

  const handleUserTap = (userProfile: UserProfile) => {
    const alreadySigned = existingSignatures.some(
      sig => sig.user_id === userProfile.id && sig.document_id === selectedDocId
    );

    if (alreadySigned) {
      toast({
        title: "Already Signed",
        description: `${userProfile.full_name || userProfile.email} has already signed this document.`,
      });
      return;
    }

    setSigningUser(userProfile);
    setShowSignDialog(true);
  };

  const handleSignatureComplete = async (signatureData: string) => {
    if (!signingUser || !selectedDocId) return;

    setIsSigning(true);
    
    let error;
    if (activeTab === "rams") {
      const result = await supabase
        .from("rams_user_signatures")
        .insert({
          user_id: signingUser.id,
          rams_id: selectedDocId,
          signature_image: signatureData,
        });
      error = result.error;
    } else if (activeTab === "induction") {
      const result = await supabase
        .from("hs_document_signatures")
        .insert({
          user_id: signingUser.id,
          document_id: selectedDocId,
          signature_image: signatureData,
          employee_name: signingUser.full_name || signingUser.email,
          language: "en",
          acknowledgements: [],
        });
      error = result.error;
    } else {
      const result = await supabase
        .from("toolbox_talk_signatures")
        .insert({
          user_id: signingUser.id,
          toolbox_talk_id: selectedDocId,
          signature_image: signatureData,
        });
      error = result.error;
    }

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed Successfully",
        description: `${signingUser.full_name || signingUser.email} has signed the document.`,
      });
      
      setExistingSignatures(prev => [...prev, { 
        user_id: signingUser.id, 
        document_id: selectedDocId 
      }]);
    }

    setIsSigning(false);
    setShowSignDialog(false);
    setSigningUser(null);
  };

  const currentDocs = activeTab === "rams" ? rams : activeTab === "induction" ? inductions : toolboxTalks;
  const selectedDoc = currentDocs.find(d => d.id === selectedDocId);
  const docLabel = activeTab === "rams" ? "RAMS Document" : activeTab === "induction" ? "Site Induction" : "Toolbox Talk";
  
  const normalizeUserType = (type: string): string => {
    const normalized = type.toLowerCase().replace(/s$/, '');
    return normalized === 'driver' ? 'driver' : normalized;
  };

  const groupedUsers = users.reduce((acc, userProfile) => {
    if (!userProfile.user_types || userProfile.user_types.length === 0) return acc;
    
    if (selectedDoc) {
      const docTypesNormalized = selectedDoc.user_types.map(normalizeUserType);
      const hasApplicableType = userProfile.user_types.some(
        type => docTypesNormalized.includes(normalizeUserType(type))
      );
      if (!hasApplicableType) return acc;
    }

    userProfile.user_types.forEach(type => {
      if (!acc[type]) acc[type] = [];
      if (!acc[type].find(u => u.id === userProfile.id)) {
        acc[type].push(userProfile);
      }
    });
    
    return acc;
  }, {} as Record<string, UserProfile[]>);

  const isUserSigned = (userId: string) => {
    return existingSignatures.some(
      sig => sig.user_id === userId && sig.document_id === selectedDocId
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!isManagement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">
            This page is only accessible to management users.
          </p>
          <Link to="/portal">
            <Button>Back to Portal</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <img src={clewsLogo} alt="Clews Logo" className="h-10 w-auto" />
          <Link to="/portal">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rams" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              RAMS
            </TabsTrigger>
            <TabsTrigger value="toolbox" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Toolbox Talks
            </TabsTrigger>
            <TabsTrigger value="induction" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Site Inductions
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            {activeTab === "rams" ? (
              <ClipboardList className="h-5 w-5 text-primary" />
            ) : activeTab === "induction" ? (
              <ClipboardCheck className="h-5 w-5 text-primary" />
            ) : (
              <MessageSquare className="h-5 w-5 text-primary" />
            )}
            <span className="font-medium">Select {docLabel}</span>
          </div>
          <Select value={selectedDocId} onValueChange={setSelectedDocId}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder={`Choose a ${docLabel} to sign...`} />
            </SelectTrigger>
            <SelectContent>
              {currentDocs.map(doc => (
                <SelectItem key={doc.id} value={doc.id} className="text-base py-3">
                  {doc.reference_code ? `${doc.reference_code} - ` : ""}{doc.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDoc && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Applies to:</span>
              {selectedDoc.user_types.map(type => (
                <Badge key={type} variant="secondary">
                  {USER_TYPE_LABELS[type] || type}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {selectedDocId ? (
          <div className="space-y-6">
            {Object.entries(groupedUsers).map(([type, typeUsers]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {USER_TYPE_LABELS[type] || type}
                  </h2>
                  <Badge variant="outline" className="ml-auto">
                    {typeUsers.filter(u => isUserSigned(u.id)).length}/{typeUsers.length} signed
                  </Badge>
                </div>
                <div className="space-y-2">
                  {typeUsers.map(userProfile => {
                    const signed = isUserSigned(userProfile.id);
                    return (
                      <button
                        key={userProfile.id}
                        onClick={() => handleUserTap(userProfile)}
                        disabled={signed}
                        className={`w-full rounded-xl p-4 text-left transition-all active:scale-[0.98] ${
                          signed
                            ? "bg-green-500/10 border-2 border-green-500/30"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xl font-semibold ${signed ? "text-green-700 dark:text-green-400" : ""}`}>
                            {userProfile.full_name || userProfile.email}
                          </span>
                          {signed ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                              <CheckCircle className="h-5 w-5" />
                              <span className="text-sm font-medium">Signed</span>
                            </div>
                          ) : (
                            <span className="text-sm opacity-80">Tap to sign</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {Object.keys(groupedUsers).length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No users found with the applicable user types for this document.
                </p>
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-8 text-center">
            {activeTab === "rams" ? (
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            ) : activeTab === "induction" ? (
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            ) : (
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            )}
            <p className="text-muted-foreground">
              Select a {docLabel} above to begin the mass sign-off process.
            </p>
          </Card>
        )}
      </main>

      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Confirm Signature
            </DialogTitle>
            <DialogDescription className="text-base">
              {signingUser?.full_name || signingUser?.email} is signing:
              <br />
              <strong>
                {selectedDoc?.reference_code ? `${selectedDoc.reference_code} - ` : ""}
                {selectedDoc?.title}
              </strong>
            </DialogDescription>
          </DialogHeader>
          
          <SignaturePad
            onSave={handleSignatureComplete}
            onCancel={() => {
              setShowSignDialog(false);
              setSigningUser(null);
            }}
          />

          {isSigning && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MassSignOffPage;
