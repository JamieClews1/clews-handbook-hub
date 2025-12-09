import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, MessageSquare, CheckCircle, AlertTriangle } from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";

interface ToolboxTalk {
  id: string;
  reference_code: string;
  title: string;
  content: string;
  user_types: string[];
  is_mandatory: boolean;
  created_date: string;
}

const ToolboxTalksPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [toolboxTalks, setToolboxTalks] = useState<ToolboxTalk[]>([]);
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [signedTalkIds, setSignedTalkIds] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [selectedTalk, setSelectedTalk] = useState<ToolboxTalk | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

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
        setUserTypes(types);

        // Fetch published toolbox talks
        const { data: talks } = await supabase
          .from("toolbox_talks")
          .select("*")
          .eq("is_published", true)
          .order("created_date", { ascending: false });

        // Filter by user types
        const applicableTalks = (talks || []).filter(talk =>
          types.some((ut: string) => talk.user_types.includes(ut))
        );

        setToolboxTalks(applicableTalks);

        // Fetch user's signatures
        const { data: signatures } = await supabase
          .from("toolbox_talk_signatures")
          .select("toolbox_talk_id")
          .eq("user_id", user.id);

        setSignedTalkIds(new Set(signatures?.map(s => s.toolbox_talk_id) || []));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [user]);

  // Auto-open specific talk from URL query param
  useEffect(() => {
    if (!loadingData && toolboxTalks.length > 0 && !hasAutoOpened) {
      const talkId = searchParams.get('id');
      if (talkId) {
        const talk = toolboxTalks.find(t => t.id === talkId);
        if (talk) {
          setSelectedTalk(talk);
          setShowSignDialog(true);
          setHasAutoOpened(true);
        }
      }
    }
  }, [loadingData, toolboxTalks, searchParams, hasAutoOpened]);

  const handleSign = async (signatureData: string) => {
    if (!selectedTalk || !user) return;

    setIsSigning(true);

    const { error } = await supabase
      .from("toolbox_talk_signatures")
      .insert({
        toolbox_talk_id: selectedTalk.id,
        user_id: user.id,
        signature_image: signatureData,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save signature. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed Successfully",
        description: `You have signed "${selectedTalk.title}".`,
      });
      setSignedTalkIds(prev => new Set([...prev, selectedTalk.id]));
    }

    setIsSigning(false);
    setShowSignDialog(false);
    setSelectedTalk(null);
  };

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

  const pendingMandatory = toolboxTalks.filter(
    t => t.is_mandatory && !signedTalkIds.has(t.id)
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={clewsLogo} alt="Clews Recycling" className="h-12 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Clews Recycling</h1>
              <p className="text-sm text-muted-foreground">Toolbox Talks</p>
            </div>
          </div>
          <Link to="/portal">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Portal
            </Button>
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-primary to-accent py-12">
        <div className="container mx-auto px-4 text-center">
          <MessageSquare className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-primary-foreground mb-2">
            Toolbox Talks
          </h2>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Short safety briefings to reinforce workplace safety awareness and best practices.
          </p>
          {pendingMandatory > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-destructive/20 text-destructive-foreground px-4 py-2 rounded-full">
              <AlertTriangle className="h-5 w-5" />
              <span>{pendingMandatory} mandatory talk{pendingMandatory > 1 ? "s" : ""} pending signature</span>
            </div>
          )}
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        {toolboxTalks.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No Toolbox Talks are currently assigned to your user type.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {toolboxTalks.map(talk => {
              const isSigned = signedTalkIds.has(talk.id);
              return (
                <Card 
                  key={talk.id} 
                  className={`flex flex-col h-full cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70 ${isSigned ? "border-green-500/30" : ""}`}
                  onClick={() => {
                    setSelectedTalk(talk);
                    setShowSignDialog(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                        {talk.reference_code}
                      </span>
                      <div className="flex gap-1">
                        {talk.is_mandatory && (
                          <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                        )}
                        {isSigned && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Signed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-base mt-2 line-clamp-2">{talk.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {new Date(talk.created_date).toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-1 pb-3">
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground line-clamp-4 text-sm"
                      dangerouslySetInnerHTML={{ __html: talk.content }}
                    />
                  </CardContent>
                  <div className="px-6 pb-4 mt-auto">
                    {!isSigned && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTalk(talk);
                          setShowSignDialog(true);
                        }}
                      >
                        Sign Off
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign Toolbox Talk</DialogTitle>
            <DialogDescription>
              By signing, you confirm that you have read and understood:
              <br />
              <strong>{selectedTalk?.title}</strong>
            </DialogDescription>
          </DialogHeader>

          <SignaturePad
            onSave={handleSign}
            onCancel={() => {
              setShowSignDialog(false);
              setSelectedTalk(null);
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

export default ToolboxTalksPage;
